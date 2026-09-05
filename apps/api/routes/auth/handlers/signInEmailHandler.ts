import { Context } from 'hono';
import { db } from '../../../db/db';
import {
  authenticateEmailPassword,
  createOtpVerification,
  createSessionForUser,
  verifyOtpForPurpose,
} from '../../../db/orm/auth/manageAuth';
import { writeAuditEvent } from '../../../lib/audit';
import { sendOtp } from '../../../lib/otp';
import { workflowNotificationsAreEnabled } from '../../../lib/notifications';
import { getRequestClientIp } from '../../../middleware/auth';
import { formatAuthUser, setSessionCookie } from './helpers';

export async function signInEmailHandler(c: Context) {
  try {
    const body = await c.req.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

    if (!email || !password) {
      return c.json({ message: 'Invalid email or password' }, 400);
    }

    const authResult = await authenticateEmailPassword(email, password);

    if (!authResult.success) {
      await writeAuditEvent(db, {
        action: 'AUTH_SIGN_IN',
        outcome: 'FAILED',
        resourceType: 'auth_session',
        resourceLabel: email,
        actorUserId: authResult.reason === 'PASSWORD_NOT_SET' ? authResult.user?.id ?? null : null,
        actorName: authResult.reason === 'PASSWORD_NOT_SET' ? authResult.user?.name ?? null : null,
        actorEmail: email,
        actorType: 'USER',
        ipAddress: getRequestClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
        requestId: c.get('requestId') ?? null,
        metadata: { reason: authResult.reason },
      });
      const message =
        authResult.reason === 'PASSWORD_NOT_SET'
          ? 'Password has not been set. Please reset your password to continue.'
          : 'Invalid email or password';

      return c.json({ message, code: authResult.reason }, 401);
    }

    if (!otp) {
      const { code } = await createOtpVerification(email, 'sign-in');
      await sendOtp(email, 'sign-in', code);
      return c.json({
        otpRequired: true,
        email,
        testingMode: !workflowNotificationsAreEnabled(),
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
      token: session.token,
      url: body.callbackURL ?? null,
      user: formatAuthUser(authResult.user),
    });
  } catch (error) {
    return c.json({
      message: 'Sign in failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}
