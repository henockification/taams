import { Context, Next } from 'hono';
import { auth } from '../lib/auth';

// Extend Hono context with user/session info
declare module 'hono' {
  interface Context {
    user?: any;
    session?: any;
  }
}

export const requireAuth = async (c: Context, next: Next) => {
  try {
    // Get session from Better Auth
    const session = await auth.api.getSession({
      headers: c.req.raw.headers
    });

    if (!session) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    // Attach user and session to context
    c.user = session.user;
    c.session = session.session;
    
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
    // Get session from Better Auth (optional)
    const session = await auth.api.getSession({
      headers: c.req.header() as any,
    });

    if (session) {
      c.user = session.user;
      c.session = session.session;
    }
    
    await next();
  } catch (error) {
    // Continue without authentication if it fails
    await next();
  }
};
