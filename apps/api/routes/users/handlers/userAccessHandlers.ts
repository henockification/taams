import { Context } from 'hono';
import { z } from 'zod';
import { db } from '../../../db/db';
import { restoreUserAccess, revokeUserAccess } from '../../../db/orm/auth/manageAuth';
import { getUserRoleNames } from '../../../db/orm/rbac/manageRbac';
import { writeAuditEvent } from '../../../lib/audit';
import { hasSuperAdminRole } from '../../../lib/privileged-roles';
import { formatUser } from '../../rbac/handlers/formatters';

const RevokeUserAccessSchema = z.object({
  reason: z.string().trim().max(500).optional().nullable(),
});

export async function revokeUserAccessHandler(c: Context) {
  try {
    const userId = c.req.param('id');
    const actor = c.get('user');
    if (!userId) return c.json({ success: false, error: 'User ID is required' }, 400);
    if (!actor?.id) return c.json({ success: false, error: 'Authentication required' }, 401);
    if (actor.id === userId) return c.json({ success: false, error: 'You cannot revoke your own access' }, 400);

    const parsed = RevokeUserAccessSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return c.json({ success: false, error: 'Invalid request payload', details: parsed.error.message }, 400);

    // Only a super admin may lock out another super admin.
    const target = await db.query.user.findFirst({ where: (table, { eq }) => eq(table.id, userId), columns: { role: true } });
    if (!target) return c.json({ success: false, error: 'User not found' }, 404);
    const targetRoles = [...(target.role ?? []), ...await getUserRoleNames(userId)];
    const actorRoles = [...(actor.role ?? []), ...await getUserRoleNames(actor.id)];
    if (hasSuperAdminRole(targetRoles) && !hasSuperAdminRole(actorRoles)) {
      return c.json({ success: false, error: 'Only a super admin can revoke a super admin\'s access' }, 403);
    }

    const revoked = await revokeUserAccess({ userId, actorUserId: actor.id, reason: parsed.data.reason });
    await writeAuditEvent(db, {
      action: 'USER_ACCESS_REVOKED',
      resourceType: 'user',
      resourceId: revoked.id,
      resourceLabel: revoked.email ?? revoked.phone ?? revoked.id,
      metadata: { reason: revoked.accessRevokedReason },
    });
    return c.json({ success: true, user: formatUser(revoked) });
  } catch (error) {
    return accessErrorResponse(c, error, 'Failed to revoke user access');
  }
}

export async function restoreUserAccessHandler(c: Context) {
  try {
    const userId = c.req.param('id');
    if (!userId) return c.json({ success: false, error: 'User ID is required' }, 400);

    const restored = await restoreUserAccess(userId);
    await writeAuditEvent(db, {
      action: 'USER_ACCESS_RESTORED',
      resourceType: 'user',
      resourceId: restored.id,
      resourceLabel: restored.email ?? restored.phone ?? restored.id,
    });
    return c.json({ success: true, user: formatUser(restored) });
  } catch (error) {
    return accessErrorResponse(c, error, 'Failed to restore user access');
  }
}

function accessErrorResponse(c: Context, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = message === 'User not found' ? 404 : message.includes('already revoked') || message.includes('not revoked') ? 409 : 500;
  if (status >= 500) console.error(fallback, error);
  return c.json({ success: false, error: status >= 500 ? fallback : message }, status);
}
