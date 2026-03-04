import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getSessionUser, requireProjectAccess, emailDomain, getAppBaseUrl } from '@/lib/access';
import { sendShareEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { projectId, email } = body;

  if (!email) {
    return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
  }

  const hasAccess = await requireProjectAccess(projectId, sessionUser.id, sessionUser.role);
  if (!hasAccess) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Fetch project name and advisor name for the email
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, advisorId: true },
  });

  const advisor = await prisma.user.findUnique({
    where: { id: sessionUser.id },
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
}
