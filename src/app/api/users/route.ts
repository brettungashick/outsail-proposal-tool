import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendInviteEmail } from '@/lib/email';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = (session.user as { role?: string }).role;
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { email, name } = body;

  if (!email || !name) {
    return NextResponse.json({ error: 'Email and name are required' }, { status: 400 });
  }

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
  }

  // Generate invite token
  const inviteToken = randomBytes(32).toString('hex');

  // Create user with temporary password hash (they'll set their real password via invite link)
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

  // Build invite URL
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

  // Send invite email (non-blocking — still return the link as fallback)
  let emailSent = false;
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
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
