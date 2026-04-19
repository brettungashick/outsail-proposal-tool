import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validateBody, inviteAcceptSchema } from '@/lib/schemas';

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const user = await prisma.user.findUnique({
    where: { inviteToken: params.token },
    select: { id: true, email: true, name: true, inviteStatus: true },
  });

  if (!user || user.inviteStatus !== 'pending') {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  }

  return NextResponse.json({ email: user.email, name: user.name });
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const body = await req.json();
  const validated = validateBody(inviteAcceptSchema, body);
  if (!validated.success) return validated.response;
  const { password } = validated.data;

  const user = await prisma.user.findUnique({
    where: { inviteToken: params.token },
  });

  if (!user || user.inviteStatus !== 'pending') {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      inviteToken: null,
      inviteStatus: 'active',
    },
  });

  return NextResponse.json({ success: true, email: user.email });
}
