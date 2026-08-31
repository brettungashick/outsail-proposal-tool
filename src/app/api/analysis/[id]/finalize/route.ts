import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { generateComparison, isApiKeyConfigured } from '@/lib/claude';
import { ParsedProposal } from '@/types';
import { validateBody, analysisFinalizeSchema } from '@/lib/schemas';

// Generating the comparison is a single large Claude call — give it headroom so
// the function isn't killed mid-flight, which would leave the analysis stuck.
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const hasAccess = await requireAnalysisAccess(id, user.id, user.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id },
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

  const body = await req.json();
  const validated = validateBody(analysisFinalizeSchema, body);
  if (!validated.success) return validated.response;
  const { answers } = validated.data;

  // Save advisor answers and transition to finalizing
  await prisma.analysis.update({
    where: { id },
    data: {
      advisorAnswers: JSON.stringify(answers),
      status: 'finalizing',
      analysisProgress: JSON.stringify({
        stage: 'queued',
        message: 'Finalization queued...',
      }),
    },
  });

  await prisma.project.update({
    where: { id: analysis.projectId },
    data: { status: 'analyzing' },
  });

  // Generate the comparison inline. A serverless "fire-and-forget" background
  // fetch is unreliable (the function can be frozen before the request is
  // dispatched), so we run it here within maxDuration and let the client await.
  try {
    await prisma.analysis.update({
      where: { id },
      data: {
        analysisProgress: JSON.stringify({ stage: 'generating', message: 'Generating comparison table...' }),
      },
    });

    const parsedProposals: ParsedProposal[] = JSON.parse(analysis.parsedProposals || '[]');
    const advisorContext = formatAdvisorAnswers(answers, analysis.clarifyingQuestions);
    const analysisResult = await generateComparison(parsedProposals, advisorContext);

    await prisma.analysis.update({
      where: { id },
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

    return NextResponse.json({ id, status: 'complete' }, { status: 200 });
  } catch (error: unknown) {
    console.error('Finalization error:', error);
    await prisma.analysis.update({
      where: { id },
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

    const message = error instanceof Error ? error.message : 'Finalization failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Advisors sometimes paste whole pages of a PDF into an answer. That is a
// legitimate way to supply missing detail, but an unbounded block of source
// text pushes the comparison prompt — and the table the AI writes from it —
// past what a single response can hold. Cap it, and say so in the prompt so
// the AI knows the note was clipped rather than treating it as complete.
const MAX_ANSWER_CHARS = 20000;
const MAX_ADVISOR_CONTEXT_CHARS = 100000;

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
    let budget = MAX_ADVISOR_CONTEXT_CHARS;

    for (const q of questions) {
      const answer = answers[q.id];
      if (!answer || !answer.trim()) continue;
      if (budget <= 0) break;

      let text = answer.trim();
      const limit = Math.min(MAX_ANSWER_CHARS, budget);
      if (text.length > limit) {
        text = `${text.slice(0, limit)}\n[... note truncated — the advisor pasted more text than fits; treat the remainder as unavailable ...]`;
      }
      budget -= Math.min(answer.length, limit);

      const vendor = q.vendorName ? ` [${q.vendorName}]` : '';
      lines.push(`- Q: ${q.question}${vendor}`);
      lines.push(`  A: ${text}`);
    }

    return lines.length > 1 ? lines.join('\n') : '';
  } catch {
    return '';
  }
}
