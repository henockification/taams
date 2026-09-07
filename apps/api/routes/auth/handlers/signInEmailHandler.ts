import { Context } from 'hono';
import { db } from '../../../db/db';
import {
  authenticateEmailPassword,
  createOtpVerification,
  createSessionForUser,
  verifyOtpForPurpose,
} from '../../../db/orm/auth/manageAuth';
import { writeAuditEvent } from '../../../lib/audit';
import { isOtpTestingMode, sendOtp } from '../../../lib/otp';
import { getRequestClientIp } from '../../../middleware/auth';
import { formatAuthUser, setSessionCookie } from './helpers';

const INVALID_CREDENTIALS = 'Invalid email or password';

export async function signInEmailHandler(c: Context) {
  try {
    const body = await c.req.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

    if (!email || !password) {
      return c.json({ message: INVALID_CREDENTIALS }, 400);
    }

    const authResult = await authenticateEmailPassword(email, password);

    if (!authResult.success) {
      await writeAuditEvent(db, {
        action: 'AUTH_SIGN_IN',
        outcome: 'FAILED',
        resourceType: 'auth_session',
        resourceLabel: email,
        actorEmail: email,
        actorType: 'USER',
        ipAddress: getRequestClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
        requestId: c.get('requestId') ?? null,
        metadata: { reason: authResult.reason },
      });
      return c.json({ message: INVALID_CREDENTIALS }, 401);
    }

    if (!otp) {
      const { code } = await createOtpVerification(email, 'sign-in');
      await sendOtp(email, 'sign-in', code);
      return c.json({
        otpRequired: true,
        email,
        ...(isOtpTestingMode() ? { testingMode: true } : {}),
      });
    }

    const verification = await verifyOtpForPurpose(email, 'sign-in', otp);
    if (!verification.success) {
      await writeAuditEvent(db, {
        action: 'AUTH_SIGN_IN',
        outcome: 'FAILED',
        resourceType: 'auth_session',
        resourceLabel: email,
        actorUserId: authResult.user.id,
        actorName: authResult.user.name,
        actorEmail: email,
        actorType: 'USER',
        ipAddress: getRequestClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
        requestId: c.get('requestId') ?? null,
        metadata: { reason: verification.code },
      });
      return c.json({ message: 'Invalid verification code', code: verification.code }, 401);
    }

    const session = await createSessionForUser({
      userId: authResult.user.id,
      ipAddress: getRequestClientIp(c) ?? undefined,
      userAgent: c.req.header('user-agent') ?? undefined,
    });

    await writeAuditEvent(db, {
      action: 'AUTH_SIGN_IN',
      resourceType: 'auth_session',
      resourceId: session.id,
      resourceLabel: authResult.user.email,
      actorUserId: authResult.user.id,
      actorName: authResult.user.name,
      actorEmail: authResult.user.email,
      actorType: 'USER',
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      requestId: c.get('requestId') ?? null,
    });

    setSessionCookie(c, session.token, session.expiresAt);

    return c.json({
      redirect: !!body.callbackURL,
      url: body.callbackURL ?? null,
      user: formatAuthUser(authResult.user),
    });
  } catch (error) {
    console.error('Sign in failed', error);
    return c.json({ message: 'Sign in failed' }, 500);
  }
}
