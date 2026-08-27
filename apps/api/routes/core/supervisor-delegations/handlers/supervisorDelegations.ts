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

    const supervisorDelegation = await createSupervisorDelegation({
      supervisorUserId: session.user.id,
      delegateEmployeeId: parsed.data.delegateEmployeeId,
      startsAt: parsed.data.startsAt,
      endsAt: parsed.data.endsAt,
      createdBy: session.user.id,
    });

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
    const supervisorDelegation = await revokeSupervisorDelegation(c.req.param('id'), session.user.id);

    return c.json({
      success: true,
      supervisorDelegation: formatSupervisorDelegation(supervisorDelegation),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to revoke supervisor delegation');
  }
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
