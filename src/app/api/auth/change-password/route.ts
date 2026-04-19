import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/access';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { validateBody, changePasswordSchema } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = sessionUser.id;
    const body = await req.json();
    const validated = validateBody(changePasswordSchema, body);
    if (!validated.success) return validated.response;
    const { currentPassword, newPassword } = validated.data;

    // Look up by session ID first, fall back to email
    let user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user && sessionUser.email) {
      user = await prisma.user.findUnique({ where: { email: sessionUser.email.toLowerCase().trim() } });
    }
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Change password error:', err);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
