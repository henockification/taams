import { Context } from 'hono';
import { db } from '../../../db/db';
import {
  authenticateIdentifierPassword,
  createOtpVerification,
  createSessionForUser,
  FAILED_LOGIN_LIMIT,
  LOCKOUT_MINUTES,
  verifyOtpForPurpose,
} from '../../../db/orm/auth/manageAuth';
import { writeAuditEvent } from '../../../lib/audit';
import { parseLoginIdentifier } from '../../../lib/login-identifier';
import { isOtpTestingMode, sendOtp } from '../../../lib/otp';
import { getRequestClientIp } from '../../../middleware/auth';
import { formatAuthUser, setSessionCookie } from './helpers';

export async function signInEmailHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = parseLoginIdentifier(body);
    const password = typeof body.password === 'string' ? body.password : '';
    const otp = typeof body.otp === 'string' ? body.otp.trim() : '';

    if (!parsed || !password) {
      return c.json({
        message: `Invalid email, phone, or password. You can try up to ${FAILED_LOGIN_LIMIT} times. After that the account is locked for ${LOCKOUT_MINUTES} minutes.`,
        code: 'INVALID_CREDENTIALS',
        maxAttempts: FAILED_LOGIN_LIMIT,
        lockoutMinutes: LOCKOUT_MINUTES,
      }, 400);
    }

    const authResult = await authenticateIdentifierPassword(parsed, password);

    if (!authResult.success) {
      await writeAuditEvent(db, {
        action: 'AUTH_SIGN_IN',
        outcome: 'FAILED',
        resourceType: 'auth_session',
        resourceLabel: parsed.identifier,
        actorEmail: parsed.email ?? null,
        actorType: 'USER',
        ipAddress: getRequestClientIp(c),
        userAgent: c.req.header('user-agent') ?? null,
        requestId: c.get('requestId') ?? null,
        metadata: { reason: authResult.reason, method: parsed.email ? 'email' : 'phone' },
      });
      const locked = authResult.reason === 'ACCOUNT_LOCKED';
      return c.json({
        message: locked
          ? `This account is locked after ${FAILED_LOGIN_LIMIT} failed attempts. Try again in ${LOCKOUT_MINUTES} minutes or ask an administrator to unlock it.`
          : `Invalid email, phone, or password. You can try up to ${FAILED_LOGIN_LIMIT} times. After that the account is locked for ${LOCKOUT_MINUTES} minutes.`,
        code: locked ? 'ACCOUNT_LOCKED' : 'INVALID_CREDENTIALS',
        maxAttempts: FAILED_LOGIN_LIMIT,
        lockoutMinutes: LOCKOUT_MINUTES,
      }, 401);
    }

    const identifier = authResult.identifier;

    if (!otp) {
      const { code } = await createOtpVerification(identifier, 'sign-in');
      await sendOtp(identifier, 'sign-in', code);
      return c.json({
        otpRequired: true,
        email: parsed.email ?? null,
        phone: parsed.phone ?? null,
        ...(isOtpTestingMode() ? { testingMode: true } : {}),
      });
    }

    const verification = await verifyOtpForPurpose(identifier, 'sign-in', otp);
    if (!verification.success) {
      await writeAuditEvent(db, {
        action: 'AUTH_SIGN_IN',
        outcome: 'FAILED',
        resourceType: 'auth_session',
        resourceLabel: identifier,
        actorUserId: authResult.user.id,
        actorName: authResult.user.name,
        actorEmail: authResult.user.email,
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
      resourceLabel: identifier,
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
