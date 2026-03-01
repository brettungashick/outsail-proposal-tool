import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireShareAccess } from '@/lib/access';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Authentication required', code: 'AUTH_REQUIRED' }, { status: 401 });
  }

  const { allowed, reason } = await requireShareAccess(params.token, sessionUser);
  if (!allowed) {
    const status = reason === 'Invalid share link' ? 404
      : reason === 'Share link has expired' ? 410
      : 403;
    return NextResponse.json({ error: reason }, { status });
  }

  const shareLink = await prisma.shareLink.findUnique({
    where: { token: params.token },
    include: {
      project: {
        include: {
          analyses: {
            orderBy: { version: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!shareLink) {
    return NextResponse.json({ error: 'Invalid share link' }, { status: 404 });
  }

  const latestAnalysis = shareLink.project.analyses[0] || null;

  return NextResponse.json({
    project: {
      name: shareLink.project.name,
      clientName: shareLink.project.clientName,
      status: shareLink.project.status,
    },
    analysis: latestAnalysis
      ? {
          version: latestAnalysis.version,
          comparisonData: latestAnalysis.comparisonData,
          standardizationNotes: latestAnalysis.standardizationNotes,
          vendorNotes: latestAnalysis.vendorNotes,
          nextSteps: latestAnalysis.nextSteps,
          citations: latestAnalysis.citations,
          createdAt: latestAnalysis.createdAt,
        }
      : null,
  });
}
