import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import { db } from '../db/db';
import { getSessionByToken } from '../db/orm/auth/manageAuth';
import { hasActiveSupervisorDelegation } from '../db/orm/core/manageSupervisorDelegations';
import { getUserPermissionNames } from '../db/orm/rbac/manageRbac';
import { runWithAuditContext, writeAuditEvent } from '../lib/audit';
import { hasSuperAdminRole } from '../lib/privileged-roles';
import { attachAuthContext, getRequestClientIp } from './auth';
import { SESSION_COOKIE_NAME } from '../routes/auth/handlers/helpers';

type RequirePermissionOptions = {
  allowDelegation?: boolean;
};

export function requirePermission(...permissionNames: string[]) {
  return createPermissionMiddleware(permissionNames);
}

export function requirePermissionOrDelegation(...permissionNames: string[]) {
  return createPermissionMiddleware(permissionNames, { allowDelegation: true });
}

function createPermissionMiddleware(permissionNames: string[], options: RequirePermissionOptions = {}) {
  const required = permissionNames.filter(Boolean);

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

    const unrestricted = hasSuperAdminRole(session.user.role);
    const permissions = unrestricted ? required : await getUserPermissionNames(session.user.id);
    const hasPermission = unrestricted || required.some((permissionName) => permissions.includes(permissionName));
    const allowed = hasPermission
      || (options.allowDelegation ? await hasActiveSupervisorDelegation(session.user.id) : false);

    if (!allowed) {
      await writeAuditEvent(db, {
        action: 'PERMISSION_DENIED',
        outcome: 'DENIED',
        resourceType: 'permission',
        resourceId: required[0] ?? 'unknown',
        resourceLabel: required.join(', '),
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
          required,
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
