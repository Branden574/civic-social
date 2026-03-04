// ═══════════════════════════════════════════════════════════════
// Civic Social — Email sender (Resend)
// Falls back to console.log in development / when RESEND_API_KEY
// is not set so the app never crashes without email configured.
// ═══════════════════════════════════════════════════════════════

import { Resend } from 'resend';

const FROM_ADDRESS = process.env.RESEND_FROM ?? 'Civic Social <noreply@civicsocial.app>';

function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  return new Resend(process.env.RESEND_API_KEY);
}

interface SendResult {
  success: boolean;
  error?: string;
}

export async function sendPasswordResetEmail(
  toEmail: string,
  resetUrl: string,
): Promise<SendResult> {
  const resend = getResend();

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      <h2 style="color:#1e293b;margin-bottom:8px;">Reset your password</h2>
      <p style="color:#475569;margin-bottom:24px;">
        We received a request to reset the password for your Civic Social account.
        Click the button below to choose a new password. This link expires in 1 hour.
      </p>
      <a href="${resetUrl}"
         style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Reset Password
      </a>
      <p style="color:#94a3b8;font-size:13px;margin-top:32px;">
        If you didn't request a password reset, you can safely ignore this email.
        Your password won't change.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
      <p style="color:#cbd5e1;font-size:12px;">
        Civic Social &mdash; civic engagement, reinvented.
      </p>
    </div>
  `;

  if (!resend) {
    // Dev fallback: log to console
    console.log('[email] Password reset email (no RESEND_API_KEY configured)');
    console.log(`  To: ${toEmail}`);
    console.log(`  Reset URL: ${resetUrl}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: toEmail,
      subject: 'Reset your Civic Social password',
      html,
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[email] Unexpected error:', err);
    return { success: false, error: 'Failed to send email.' };
  }
}

export async function sendVerificationEmail(
  toEmail: string,
  verifyUrl: string,
): Promise<SendResult> {
  const resend = getResend();

  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
      <h2 style="color:#1e293b;margin-bottom:8px;">Verify your email</h2>
      <p style="color:#475569;margin-bottom:24px;">
        Welcome to Civic Social! Please verify your email address by clicking
        the button below. This link expires in 24 hours.
      </p>
      <a href="${verifyUrl}"
         style="display:inline-block;background:#3b82f6;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">
        Verify Email
      </a>
      <p style="color:#94a3b8;font-size:13px;margin-top:32px;">
        If you didn't create a Civic Social account, you can safely ignore this email.
      </p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:32px 0;" />
      <p style="color:#cbd5e1;font-size:12px;">
        Civic Social &mdash; civic engagement, reinvented.
      </p>
    </div>
  `;

  if (!resend) {
    console.log('[email] Verification email (no RESEND_API_KEY configured)');
    console.log(`  To: ${toEmail}`);
    console.log(`  Verify URL: ${verifyUrl}`);
    return { success: true };
  }

  try {
    const { error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: toEmail,
      subject: 'Verify your Civic Social email',
      html,
    });

    if (error) {
      console.error('[email] Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[email] Unexpected error:', err);
    return { success: false, error: 'Failed to send email.' };
  }
}
