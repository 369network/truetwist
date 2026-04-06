import { Resend } from 'resend';

function getResend() {
  return new Resend(process.env.RESEND_API_KEY || '');
}

const FROM_EMAIL = 'TrueTwist <noreply@truetwist.com>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Reset your TrueTwist password',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 16px;">Reset your password</h1>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
          We received a request to reset the password for your TrueTwist account. Click the button below to choose a new password.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Reset Password
        </a>
        <p style="font-size: 14px; color: #9ca3af; margin-top: 32px; line-height: 1.5;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: 'Welcome to TrueTwist!',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #111827; margin-bottom: 16px;">Welcome to TrueTwist, ${name}!</h1>
        <p style="font-size: 16px; color: #4b5563; line-height: 1.6; margin-bottom: 24px;">
          Your account is ready. Start connecting your social accounts and let AI help you create viral content.
        </p>
        <a href="${APP_URL}/dashboard" style="display: inline-block; background: #6366f1; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Get Started
        </a>
      </div>
    `,
  });
}
