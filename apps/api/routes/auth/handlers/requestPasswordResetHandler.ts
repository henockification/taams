import { Context } from 'hono';
import { db } from '../../../db/db';
import { createPasswordResetVerification, findUserByIdentifier } from '../../../db/orm/auth/manageAuth';
import { writeAuditEvent } from '../../../lib/audit';
import { parseLoginIdentifier } from '../../../lib/login-identifier';
import { isOtpTestingMode, sendOtp } from '../../../lib/otp';
import { getRequestClientIp } from '../../../middleware/auth';

export async function requestPasswordResetHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = parseLoginIdentifier(body);

    if (!parsed) {
      return c.json({ message: 'Email or phone is required' }, 400);
    }

    const foundUser = await findUserByIdentifier(parsed);

    if (foundUser) {
      const identifier = parsed.identifier;
      const { code } = await createPasswordResetVerification(identifier);
      await sendOtp(identifier, 'password-reset', code);
    }

    await writeAuditEvent(db, {
      action: 'AUTH_PASSWORD_RESET_REQUESTED',
      resourceType: 'user',
      resourceId: foundUser?.id ?? null,
      resourceLabel: parsed.identifier,
      actorUserId: foundUser?.id ?? null,
      actorName: foundUser?.name ?? null,
      actorEmail: foundUser?.email ?? parsed.email ?? null,
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
