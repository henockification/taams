import { Context } from 'hono';
import { db } from '../../../db/db';
import {
  findUserByIdentifier,
  revokeUserSessions,
  setUserPassword,
  verifyOtpForPurpose,
} from '../../../db/orm/auth/manageAuth';
import { writeAuditEvent } from '../../../lib/audit';
import { parseLoginIdentifier } from '../../../lib/login-identifier';
import { assertPasswordPolicy } from '../../../lib/password-policy';
import { getRequestClientIp } from '../../../middleware/auth';

export async function resetPasswordHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = parseLoginIdentifier(body);
    const otp = typeof body.otp === 'string' ? body.otp : typeof body.token === 'string' ? body.token : '';
    const newPassword =
      typeof body.newPassword === 'string'
        ? body.newPassword
        : typeof body.password === 'string'
          ? body.password
          : '';

    if (!parsed || !otp || !newPassword) {
      return c.json({ message: 'Email or phone, OTP, and new password are required' }, 400);
    }

    try {
      assertPasswordPolicy(newPassword, parsed.email);
    } catch (error) {
      return c.json({
        message: error instanceof Error ? error.message : 'Password does not meet requirements',
      }, 400);
    }

    const foundUser = await findUserByIdentifier(parsed);

    if (!foundUser) {
      return c.json({ message: 'Invalid reset request' }, 400);
    }

    const verification = await verifyOtpForPurpose(parsed.identifier, 'password-reset', otp);

    if (!verification.success) {
      await writeAuditEvent(db, {
        action: 'AUTH_PASSWORD_RESET',
        outcome: 'FAILED',
        resourceType: 'user',
        resourceId: foundUser.id,
        resourceLabel: parsed.identifier,
        actorUserId: foundUser.id,
        actorName: foundUser.name,
        actorEmail: foundUser.email,
        actorType: 'USER',
        ipAddress: getRequestClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
        requestId: c.get('requestId') ?? null,
        metadata: { reason: verification.code },
      });
      return c.json({
        message: 'Invalid verification code',
        code: verification.code,
      }, 400);
    }

    await setUserPassword(foundUser.id, newPassword);
    await revokeUserSessions(foundUser.id);
    await writeAuditEvent(db, {
      action: 'AUTH_PASSWORD_RESET',
      resourceType: 'user',
      resourceId: foundUser.id,
      resourceLabel: parsed.identifier,
      actorUserId: foundUser.id,
      actorName: foundUser.name,
      actorEmail: foundUser.email,
      actorType: 'USER',
      ipAddress: getRequestClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
      requestId: c.get('requestId') ?? null,
    });
    await writeAuditEvent(db, {
      action: 'AUTH_SESSIONS_REVOKED',
      resourceType: 'user',
      resourceId: foundUser.id,
      resourceLabel: parsed.identifier,
      actorUserId: foundUser.id,
      actorName: foundUser.name,
      actorEmail: foundUser.email,
      actorType: 'USER',
      ipAddress: getRequestClientIp(c),
      userAgent: c.req.header('user-agent') ?? null,
      requestId: c.get('requestId') ?? null,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('Failed to reset password', error);
    return c.json({ message: 'Failed to reset password' }, 500);
  }
}
