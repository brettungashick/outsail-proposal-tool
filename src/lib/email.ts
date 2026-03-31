import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend() {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY || '');
  }
  return _resend;
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'OutSail <onboarding@resend.dev>';

export async function sendInviteEmail(to: string, name: string, inviteUrl: string) {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "You've been invited to OutSail Proposal Analyzer",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 24px; font-weight: 700; color: #082f69;">Out</span><span style="font-size: 24px; font-weight: 700; color: #4277c7;">Sail</span>
        </div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
          <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 8px;">Welcome, ${name}!</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            You've been invited to join OutSail's Proposal Analysis Tool. Click the button below to set up your password and get started.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${inviteUrl}" style="display: inline-block; background: #0052cc; color: #ffffff; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none;">
              Set Up Your Account
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 24px 0 0;">
            If the button doesn't work, copy and paste this link into your browser:<br/>
            <a href="${inviteUrl}" style="color: #4277c7; word-break: break-all;">${inviteUrl}</a>
          </p>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
          OutSail Proposal Analyzer
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  await getResend().emails.send({
    from: FROM_ADDRESS,
    to,
    subject: 'Reset your OutSail password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 0;">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 24px; font-weight: 700; color: #082f69;">Out</span><span style="font-size: 24px; font-weight: 700; color: #4277c7;">Sail</span>
        </div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
          <h2 style="color: #0f172a; font-size: 20px; margin: 0 0 8px;">Password Reset</h2>
          <p style="color: #64748b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
            Hi ${name}, we received a request to reset your password. Click the button below to choose a new one. This link expires in 1 hour.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${resetUrl}" style="display: inline-block; background: #0052cc; color: #ffffff; padding: 12px 32px; border-radius: 8px; font-size: 14px; font-weight: 600; text-decoration: none;">
              Reset Password
            </a>
          </div>
          <p style="color: #94a3b8; font-size: 12px; line-height: 1.5; margin: 24px 0 0;">
            If you didn't request this, you can safely ignore this email.<br/><br/>
            If the button doesn't work, copy and paste this link:<br/>
            <a href="${resetUrl}" style="color: #4277c7; word-break: break-all;">${resetUrl}</a>
          </p>
        </div>
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 16px;">
          OutSail Proposal Analyzer
        </p>
      </div>
    `,
  });
}
