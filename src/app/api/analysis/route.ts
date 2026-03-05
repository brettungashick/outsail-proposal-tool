import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireProjectAccess, getAppBaseUrl } from '@/lib/access';
import { isApiKeyConfigured } from '@/lib/claude';
import { checkRateLimit } from '@/lib/rate-limit';
import { analysisCreateSchema, validateBody } from '@/lib/schemas';

// Inline migration for analysisProgress column
let _migrated = false;
async function ensureAnalysisColumns() {
  if (_migrated) return;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Analysis" ADD COLUMN "analysisProgress" TEXT`);
  } catch { /* already exists */ }
  _migrated = true;
}

export async function POST(req: NextRequest) {
  await ensureAnalysisColumns();

  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit: 5 analysis creations per user per hour
  const rl = checkRateLimit({ key: `analysis:${sessionUser.id}`, limit: 5, windowMs: 60 * 60 * 1000 });
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Analysis rate limit exceeded. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
    );
  }

  const body = await req.json();
  const validated = validateBody(analysisCreateSchema, body);
  if (!validated.success) return validated.response;

  const { projectId } = validated.data;

  const hasAccess = await requireProjectAccess(projectId, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId },
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
      createdBy: sessionUser.id,
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
