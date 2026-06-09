import { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { getSessionByToken } from '../db/orm/auth/manageAuth';
import { SESSION_COOKIE_NAME } from '../routes/auth/handlers/helpers';

// Extend Hono context with user/session info
declare module 'hono' {
  interface Context {
    user?: any;
    session?: any;
  }
}

export const requireAuth = async (c: Context, next: Next) => {
  try {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    const session = token ? await getSessionByToken(token) : null;

    if (!session) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    // Attach user and session to context
    c.user = session.user;
    c.session = session;
    
    await next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return c.json({
      success: false,
      error: 'Invalid authentication',
    }, 401);
  }
};

export const optionalAuth = async (c: Context, next: Next) => {
  try {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    const session = token ? await getSessionByToken(token) : null;

    if (session) {
      c.user = session.user;
      c.session = session;
    }
    
    await next();
  } catch (error) {
    // Continue without authentication if it fails
    await next();
  }
};
