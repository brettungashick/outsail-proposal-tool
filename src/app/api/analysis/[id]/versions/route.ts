import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import { RevisionHistoryEntry, parseJsonOr } from '@/lib/revision';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireAnalysisAccess(params.id, user.id, user.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  // Get the analysis to find the project
  const analysis = await prisma.analysis.findUnique({
    where: { id: params.id },
  });

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  // Get all versions for this project
  const versions = await prisma.analysis.findMany({
    where: { projectId: analysis.projectId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      createdAt: true,
      createdBy: true,
      revisionHistory: true,
    },
  });

  // Each version carries its full feedback chain; the list only needs the round
  // that produced it.
  const versionSummaries = versions.map(({ revisionHistory, ...v }) => {
    const history = parseJsonOr<RevisionHistoryEntry[]>(revisionHistory, []);
    const last = history[history.length - 1];
    return {
      ...v,
      revision: last ? { feedback: last.feedback, basedOnVersion: last.basedOnVersion } : null,
    };
  });

  // Get all edits for the current analysis
  const edits = await prisma.analysisEdit.findMany({
    where: { analysisId: params.id },
    orderBy: { editedAt: 'desc' },
  });

  return NextResponse.json({ versions: versionSummaries, edits });
}
