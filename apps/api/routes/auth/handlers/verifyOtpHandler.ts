import { Context } from 'hono';
import { verifyOtp } from '../../../lib/otp';

export async function verifyOtpHandler(c: Context) {
  const body = await c.req.json();
  const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';
  const otp = typeof body.otp === 'string' ? body.otp : '';

  if (!email || !otp) {
    return c.json({ message: 'Identifier and OTP are required', code: 'INVALID_OTP' }, 400);
  }

  if (!verifyOtp(otp)) {
    return c.json({ message: 'Invalid verification code', code: 'INVALID_OTP' }, 400);
  }

  return c.json({ success: true });
}
