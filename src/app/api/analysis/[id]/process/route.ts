import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseProposal, generateClarifyingQuestions, generateComparison, isApiKeyConfigured } from '@/lib/claude';
import { ParsedProposal } from '@/types';

// Allow up to 5 minutes for background processing (Vercel Pro/Enterprise)
export const maxDuration = 300;

const PROCESS_SECRET = process.env.ANALYSIS_SECRET || '';

function updateProgress(analysisId: string, progress: object) {
  return prisma.analysis.update({
    where: { id: analysisId },
    data: { analysisProgress: JSON.stringify(progress) },
  });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Authenticate via shared secret (internal self-call only)
  const authHeader = req.headers.get('authorization');
  if (!PROCESS_SECRET || authHeader !== `Bearer ${PROCESS_SECRET}`) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { mode } = await req.json(); // 'parse' or 'finalize'

  if (mode === 'parse') {
    return handleParse(params.id);
  } else if (mode === 'finalize') {
    return handleFinalize(params.id);
  }

  return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
}

async function handleParse(analysisId: string) {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: { project: { include: { documents: true } } },
  });

  if (!analysis || analysis.status !== 'draft') {
    return NextResponse.json({ error: 'Invalid analysis state' }, { status: 400 });
  }

  try {
    const activeDocs = analysis.project.documents.filter((d) => d.isActive !== false);
    const vendorDocs: Record<string, typeof activeDocs> = {};
    for (const doc of activeDocs) {
      if (!vendorDocs[doc.vendorName]) vendorDocs[doc.vendorName] = [];
      vendorDocs[doc.vendorName].push(doc);
    }

    const totalVendors = Object.keys(vendorDocs).length;
    let vendorsParsed = 0;

    await updateProgress(analysisId, {
      stage: 'parsing',
      vendorsParsed: 0,
      totalVendors,
      message: 'Starting proposal parsing...',
    });

    const parsedProposals: ParsedProposal[] = [];
    for (const [vendor, docs] of Object.entries(vendorDocs)) {
      await updateProgress(analysisId, {
        stage: 'parsing',
        vendorsParsed,
        totalVendors,
        message: `Parsing ${vendor} proposal...`,
      });

      const allParsed = docs.every((d) => d.parsedData);
      if (allParsed && docs.length === 1) {
        const doc = docs[0];
        parsedProposals.push({
          ...JSON.parse(doc.parsedData!),
          documentId: doc.id,
          documentName: doc.fileName,
        });
      } else {
        const mergedText = docs
          .map((d) => `--- ${d.fileName} (${d.documentType || 'initial_quote'}) ---\n${d.rawText || ''}`)
          .join('\n\n');

        const primaryDoc = docs[0];
        const parsed = await parseProposal(
          mergedText,
          vendor,
          primaryDoc.id,
          docs.length === 1 ? primaryDoc.fileName : `${vendor} (${docs.length} files)`
        );

        for (const doc of docs) {
          await prisma.document.update({
            where: { id: doc.id },
            data: { parsedData: JSON.stringify(parsed) },
          });
        }
        parsedProposals.push(parsed);
      }

      vendorsParsed++;
    }

    // Generate clarifying questions
    await updateProgress(analysisId, {
      stage: 'questions',
      vendorsParsed: totalVendors,
      totalVendors,
      message: 'Generating clarifying questions...',
    });

    const questions = await generateClarifyingQuestions(parsedProposals);

    // Save and transition to clarifying
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'clarifying',
        parsedProposals: JSON.stringify(parsedProposals),
        clarifyingQuestions: JSON.stringify(questions),
        analysisProgress: JSON.stringify({
          stage: 'complete',
          vendorsParsed: totalVendors,
          totalVendors,
          message: 'Ready for review',
        }),
      },
    });

    await prisma.project.update({
      where: { id: analysis.projectId },
      data: { status: 'clarifying' },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Async parse error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'failed',
        analysisProgress: JSON.stringify({
          stage: 'error',
          message: `Analysis failed: ${message}`,
        }),
      },
    });
    await prisma.project.update({
      where: { id: analysis.projectId },
      data: { status: 'draft' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleFinalize(analysisId: string) {
  const analysis = await prisma.analysis.findUnique({
    where: { id: analysisId },
    include: { project: true },
  });

  if (!analysis || analysis.status !== 'finalizing') {
    return NextResponse.json({ error: 'Invalid analysis state' }, { status: 400 });
  }

  try {
    await updateProgress(analysisId, {
      stage: 'generating',
      message: 'Generating comparison table...',
    });

    const parsedProposals: ParsedProposal[] = JSON.parse(analysis.parsedProposals || '[]');
    const answers = JSON.parse(analysis.advisorAnswers || '{}');
    const advisorContext = formatAdvisorAnswers(answers, analysis.clarifyingQuestions);

    const analysisResult = await generateComparison(parsedProposals, advisorContext);

    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'complete',
        comparisonData: JSON.stringify(analysisResult.comparisonTable),
        standardizationNotes: JSON.stringify(analysisResult.standardizationNotes),
        vendorNotes: JSON.stringify(analysisResult.vendorNotes),
        nextSteps: JSON.stringify(analysisResult.nextSteps),
        citations: JSON.stringify(analysisResult.citations),
        analysisProgress: JSON.stringify({
          stage: 'complete',
          message: 'Analysis complete',
        }),
      },
    });

    await prisma.project.update({
      where: { id: analysis.projectId },
      data: { status: 'complete' },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Async finalize error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';
    // Revert to clarifying so advisor can retry
    await prisma.analysis.update({
      where: { id: analysisId },
      data: {
        status: 'clarifying',
        analysisProgress: JSON.stringify({
          stage: 'error',
          message: `Finalization failed: ${message}`,
        }),
      },
    });
    await prisma.project.update({
      where: { id: analysis.projectId },
      data: { status: 'clarifying' },
    });

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
