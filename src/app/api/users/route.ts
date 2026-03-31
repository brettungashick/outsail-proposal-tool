import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendInviteEmail } from '@/lib/email';
import { getAppBaseUrl, getSessionUser } from '@/lib/access';
import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { validateBody, userCreateSchema } from '@/lib/schemas';

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
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
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userRole = user.role;
  if (userRole !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const validated = validateBody(userCreateSchema, body);
  if (!validated.success) return validated.response;
  const { email, name } = validated.data;

  // Check if email already exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });
  }

  // Generate invite token
  const inviteToken = randomBytes(32).toString('hex');

  // Create user with temporary password hash (they'll set their real password via invite link)
  const tempHash = await bcrypt.hash(randomBytes(16).toString('hex'), 12);

  const newUser = await prisma.user.create({
    data: {
      email,
      name: name.trim(),
      passwordHash: tempHash,
      role: 'advisor',
      inviteToken,
      inviteStatus: 'pending',
    },
  });

  // Build invite URL
  const baseUrl = getAppBaseUrl(req.headers);
  const inviteUrl = `${baseUrl}/invite/${inviteToken}`;

  // Send invite email (non-blocking — still return the link as fallback)
  let emailSent = false;
  if (process.env.RESEND_API_KEY) {
    try {
      await sendInviteEmail(newUser.email, newUser.name, inviteUrl);
      emailSent = true;
    } catch (err) {
      console.error('Failed to send invite email:', err);
    }
  }

  return NextResponse.json({
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    inviteUrl,
    inviteStatus: 'pending',
    emailSent,
  }, { status: 201 });
}
