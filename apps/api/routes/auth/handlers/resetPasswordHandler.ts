import { Context } from 'hono';
import {
  findUserByEmail,
  revokeUserSessions,
  setUserPassword,
  verifyOtpForPurpose,
} from '../../../db/orm/auth/manageAuth';

export async function resetPasswordHandler(c: Context) {
  try {
    const body = await c.req.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';
    const otp = typeof body.otp === 'string' ? body.otp : typeof body.token === 'string' ? body.token : '';
    const newPassword =
      typeof body.newPassword === 'string'
        ? body.newPassword
        : typeof body.password === 'string'
          ? body.password
          : '';

    if (!email || !otp || !newPassword) {
      return c.json({ message: 'Email, OTP, and new password are required' }, 400);
    }

    const foundUser = await findUserByEmail(email);

    if (!foundUser) {
      return c.json({ message: 'Invalid reset request' }, 400);
    }

    const verification = await verifyOtpForPurpose(email, 'password-reset', otp);

    if (!verification.success) {
      return c.json({
        message: 'Invalid verification code',
        code: verification.code,
      }, 400);
    }

    await setUserPassword(foundUser.id, newPassword);
    await revokeUserSessions(foundUser.id);

    return c.json({ success: true });
  } catch (error) {
    return c.json({
      message: 'Failed to reset password',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}
