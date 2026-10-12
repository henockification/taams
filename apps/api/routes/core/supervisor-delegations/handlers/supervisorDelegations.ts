import { Context } from 'hono';
import { CreateSupervisorDelegationRequestSchema } from '../../../../schemas/core.schema';
import type { Employee } from '../../../../types/core.types';
import {
  createSupervisorDelegation,
  getEligibleSupervisorDelegates,
  getManagedEmployeeIdsForSupervisorUser,
  getSupervisorDelegationsForUser,
  revokeSupervisorDelegation,
} from '../../../../db/orm/core/manageSupervisorDelegations';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getUserRoleNames } from '../../../../db/orm/rbac/manageRbac';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatEmployee, formatSupervisorDelegation } from '../../helpers/formatters';
import { safeEnqueueWorkflowNotification } from '../../../../lib/notifications';

export async function getSupervisorDelegationsHandler(c: Context) {
  try {
    const session = await getRequiredSession(c);
    const supervisorDelegations = await getSupervisorDelegationsForUser(session.user.id);

    return c.json({
      success: true,
      supervisorDelegations: supervisorDelegations.map(formatSupervisorDelegation),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch supervisor delegations');
  }
}

export async function getEligibleSupervisorDelegatesHandler(c: Context) {
  try {
    const session = await getRequiredSession(c);
    await assertCanManageDelegations(session.user.id, session.user.role ?? []);
    const employees = await getEligibleSupervisorDelegates(session.user.id);

    return c.json({
      success: true,
      employees: employees.map((employee: Employee) => formatEmployee(employee)),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch eligible supervisor delegates');
  }
}

export async function createSupervisorDelegationHandler(c: Context) {
  try {
    const session = await getRequiredSession(c);
    const parsed = CreateSupervisorDelegationRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    await assertCanManageDelegations(session.user.id, session.user.role ?? []);

    const { supervisorDelegation, revokedDelegations } = await createSupervisorDelegation({
      supervisorUserId: session.user.id,
      delegateEmployeeId: parsed.data.delegateEmployeeId,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      createdBy: session.user.id,
    });
    if (!supervisorDelegation) throw new Error('Failed to create supervisor delegation');

    // A new delegation replaces any active one; announce the end of those first.
    await Promise.all(revokedDelegations.map((delegation: any) => notifyDelegationChange(delegation, 'REVOKED', session.user, {
      replacedByDelegationId: supervisorDelegation.id,
    })));
    await notifyDelegationChange(supervisorDelegation, 'ASSIGNED', session.user);

    return c.json({
      success: true,
      supervisorDelegation: formatSupervisorDelegation(supervisorDelegation),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create supervisor delegation');
  }
}

export async function revokeSupervisorDelegationHandler(c: Context) {
  try {
    const session = await getRequiredSession(c);
    const { supervisorDelegation, didRevoke } = await revokeSupervisorDelegation(c.req.param('id'), session.user.id);
    if (!supervisorDelegation) throw new Error('Delegation not found');
    if (didRevoke) {
      await notifyDelegationChange(supervisorDelegation, 'REVOKED', session.user);
    }

    return c.json({
      success: true,
      supervisorDelegation: formatSupervisorDelegation(supervisorDelegation),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to revoke supervisor delegation');
  }
}

/**
 * Tells everyone affected by a delegation starting or ending, by email and SMS:
 * the delegate, the delegating supervisor's direct reports (whose approvals move),
 * and the delegating supervisor's own supervisor.
 */
async function notifyDelegationChange(
  delegation: any,
  change: 'ASSIGNED' | 'REVOKED',
  actor: { id: string; name?: string | null },
  extraMetadata: Record<string, unknown> = {},
) {
  const base = {
    entityId: delegation.id,
    actorUserId: actor.id,
    actorName: actor.name ?? null,
    delegatingSupervisorName: delegation.supervisorUser?.name ?? employeeName(delegation.supervisorEmployee) ?? actor.name ?? null,
    delegateName: employeeName(delegation.delegateEmployee) ?? delegation.delegateUser?.name ?? null,
    dateFrom: toIsoString(delegation.startsAt),
    dateTo: toIsoString(delegation.endsAt),
    metadata: {
      supervisorUserId: delegation.supervisorUserId,
      supervisorEmployeeId: delegation.supervisorEmployeeId,
      delegateEmployeeId: delegation.delegateEmployeeId,
      ...extraMetadata,
    },
  };
  await Promise.all([
    safeEnqueueWorkflowNotification(`SUPERVISOR_DELEGATION_${change}`, { ...base, employeeId: delegation.delegateEmployeeId }),
    safeEnqueueWorkflowNotification(`SUPERVISOR_DELEGATION_${change}_TEAM`, { ...base, employeeId: delegation.supervisorEmployeeId }),
    safeEnqueueWorkflowNotification(`SUPERVISOR_DELEGATION_${change}_MANAGER`, { ...base, employeeId: delegation.supervisorEmployeeId }),
  ]);
}

function employeeName(employee?: { firstNameEn?: string | null; middleNameEn?: string | null; lastNameEn?: string | null } | null) {
  const name = [employee?.firstNameEn, employee?.middleNameEn, employee?.lastNameEn].filter(Boolean).join(' ');
  return name || null;
}

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : value;
}

async function getRequiredSession(c: Context) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');
  const session = await getSessionByToken(token);
  if (!session) throw new Error('Authentication required');
  return session;
}

async function assertCanManageDelegations(userId: string, sessionRoles: string[]) {
  const assignedRoles = await getUserRoleNames(userId);
  const roles = new Set([...sessionRoles, ...assignedRoles].map((role) => role.toLowerCase()));
  const isSupervisorRole = ['supervisor', 'admin', 'super_admin', 'superadmin'].some((role) => roles.has(role));
  const managedEmployeeIds = await getManagedEmployeeIdsForSupervisorUser(userId, [...roles]);

  if (!isSupervisorRole && managedEmployeeIds.length === 0) {
    throw new Error('Only supervisors can manage delegations');
  }
}
