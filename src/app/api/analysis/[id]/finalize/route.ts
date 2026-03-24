import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateComparison, isApiKeyConfigured } from '@/lib/claude';
import { ParsedProposal } from '@/types';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  const body = await req.json();
  const { answers } = body as { answers: Record<string, string> };

  // Save advisor answers
  await prisma.analysis.update({
    where: { id: params.id },
    data: {
      advisorAnswers: JSON.stringify(answers),
      status: 'finalizing',
    },
  });

  await prisma.project.update({
    where: { id: analysis.projectId },
    data: { status: 'analyzing' },
  });

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
      },
    });

    await prisma.project.update({
      where: { id: analysis.projectId },
      data: { status: 'complete' },
    });

    return NextResponse.json({ id: params.id, status: 'complete' });
  } catch (error: unknown) {
    console.error('Finalization error:', error);
    // Revert to clarifying state on failure
    await prisma.analysis.update({
      where: { id: params.id },
      data: { status: 'clarifying' },
    });
    await prisma.project.update({
      where: { id: analysis.projectId },
      data: { status: 'clarifying' },
    });

    const message = error instanceof Error ? error.message : 'Finalization failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
