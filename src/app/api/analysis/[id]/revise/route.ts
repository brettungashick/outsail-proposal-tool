import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { reviseComparison, isApiKeyConfigured } from '@/lib/claude';
import { formatAdvisorAnswers } from '@/lib/advisor-context';
import { recalculateTable } from '@/lib/recalculate';
import {
  PendingRevision,
  RevisionHistoryEntry,
  analysisResultFromRow,
  carryForwardTableState,
  diffAnalyses,
  hashComparison,
  parseJsonOr,
} from '@/lib/revision';
import { validateBody, analysisReviseSchema } from '@/lib/schemas';
import { DiscountToggles, HiddenRows, ParsedProposal } from '@/types';

// A revision regenerates the full comparison in one large Claude call, same as
// finalization, so it needs the same headroom.
export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

async function authorize(id: string) {
  const user = await getSessionUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const hasAccess = await requireAnalysisAccess(id, user.id, user.role);
  if (!hasAccess) {
    return { error: NextResponse.json({ error: 'Analysis not found' }, { status: 404 }) };
  }
  const analysis = await prisma.analysis.findUnique({ where: { id } });
  if (!analysis) {
    return { error: NextResponse.json({ error: 'Analysis not found' }, { status: 404 }) };
  }
  return { user, analysis };
}

/** Return the unresolved draft revision, if any, so a reload doesn't lose it. */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(id);
  if ('error' in auth) return auth.error;
  const { analysis } = auth;

  const pending = parseJsonOr<PendingRevision | null>(analysis.pendingRevision, null);
  if (!pending) return NextResponse.json({ pending: null });

  const diff = diffAnalyses(analysisResultFromRow(analysis), pending.result);
  return NextResponse.json({
    pending: {
      feedback: pending.feedback,
      changeSummary: pending.changeSummary,
      createdAt: pending.createdAt,
      stale: pending.baseHash !== hashComparison(analysis.comparisonData),
      diff,
    },
  });
}

/** Generate a draft revision from advisor feedback. Nothing is saved as a version yet. */
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(id);
  if ('error' in auth) return auth.error;
  const { user, analysis } = auth;

  if (analysis.status !== 'complete') {
    return NextResponse.json(
      { error: 'Only a completed analysis can be revised.' },
      { status: 400 }
    );
  }

  const latest = await prisma.analysis.findFirst({
    where: { projectId: analysis.projectId },
    orderBy: { version: 'desc' },
    select: { id: true },
  });
  if (latest?.id !== analysis.id) {
    return NextResponse.json(
      { error: 'Only the latest version can be revised. Open the latest version and try again.' },
      { status: 400 }
    );
  }

  if (!isApiKeyConfigured()) {
    return NextResponse.json({ error: 'Anthropic API key is not configured.' }, { status: 503 });
  }

  const body = await req.json();
  const validated = validateBody(analysisReviseSchema, body);
  if (!validated.success) return validated.response;
  const { feedback } = validated.data;

  try {
    const current = analysisResultFromRow(analysis);
    const parsedProposals = parseJsonOr<ParsedProposal[]>(analysis.parsedProposals, []);
    const answers = parseJsonOr<Record<string, string>>(analysis.advisorAnswers, {});
    const history = parseJsonOr<RevisionHistoryEntry[]>(analysis.revisionHistory, []);

    const revision = await reviseComparison({
      parsedProposals,
      advisorContext: formatAdvisorAnswers(answers, analysis.clarifyingQuestions),
      current,
      feedback,
      priorFeedback: history.map((h) => h.feedback),
    });

    const discountToggles = parseJsonOr<DiscountToggles>(analysis.discountToggles, {});
    const hiddenRows = parseJsonOr<HiddenRows>(analysis.hiddenRows, {});
    const table = recalculateTable(
      carryForwardTableState(current.comparisonTable, revision.comparisonTable),
      discountToggles,
      hiddenRows
    );

    const result = {
      comparisonTable: table,
      standardizationNotes: revision.standardizationNotes || [],
      vendorNotes: revision.vendorNotes || {},
      nextSteps: revision.nextSteps || [],
      citations: revision.citations || [],
    };

    const pending: PendingRevision = {
      feedback,
      result,
      changeSummary: revision.changeSummary,
      baseHash: hashComparison(analysis.comparisonData),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };

    await prisma.analysis.update({
      where: { id },
      data: { pendingRevision: JSON.stringify(pending) },
    });

    return NextResponse.json({
      pending: {
        feedback,
        changeSummary: pending.changeSummary,
        createdAt: pending.createdAt,
        stale: false,
        diff: diffAnalyses(current, result),
      },
    });
  } catch (error: unknown) {
    console.error('Revision error:', error);
    const message = error instanceof Error ? error.message : 'Revision failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Discard the draft revision. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const auth = await authorize(id);
  if ('error' in auth) return auth.error;

  await prisma.analysis.update({
    where: { id },
    data: { pendingRevision: null },
  });
  return NextResponse.json({ success: true });
}
