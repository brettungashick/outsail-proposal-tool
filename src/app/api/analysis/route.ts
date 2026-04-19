import { NextRequest, NextResponse } from 'next/server';
import { projectWhereOwnerOrAdmin } from '@/lib/auth';
import { getSessionUser, getAppBaseUrl } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { isApiKeyConfigured } from '@/lib/claude';
import { validateBody, analysisCreateSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;
  const userRole = user.role;
  const body = await req.json();
  const validated = validateBody(analysisCreateSchema, body);
  if (!validated.success) return validated.response;
  const { projectId } = validated.data;

  // Verify project belongs to user or user is admin
  const project = await prisma.project.findFirst({
    where: projectWhereOwnerOrAdmin(projectId, userId, userRole),
    include: { documents: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Filter to active documents only
  const activeDocs = project.documents.filter((d) => d.isActive !== false);

  // Count unique vendors among active docs
  const activeVendors = new Set(activeDocs.map((d) => d.vendorName));
  if (activeVendors.size < 2) {
    return NextResponse.json(
      { error: 'At least 2 vendors with active documents are required for comparison' },
      { status: 400 }
    );
  }

  if (!isApiKeyConfigured()) {
    return NextResponse.json(
      { error: 'Anthropic API key is not configured. Please add ANTHROPIC_API_KEY to your environment variables.' },
      { status: 503 }
    );
  }

  // Determine version number
  const lastAnalysis = await prisma.analysis.findFirst({
    where: { projectId },
    orderBy: { version: 'desc' },
  });
  const version = (lastAnalysis?.version || 0) + 1;

  // Create draft analysis
  const analysis = await prisma.analysis.create({
    data: {
      projectId,
      version,
      status: 'draft',
      comparisonData: '{}',
      createdBy: userId,
      analysisProgress: JSON.stringify({
        stage: 'queued',
        message: 'Analysis queued...',
      }),
    },
  });

  // Update project status
  await prisma.project.update({
    where: { id: projectId },
    data: { status: 'analyzing' },
  });

  // Fire-and-forget: trigger background processing
  const baseUrl = getAppBaseUrl(req.headers);
  const processSecret = process.env.ANALYSIS_SECRET;
  if (processSecret) {
    fetch(`${baseUrl}/api/analysis/${analysis.id}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${processSecret}`,
      },
      body: JSON.stringify({ mode: 'parse' }),
    }).catch((err) => console.error('Failed to trigger analysis processing:', err));
  } else {
    // Fallback: run synchronously (for dev without ANALYSIS_SECRET)
    console.warn('ANALYSIS_SECRET not set — running analysis synchronously.');
    const { parseProposal, generateClarifyingQuestions } = await import('@/lib/claude');
    try {
      const vendorDocs: Record<string, typeof activeDocs> = {};
      for (const doc of activeDocs) {
        if (!vendorDocs[doc.vendorName]) vendorDocs[doc.vendorName] = [];
        vendorDocs[doc.vendorName].push(doc);
      }

      const parsedProposals = [];
      for (const [vendor, docs] of Object.entries(vendorDocs)) {
        try {
          const hasValidText = docs.some(
            (d) => d.rawText && d.rawText.trim().length > 50 && d.rawText !== 'Error extracting text from file'
          );

          if (!hasValidText) {
            console.error(`Vendor ${vendor}: All documents have empty or invalid extracted text`);
            parsedProposals.push({
              vendorName: vendor,
              documentId: docs[0].id,
              documentName: docs[0].fileName,
              headcount: null,
              contractTermMonths: null,
              modules: [],
              implementationItems: [],
              serviceItems: [],
              discounts: [],
              notableTerms: [],
              unknowns: ['Document text extraction failed. All values must be entered manually.'],
            });
            continue;
          }

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
        } catch (vendorError) {
          console.error(`Failed to parse vendor ${vendor}:`, vendorError);
          parsedProposals.push({
            vendorName: vendor,
            documentId: docs[0].id,
            documentName: docs[0].fileName,
            headcount: null,
            contractTermMonths: null,
            modules: [],
            implementationItems: [],
            serviceItems: [],
            discounts: [],
            notableTerms: [],
            unknowns: [
              `Failed to parse proposal: ${vendorError instanceof Error ? vendorError.message : 'Unknown error'}`,
            ],
          });
        }
      }

      if (parsedProposals.length === 0) {
        throw new Error('All vendor proposals failed to parse.');
      }

      const questions = await generateClarifyingQuestions(parsedProposals);

      await prisma.analysis.update({
        where: { id: analysis.id },
        data: {
          status: 'clarifying',
          parsedProposals: JSON.stringify(parsedProposals),
          clarifyingQuestions: JSON.stringify(questions),
          analysisProgress: JSON.stringify({ stage: 'complete', message: 'Ready for review' }),
        },
      });

      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'clarifying' },
      });
    } catch (error: unknown) {
      console.error('Sync analysis error:', error);
      await prisma.analysis.update({
        where: { id: analysis.id },
        data: {
          status: 'failed',
          analysisProgress: JSON.stringify({
            stage: 'error',
            message: error instanceof Error ? error.message : 'Analysis failed',
          }),
        },
      });
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'draft' },
      });
    }
  }

  return NextResponse.json(analysis, { status: 202 });
}
