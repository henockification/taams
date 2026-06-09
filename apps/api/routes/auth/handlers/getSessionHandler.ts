import { Context } from 'hono';
import { getSessionByToken } from '../../../db/orm/auth/manageAuth';
import { getUserPermissionNames } from '../../../db/orm/rbac/manageRbac';
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

  return c.json({
    session: formatAuthSession(session),
    user: {
      ...formatAuthUser(session.user),
      permissions,
    },
  });
}
