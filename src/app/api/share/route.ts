import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const body = await req.json();
  const { projectId, email } = body;

  // Verify project belongs to user
  const project = await prisma.project.findFirst({
    where: { id: projectId, advisorId: userId },
  });
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30-day expiry

  const shareLink = await prisma.shareLink.create({
    data: {
      projectId,
      token,
      email,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const shareUrl = `${baseUrl}/share/${token}`;

  return NextResponse.json({ ...shareLink, shareUrl }, { status: 201 });
}
