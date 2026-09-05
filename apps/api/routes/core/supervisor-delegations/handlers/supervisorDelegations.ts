import { Context } from 'hono';
import { CreateSupervisorDelegationRequestSchema } from '../../../../schemas/core.schema';
import {
  createSupervisorDelegation,
  getManagedEmployeeIdsForSupervisorUser,
  getSupervisorDelegationsForUser,
  revokeSupervisorDelegation,
} from '../../../../db/orm/core/manageSupervisorDelegations';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getUserRoleNames } from '../../../../db/orm/rbac/manageRbac';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatSupervisorDelegation } from '../../helpers/formatters';
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

    await Promise.all([
      safeEnqueueWorkflowNotification('SUPERVISOR_DELEGATION_ASSIGNED', {
        entityId: supervisorDelegation.id,
        employeeId: supervisorDelegation.delegateEmployeeId,
        actorUserId: session.user.id,
        actorName: session.user.name,
        delegatingSupervisorName: supervisorDelegation.supervisorUser?.name ?? session.user.name,
        dateFrom: toIsoString(supervisorDelegation.startsAt),
        dateTo: toIsoString(supervisorDelegation.endsAt),
        metadata: { supervisorUserId: supervisorDelegation.supervisorUserId },
      }, { channels: ['EMAIL'] }),
      ...revokedDelegations.map((delegation: any) => safeEnqueueWorkflowNotification('SUPERVISOR_DELEGATION_REVOKED', {
        entityId: delegation.id,
        employeeId: delegation.delegateEmployeeId,
        actorUserId: session.user.id,
        actorName: session.user.name,
        delegatingSupervisorName: delegation.supervisorUser?.name ?? session.user.name,
        dateFrom: toIsoString(delegation.startsAt),
        dateTo: toIsoString(delegation.endsAt),
        metadata: { supervisorUserId: delegation.supervisorUserId, replacedByDelegationId: supervisorDelegation.id },
      }, { channels: ['EMAIL'] })),
    ]);

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
      await safeEnqueueWorkflowNotification('SUPERVISOR_DELEGATION_REVOKED', {
        entityId: supervisorDelegation.id,
        employeeId: supervisorDelegation.delegateEmployeeId,
        actorUserId: session.user.id,
        actorName: session.user.name,
        delegatingSupervisorName: supervisorDelegation.supervisorUser?.name ?? session.user.name,
        dateFrom: toIsoString(supervisorDelegation.startsAt),
        dateTo: toIsoString(supervisorDelegation.endsAt),
        metadata: { supervisorUserId: supervisorDelegation.supervisorUserId },
      }, { channels: ['EMAIL'] });
    }

    return c.json({
      success: true,
      supervisorDelegation: formatSupervisorDelegation(supervisorDelegation),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to revoke supervisor delegation');
  }
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
