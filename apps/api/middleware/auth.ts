import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionByToken } from '../db/orm/auth/manageAuth';
import { runWithAuditContext } from '../lib/audit';
import { SESSION_COOKIE_NAME } from '../routes/auth/handlers/helpers';

const PUBLIC_API_PREFIXES = [
  '/api/auth',
  '/api/docs',
  '/api/openapi.json',
  '/api/zkteco',
];

declare module 'hono' {
  interface ContextVariableMap {
    user: any;
    session: any;
    requestId: string;
  }

  interface Context {
    user?: any;
    session?: any;
  }
}

export function isPublicApiPath(path: string) {
  return PUBLIC_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function getRequestClientIp(c: Context) {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || null;
}

export function attachAuthContext(c: Context, session: any) {
  c.user = session.user;
  c.session = session;
  c.set('user', session.user);
  c.set('session', session);
}

export async function requireAuth(c: Context, next: Next) {
  try {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    const session = token ? await getSessionByToken(token) : null;

    if (!session) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    attachAuthContext(c, session);

    const requestId = c.get('requestId') ?? c.req.header('x-request-id') ?? crypto.randomUUID();
    return runWithAuditContext({
      actorUserId: session.user?.id ?? null,
      actorName: session.user?.name ?? null,
      actorEmail: session.user?.email ?? null,
      actorType: 'USER',
      ipAddress: session.ipAddress ?? getRequestClientIp(c),
      userAgent: session.userAgent ?? c.req.header('user-agent') ?? null,
      requestId,
    }, () => next());
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({
      success: false,
      error: 'Invalid authentication',
    }, 401);
  }
}

export async function requireAuthUnlessPublic(c: Context, next: Next) {
  if (c.req.method === 'OPTIONS' || isPublicApiPath(c.req.path)) {
    return next();
  }
  return requireAuth(c, next);
}

export async function optionalAuth(c: Context, next: Next) {
  try {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    const session = token ? await getSessionByToken(token) : null;

    if (session) {
      attachAuthContext(c, session);
      const requestId = c.get('requestId') ?? c.req.header('x-request-id') ?? crypto.randomUUID();
      return runWithAuditContext({
        actorUserId: session.user?.id ?? null,
        actorName: session.user?.name ?? null,
        actorEmail: session.user?.email ?? null,
        actorType: 'USER',
        ipAddress: session.ipAddress ?? getRequestClientIp(c),
        userAgent: session.userAgent ?? c.req.header('user-agent') ?? null,
        requestId,
      }, () => next());
    }

    await next();
  } catch (error) {
    await next();
  }
}
