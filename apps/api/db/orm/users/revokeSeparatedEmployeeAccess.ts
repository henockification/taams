import { and, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { authSessions, roles, user, userRoles } from '../../schema';
import { SOURCE_EMPLOYMENT_STATUS } from '../../../lib/employees/employment-status';
import { writeAuditEvents } from '../../../lib/audit';
import { hasSuperAdminRole } from '../../../lib/privileged-roles';

type DbClient = typeof db | any;

export type EmployeeStatusChange = {
  userId?: string | null;
  /** Status before the change; null/undefined for a newly created employee. */
  previousStatus?: string | null;
  nextStatus?: string | null;
};

/** An employee leaving work (resigned, retired, deceased) whose login must stop. */
export function isSeparationChange(change: EmployeeStatusChange) {
  return Boolean(
    change.userId
    && change.nextStatus
    && change.nextStatus !== SOURCE_EMPLOYMENT_STATUS.WORKING
    && change.previousStatus !== change.nextStatus
    && (change.previousStatus == null || change.previousStatus === SOURCE_EMPLOYMENT_STATUS.WORKING),
  );
}

/**
 * Revokes system access for employees who stopped working, ending their sessions.
 * Super admins are skipped so an HR status change or import can never lock out the
 * system administrator; a super admin can still revoke such an account manually.
 */
export async function revokeSeparatedEmployeeAccess(changes: EmployeeStatusChange[], tx: DbClient = db) {
  const statusByUserId = new Map<string, string>();
  for (const change of changes) {
    if (isSeparationChange(change)) statusByUserId.set(change.userId!, change.nextStatus!);
  }
  if (statusByUserId.size === 0) return [];

  const candidates = await tx.query.user.findMany({
    where: and(inArray(user.id, [...statusByUserId.keys()]), isNull(user.accessRevokedAt)),
    columns: { id: true, role: true },
  });
  const assignedRoles = candidates.length === 0 ? [] : await tx
    .select({ userId: userRoles.userId, name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(inArray(userRoles.userId, candidates.map((candidate: { id: string }) => candidate.id)));
  const targets = candidates.filter((candidate: { id: string; role: string[] | null }) => !hasSuperAdminRole([
    ...(candidate.role ?? []),
    ...assignedRoles.filter((row: { userId: string }) => row.userId === candidate.id).map((row: { name: string }) => row.name),
  ]));
  if (targets.length === 0) return [];

  const now = new Date();
  const revoked: Array<{ id: string; email: string | null; phone: string | null; accessRevokedReason: string | null }> = [];
  for (const target of targets) {
    const status = statusByUserId.get(target.id)!;
    const [row] = await tx.update(user).set({
      accessRevokedAt: now,
      accessRevokedBy: null,
      accessRevokedReason: `Employment status changed to ${status}`,
      updatedAt: now,
    }).where(and(eq(user.id, target.id), isNull(user.accessRevokedAt)))
      .returning({ id: user.id, email: user.email, phone: user.phone, accessRevokedReason: user.accessRevokedReason });
    if (row) revoked.push(row);
  }
  if (revoked.length === 0) return [];

  await tx.delete(authSessions).where(inArray(authSessions.userId, revoked.map((row) => row.id)));
  await writeAuditEvents(tx, revoked.map((row) => ({
    action: 'USER_ACCESS_REVOKED' as const,
    resourceType: 'user',
    resourceId: row.id,
    resourceLabel: row.email ?? row.phone ?? row.id,
    metadata: { reason: row.accessRevokedReason, automatic: true, employmentStatus: statusByUserId.get(row.id) },
  })));
  return revoked.map((row) => row.id);
}
