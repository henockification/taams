import { Context } from 'hono';
import { sendOtp } from '../../../lib/otp';

export async function sendVerificationOtpHandler(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';

  if (email) {
    await sendOtp(email, 'email-verification');
  }

  return c.json({ success: true });
}
