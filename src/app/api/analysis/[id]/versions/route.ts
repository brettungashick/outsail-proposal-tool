import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireAnalysisAccess } from '@/lib/access';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const hasAccess = await requireAnalysisAccess(params.id, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const analysis = await prisma.analysis.findUnique({
    where: { id: params.id },
  });

  if (!analysis) {
    return NextResponse.json({ error: 'Analysis not found' }, { status: 404 });
  }

  const versions = await prisma.analysis.findMany({
    where: { projectId: analysis.projectId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      createdAt: true,
      createdBy: true,
    },
  });

  const edits = await prisma.analysisEdit.findMany({
    where: { analysisId: params.id },
    orderBy: { editedAt: 'desc' },
  });

  return NextResponse.json({ versions, edits });
}
