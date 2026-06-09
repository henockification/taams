import { Context } from 'hono';
import { createPasswordResetVerification, findUserByEmail } from '../../../db/orm/auth/manageAuth';
import { sendOtp } from '../../../lib/otp';

export async function requestPasswordResetHandler(c: Context) {
  try {
    const body = await c.req.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';

    if (!email) {
      return c.json({ message: 'Email is required' }, 400);
    }

    const foundUser = await findUserByEmail(email);

    if (foundUser) {
      await createPasswordResetVerification(email);
      await sendOtp(email, 'password-reset');
    }

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      message: 'Failed to request password reset',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}
