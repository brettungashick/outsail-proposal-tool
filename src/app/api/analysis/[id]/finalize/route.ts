import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAnalysisAccess, getAppBaseUrl } from '@/lib/access';
import { generateComparison, isApiKeyConfigured } from '@/lib/claude';
import { ParsedProposal } from '@/types';
import { checkRateLimit } from '@/lib/rate-limit';
import { analysisFinalizeSchema, validateBody } from '@/lib/schemas';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 5 finalizations per user per hour
  const rl = checkRateLimit({ key: `finalize:${sessionUser.id}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const hasAccess = await requireAnalysisAccess(params.id, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id: params.id },
    include: { project: true },
  });

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  if (analysis.status !== 'clarifying') {
    return NextResponse.json({ error: 'Analysis is not in clarifying state' }, { status: 400 });
  }

  if (!isApiKeyConfigured()) {
    return NextResponse.json(
      { error: 'Anthropic API key is not configured.' },
      { status: 503 }
    );
  }

  // Save advisor answers and transition to finalizing
  const body = await req.json();
  const validated = validateBody(analysisFinalizeSchema, body);
  if (!validated.success) return validated.response;

  const { answers } = validated.data;

  await prisma.analysis.update({
    where: { id: params.id },
    data: {
      advisorAnswers: JSON.stringify(answers),
      status: 'finalizing',
      analysisProgress: JSON.stringify({
        stage: 'queued',
        message: 'Finalization queued...',
      }),
    },
  });

  // Update project status
  await prisma.project.update({
    where: { id: analysis.projectId },
    data: { status: 'analyzing' },
  });

  // Fire-and-forget: trigger background finalization
  const baseUrl = getAppBaseUrl(req.headers);
  const processSecret = process.env.ANALYSIS_SECRET;
  if (processSecret) {
    fetch(`${baseUrl}/api/analysis/${params.id}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${processSecret}`,
      },
      body: JSON.stringify({ mode: 'finalize' }),
    }).catch((err) => console.error('Failed to trigger finalization processing:', err));
  } else {
    // Fallback: run synchronously (for dev without ANALYSIS_SECRET)
    console.warn('ANALYSIS_SECRET not set — running finalization synchronously.');
    try {
      const parsedProposals: ParsedProposal[] = JSON.parse(analysis.parsedProposals || '[]');
      const advisorContext = formatAdvisorAnswers(answers, analysis.clarifyingQuestions);
      const analysisResult = await generateComparison(parsedProposals, advisorContext);

      await prisma.analysis.update({
        where: { id: params.id },
        data: {
          status: 'complete',
          comparisonData: JSON.stringify(analysisResult.comparisonTable),
          standardizationNotes: JSON.stringify(analysisResult.standardizationNotes),
          vendorNotes: JSON.stringify(analysisResult.vendorNotes),
          nextSteps: JSON.stringify(analysisResult.nextSteps),
          citations: JSON.stringify(analysisResult.citations),
          analysisProgress: JSON.stringify({ stage: 'complete', message: 'Analysis complete' }),
        },
      });

      await prisma.project.update({
        where: { id: analysis.projectId },
        data: { status: 'complete' },
      });
    } catch (error: unknown) {
      console.error('Sync finalization error:', error);
      await prisma.analysis.update({
        where: { id: params.id },
        data: {
          status: 'clarifying',
          analysisProgress: JSON.stringify({
            stage: 'error',
            message: error instanceof Error ? error.message : 'Finalization failed',
          }),
        },
      });
      await prisma.project.update({
        where: { id: analysis.projectId },
        data: { status: 'clarifying' },
      });
    }
  }

  return NextResponse.json({ id: params.id, status: 'finalizing' }, { status: 202 });
}

function formatAdvisorAnswers(
  answers: Record<string, string>,
  questionsJson: string | null
): string {
  if (!questionsJson || Object.keys(answers).length === 0) return '';

  try {
    const questions = JSON.parse(questionsJson) as Array<{
      id: string;
      question: string;
      vendorName: string | null;
    }>;

    const lines: string[] = ['ADVISOR CLARIFICATIONS AND NOTES:'];
    for (const q of questions) {
      const answer = answers[q.id];
      if (answer && answer.trim()) {
        const vendor = q.vendorName ? ` [${q.vendorName}]` : '';
        lines.push(`- Q: ${q.question}${vendor}`);
        lines.push(`  A: ${answer}`);
      }
    }

    return lines.length > 1 ? lines.join('\n') : '';
  } catch {
    return '';
  }
}
