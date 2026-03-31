import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { authOptions, projectWhereOwnerOrAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAppBaseUrl, emailDomain } from '@/lib/access';
import { sendShareEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const userRole = (session.user as { role?: string }).role;
    const body = await req.json();
    const { projectId, email } = body;

    if (!email) {
      return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
    }

    // Verify project belongs to user or user is admin
    const project = await prisma.project.findFirst({
      where: projectWhereOwnerOrAdmin(projectId, userId, userRole),
      select: { id: true, name: true, advisorId: true },
    });
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const advisor = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    const token = randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const allowedDomain = emailDomain(email);

    const shareLink = await prisma.shareLink.create({
      data: {
        projectId,
        token,
        email: email.toLowerCase().trim(),
        allowedDomain,
        accessMode: 'domain',
        expiresAt,
      },
    });

    const baseUrl = getAppBaseUrl(req.headers);
    const shareUrl = `${baseUrl}/share/${token}`;

    // Send email to recipient (fire-and-forget — don't block response on email delivery)
    sendShareEmail(
      email.toLowerCase().trim(),
      shareUrl,
      project?.name || 'Proposal Comparison',
      advisor?.name || 'Your advisor',
    ).catch((err) => {
      console.error('Failed to send share email:', err);
    });

    return NextResponse.json({ ...shareLink, shareUrl }, { status: 201 });
  } catch (err) {
    console.error('Share link creation error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create share link' },
      { status: 500 }
    );
  }
}
