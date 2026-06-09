import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { getSessionByToken } from '../db/orm/auth/manageAuth';
import { userHasPermission } from '../db/orm/rbac/manageRbac';
import { SESSION_COOKIE_NAME } from '../routes/auth/handlers/helpers';

export function requirePermission(permissionName: string) {
  return createMiddleware(async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE_NAME);
    const session = token ? await getSessionByToken(token) : null;

    if (!session?.user?.id) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    const allowed = await userHasPermission(session.user.id, permissionName);

    if (!allowed) {
      return c.json({
        success: false,
        error: 'Permission denied',
      }, 403);
    }

    c.set('user', session.user);
    c.set('session', session);

    await next();
  });
}
