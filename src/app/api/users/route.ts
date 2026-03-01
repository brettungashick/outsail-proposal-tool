import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, getAppBaseUrl } from '@/lib/access';
import { sendInviteEmail } from '@/lib/email';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

export async function GET() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      inviteStatus: true,
      createdAt: true,
      _count: { select: { projects: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (sessionUser.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { email, name } = body;

  if (!email || !name) {
    return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
  }

  const inviteToken = randomBytes(32).toString('hex');
  const tempHash = await bcrypt.hash(randomBytes(16).toString('hex'), 12);

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      name: name.trim(),
      passwordHash: tempHash,
      role: 'advisor',
      inviteToken,
      inviteStatus: 'pending',
    },
  });

  const baseUrl = getAppBaseUrl();
  const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      await sendInviteEmail(user.email, user.name, inviteUrl);
      emailSent = true;
    } catch (err) {
      console.error('Failed to send invite email:', err);
    }
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    name: user.name,
    inviteUrl,
    inviteStatus: 'pending',
    emailSent,
  }, { status: 201 });
}
