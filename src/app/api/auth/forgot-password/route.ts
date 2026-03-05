import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAppBaseUrl } from '@/lib/access';
import { sendPasswordResetEmail } from '@/lib/email';
import { randomBytes } from 'crypto';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { hashToken } from '@/lib/token-hash';
import { forgotPasswordSchema, validateBody } from '@/lib/schemas';

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 3 requests per IP per 15 minutes
    const ip = getClientIp(req.headers);
    const rl = checkRateLimit({ key: `forgot-pwd:${ip}`, limit: 3, windowMs: 15 * 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } }
      );
    }

    const body = await req.json();
    const validated = validateBody(forgotPasswordSchema, body);
    if (!validated.success) return validated.response;

    const { email } = validated.data;

    // Always return success to prevent email enumeration
    const successResponse = NextResponse.json({
      message: 'If an account with that email exists, a password reset link has been sent.',
    });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.inviteStatus === 'pending') {
      return successResponse;
    }

    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashToken(token),
        passwordResetExpires: expires,
      },
    });

    const baseUrl = getAppBaseUrl(req.headers);
    const resetUrl = `${baseUrl}/reset-password/${token}`;

    if (process.env.RESEND_API_KEY) {
      try {
        await sendPasswordResetEmail(user.email, user.name, resetUrl);
      } catch (err) {
        console.error('Failed to send password reset email:', err);
      }
    }

    return successResponse;
  } catch (err) {
    console.error('Forgot password error:', err);
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
