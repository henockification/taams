import { Context } from 'hono';
import { authenticateEmailPassword, createSessionForUser } from '../../../db/orm/auth/manageAuth';
import { formatAuthUser, setSessionCookie } from './helpers';

export async function signInEmailHandler(c: Context) {
  try {
    const body = await c.req.json();
    const email = typeof body.email === 'string' ? body.email.toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return c.json({ message: 'Invalid email or password' }, 400);
    }

    const authResult = await authenticateEmailPassword(email, password);

    if (!authResult.success) {
      const message =
        authResult.reason === 'PASSWORD_NOT_SET'
          ? 'Password has not been set. Please reset your password to continue.'
          : 'Invalid email or password';

      return c.json({ message, code: authResult.reason }, 401);
    }

    const session = await createSessionForUser({
      userId: authResult.user.id,
      ipAddress: c.req.header('x-forwarded-for') ?? undefined,
      userAgent: c.req.header('user-agent') ?? undefined,
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
