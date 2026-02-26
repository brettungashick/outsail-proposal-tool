import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseProposal, generateComparison, isApiKeyConfigured } from '@/lib/claude';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await req.json();
  const { projectId } = body;

  // Verify project
  const project = await prisma.project.findFirst({
    where: { id: projectId, advisorId: userId },
    include: { documents: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (project.documents.length < 2) {
    return NextResponse.json(
      { error: 'At least 2 vendor documents are required for comparison' },
      { status: 400 }
    );
  }

  if (!isApiKeyConfigured()) {
    return NextResponse.json(
      { error: 'Anthropic API key is not configured. Please add ANTHROPIC_API_KEY to your environment variables.' },
      { status: 503 }
    );
  }

  // Update project status
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'analyzing' },
  });

  try {
    // Step 1: Parse each document with Claude
    const parsedProposals = [];
    for (const doc of project.documents) {
      if (doc.parsedData) {
        // Already parsed, reuse
        parsedProposals.push({
          ...JSON.parse(doc.parsedData),
          documentId: doc.id,
          documentName: doc.fileName,
        });
      } else {
        const parsed = await parseProposal(
          doc.rawText || '',
          doc.vendorName,
          doc.id,
          doc.fileName
        );
        // Save parsed data back to document
        await prisma.document.update({
          where: { id: doc.id },
          data: { parsedData: JSON.stringify(parsed) },
        });
        parsedProposals.push(parsed);
      }
    }

    // Step 2: Generate comparison
    const analysisResult = await generateComparison(parsedProposals);

    // Step 3: Determine version number
    const lastAnalysis = await prisma.analysis.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });
    const version = (lastAnalysis?.version || 0) + 1;

    // Step 4: Save analysis
    const analysis = await prisma.analysis.create({
      data: {
        projectId,
        version,
        comparisonData: JSON.stringify(analysisResult.comparisonTable),
        standardizationNotes: JSON.stringify(analysisResult.standardizationNotes),
        vendorNotes: JSON.stringify(analysisResult.vendorNotes),
        nextSteps: JSON.stringify(analysisResult.nextSteps),
        citations: JSON.stringify(analysisResult.citations),
        createdBy: userId,
      },
    });

    // Update project status
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'complete' },
    });

    return NextResponse.json(analysis, { status: 201 });
  } catch (error: unknown) {
    console.error('Analysis generation error:', error);
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'draft' },
    });

    let message = 'An unexpected error occurred during analysis.';
    let status = 500;

    if (error instanceof Error && 'status' in error) {
      const apiError = error as Error & { status: number };
      if (apiError.status === 401) {
        message = 'Invalid Anthropic API key. Please check your configuration.';
        status = 401;
      } else if (apiError.status === 429) {
        message = 'Rate limit exceeded. Please wait a moment and try again.';
        status = 429;
      } else {
        message = `Anthropic API error (${apiError.status}): ${apiError.message}`;
      }
    } else if (error instanceof SyntaxError) {
      message = 'Failed to parse the AI response. Please try again.';
    } else if (error instanceof Error) {
      message = `Analysis failed: ${error.message}`;
    }

    return NextResponse.json({ error: message }, { status });
  }
}
