import { Context } from 'hono';
import { db } from '../../../db/db';
import { createPasswordResetVerification, findUserByEmail } from '../../../db/orm/auth/manageAuth';
import { writeAuditEvent } from '../../../lib/audit';
import { isOtpTestingMode, sendOtp } from '../../../lib/otp';
import { getRequestClientIp } from '../../../middleware/auth';

export async function requestPasswordResetHandler(c: Context) {
  try {
    const body = await c.req.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';

    if (!email) {
      return c.json({ message: 'Email is required' }, 400);
    }

    const foundUser = await findUserByEmail(email);

    if (foundUser) {
      const { code } = await createPasswordResetVerification(email);
      await sendOtp(email, 'password-reset', code);
    }

    await writeAuditEvent(db, {
      action: 'AUTH_PASSWORD_RESET_REQUESTED',
      resourceType: 'user',
      resourceId: foundUser?.id ?? null,
      resourceLabel: email,
      actorUserId: foundUser?.id ?? null,
      actorName: foundUser?.name ?? null,
      actorEmail: email,
      actorType: 'USER',
      ipAddress: getRequestClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
      requestId: c.get('requestId') ?? null,
    });

    return c.json({
      success: true,
      ...(isOtpTestingMode() ? { testingMode: true } : {}),
    });
  } catch (error) {
    console.error('Failed to request password reset', error);
    return c.json({ message: 'Failed to request password reset' }, 500);
  }
}
