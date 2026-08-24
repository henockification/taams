import { Context } from 'hono';
import { getNotificationLogs } from '../../../../db/orm/core/manageNotifications';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getUserPermissionNames } from '../../../../db/orm/rbac/manageRbac';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse } from '../../helpers/errors';
import { formatNotificationLog } from '../../helpers/formatters';

export async function getNotificationLogsHandler(c: Context) {
  try {
    const session = await requireAuthenticatedUser(c);
    if (!await canReadNotificationLogs(session.user.id, session.user.role ?? [])) {
      return c.json({ success: false, error: 'You do not have permission to read notification logs' }, 403);
    }

    const notificationLogs = await getNotificationLogs({
      channel: c.req.query('channel'),
      status: c.req.query('status'),
      eventType: c.req.query('eventType'),
      recipient: c.req.query('recipient'),
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      limit: Number(c.req.query('limit') ?? 100),
    });

    return c.json({
      success: true,
      notificationLogs: notificationLogs.map(formatNotificationLog),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch notification logs');
  }
}

async function canReadNotificationLogs(userId: string, userRoles: string[]) {
  const normalizedRoles = userRoles.map((role) => role.toLowerCase());
  if (normalizedRoles.some((role) => [
    'super_admin',
    'superadmin',
    'admin',
    'executive',
    'human_resource',
  ].includes(role))) {
    return true;
  }

  const permissions = await getUserPermissionNames(userId);
  return permissions.includes('notification-logs:read') || permissions.some((permission) => permission.startsWith('hr-'));
}

async function requireAuthenticatedUser(c: Context) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');
  const session = await getSessionByToken(token);
  if (!session?.user?.id) throw new Error('Authentication required');
  return session;
}
