import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
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

  if (new Date() > shareLink.expiresAt) {
    return NextResponse.json({ error: 'Share link has expired' }, { status: 410 });
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
