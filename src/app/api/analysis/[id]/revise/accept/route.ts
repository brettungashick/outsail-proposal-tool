import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import {
  PendingRevision,
  RevisionHistoryEntry,
  filterStateToRows,
  hashComparison,
  parseJsonOr,
} from '@/lib/revision';
import { DiscountToggles, HiddenRows } from '@/types';

/** Save the draft revision as the project's next analysis version. */
export async function POST(
  _req: NextRequest,
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

  const analysis = await prisma.analysis.findUnique({ where: { id } });
  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const pending = parseJsonOr<PendingRevision | null>(analysis.pendingRevision, null);
  if (!pending) {
    return NextResponse.json({ error: 'There is no revision waiting to be accepted.' }, { status: 400 });
  }

  // The revision was built from a snapshot of the table. If the advisor edited
  // cells since, accepting would silently throw those edits away.
  if (pending.baseHash !== hashComparison(analysis.comparisonData)) {
    return NextResponse.json(
      {
        error:
          'The table was edited after this revision was generated. Discard it and submit your feedback again so the new edits are kept.',
      },
      { status: 409 }
    );
  }

  const latest = await prisma.analysis.findFirst({
    where: { projectId: analysis.projectId },
    orderBy: { version: 'desc' },
    select: { version: true },
  });

  const { discountToggles, hiddenRows } = filterStateToRows(
    parseJsonOr<DiscountToggles>(analysis.discountToggles, {}),
    parseJsonOr<HiddenRows>(analysis.hiddenRows, {}),
    pending.result.comparisonTable
  );

  const history = parseJsonOr<RevisionHistoryEntry[]>(analysis.revisionHistory, []);
  history.push({
    feedback: pending.feedback,
    changeSummary: pending.changeSummary,
    basedOnVersion: analysis.version,
    createdBy: pending.createdBy,
    createdAt: pending.createdAt,
  });

  const [created] = await prisma.$transaction([
    prisma.analysis.create({
      data: {
        projectId: analysis.projectId,
        version: (latest?.version || analysis.version) + 1,
        status: 'complete',
        comparisonData: JSON.stringify(pending.result.comparisonTable),
        standardizationNotes: JSON.stringify(pending.result.standardizationNotes),
        vendorNotes: JSON.stringify(pending.result.vendorNotes),
        nextSteps: JSON.stringify(pending.result.nextSteps),
        citations: JSON.stringify(pending.result.citations),
        discountToggles: JSON.stringify(discountToggles),
        hiddenRows: JSON.stringify(hiddenRows),
        parsedProposals: analysis.parsedProposals,
        clarifyingQuestions: analysis.clarifyingQuestions,
        advisorAnswers: analysis.advisorAnswers,
        revisionHistory: JSON.stringify(history),
        analysisProgress: JSON.stringify({ stage: 'complete', message: 'Revised from advisor feedback' }),
        createdBy: user.id,
      },
    }),
    prisma.analysis.update({
      where: { id },
      data: { pendingRevision: null },
    }),
  ]);

  return NextResponse.json({ id: created.id, version: created.version });
}
