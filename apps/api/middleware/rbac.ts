import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { db } from '../db/db';
import { getSessionByToken } from '../db/orm/auth/manageAuth';
import { userHasPermission } from '../db/orm/rbac/manageRbac';
import { runWithAuditContext, writeAuditEvent } from '../lib/audit';
import { attachAuthContext, getRequestClientIp } from './auth';
import { SESSION_COOKIE_NAME } from '../routes/auth/handlers/helpers';

export function requirePermission(permissionName: string) {
  return createMiddleware(async (c, next) => {
    let session = c.session ?? c.get('session');
    if (!session?.user?.id) {
      const token = getCookie(c, SESSION_COOKIE_NAME);
      session = token ? await getSessionByToken(token) : null;
    }

    if (!session?.user?.id) {
      return c.json({
        success: false,
        error: 'Authentication required',
      }, 401);
    }

    attachAuthContext(c, session);

    const allowed = await userHasPermission(session.user.id, permissionName);

    if (!allowed) {
      await writeAuditEvent(db, {
        action: 'PERMISSION_DENIED',
        outcome: 'DENIED',
        resourceType: 'permission',
        resourceId: permissionName,
        resourceLabel: permissionName,
        actorUserId: session.user.id,
        actorName: session.user.name,
        actorEmail: session.user.email,
        actorType: 'USER',
        ipAddress: session.ipAddress ?? getRequestClientIp(c),
        userAgent: session.userAgent ?? c.req.header('user-agent') ?? null,
        requestId: c.get('requestId') ?? c.req.header('x-request-id') ?? null,
        metadata: {
          path: c.req.path,
          method: c.req.method,
        },
      });
      return c.json({
        success: false,
        error: 'Permission denied',
      }, 403);
    }

    const requestId = c.get('requestId') ?? c.req.header('x-request-id') ?? crypto.randomUUID();
    return runWithAuditContext({
      actorUserId: session.user.id,
      actorName: session.user.name ?? null,
      actorEmail: session.user.email ?? null,
      actorType: 'USER',
      ipAddress: session.ipAddress ?? getRequestClientIp(c),
      userAgent: session.userAgent ?? c.req.header('user-agent') ?? null,
      requestId,
    }, () => next());
  });
}
