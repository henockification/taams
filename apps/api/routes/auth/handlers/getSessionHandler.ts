import { Context } from 'hono';
import { getEmployeeEmploymentTypeForUser, getSessionByToken } from '../../../db/orm/auth/manageAuth';
import { getActiveDelegatedSupervisorCapabilities } from '../../../db/orm/core/manageSupervisorDelegations';
import { getUserPermissionNames } from '../../../db/orm/rbac/manageRbac';
import { formatSupervisorDelegation } from '../../core/helpers/formatters';
import { clearSessionCookie, formatAuthSession, formatAuthUser, getSessionCookie } from './helpers';

export async function getSessionHandler(c: Context) {
  const token = getSessionCookie(c);

  if (!token) {
    return c.json(null);
  }

  const session = await getSessionByToken(token);

  if (!session) {
    clearSessionCookie(c);
    return c.json(null);
  }

  const permissions = await getUserPermissionNames(session.user.id);
  const delegatedSupervisorCapabilities = await getActiveDelegatedSupervisorCapabilities(session.user.id);
  const employeeEmploymentType = await getEmployeeEmploymentTypeForUser(session.user.id);

  return c.json({
    session: formatAuthSession(session),
    user: {
      ...formatAuthUser(session.user),
      permissions,
      employeeEmploymentType,
      delegatedSupervisorCapabilities: delegatedSupervisorCapabilities.map(formatSupervisorDelegation),
      hasDelegatedSupervisorAccess: delegatedSupervisorCapabilities.length > 0,
    },
  });
}
