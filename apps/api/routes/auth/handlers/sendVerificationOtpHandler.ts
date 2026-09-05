import { Context } from 'hono';
import { createOtpVerification, findUserByEmail } from '../../../db/orm/auth/manageAuth';
import { sendOtp } from '../../../lib/otp';

export async function sendVerificationOtpHandler(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';

  if (email && await findUserByEmail(email)) {
    const { code } = await createOtpVerification(email, 'email-verification');
    await sendOtp(email, 'email-verification', code);
  }

  return c.json({ success: true });
}
