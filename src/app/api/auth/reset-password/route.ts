import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { hashToken } from '@/lib/token-hash';
import { resetPasswordSchema, validateBody } from '@/lib/schemas';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }

    const tokenHash = hashToken(token);
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: tokenHash },
      select: { id: true, email: true, name: true, passwordResetExpires: true },
    });

    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      return NextResponse.json({ error: 'Invalid or expired reset link' }, { status: 404 });
    }

    return NextResponse.json({ email: user.email, name: user.name });
  } catch (err) {
    console.error('Reset password GET error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = validateBody(resetPasswordSchema, body);
    if (!validated.success) return validated.response;

    const { token, password } = validated.data;

    const tokenHash = hashToken(token);
    const user = await prisma.user.findUnique({
      where: { passwordResetToken: tokenHash },
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
  } catch (err) {
    console.error('Reset password POST error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
