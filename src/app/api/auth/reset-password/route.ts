import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { passwordResetToken: token },
    select: { id: true, email: true, name: true, passwordResetExpires: true },
  });

  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 404 });
  }

  return NextResponse.json({ email: user.email, name: user.name });
}

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password || password.length < 8) {
    return NextResponse.json({ error: 'Token and password (8+ characters) are required' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { passwordResetToken: token },
  });

  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 404 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  return NextResponse.json({ success: true });
}
