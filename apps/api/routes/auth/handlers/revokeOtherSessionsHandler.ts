import { Context } from 'hono';
import { db } from '../../../db/db';
import { revokeOtherUserSessions } from '../../../db/orm/auth/manageAuth';
import { writeAuditEvent } from '../../../lib/audit';
import { getRequestClientIp } from '../../../middleware/auth';
import { getSessionCookie } from './helpers';

export async function revokeOtherSessionsHandler(c: Context) {
  const currentUser = c.get('user') ?? c.user;
  const token = getSessionCookie(c);

  if (!currentUser?.id || !token) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  await revokeOtherUserSessions(currentUser.id, token);
  await writeAuditEvent(db, {
    action: 'AUTH_SESSIONS_REVOKED',
    resourceType: 'user',
    resourceId: currentUser.id,
    resourceLabel: currentUser.email,
    actorUserId: currentUser.id,
    actorName: currentUser.name,
    actorEmail: currentUser.email,
    actorType: 'USER',
    ipAddress: getRequestClientIp(c),
    userAgent: c.req.header('user-agent') ?? null,
    requestId: c.get('requestId') ?? null,
    metadata: { scope: 'other-sessions' },
  });

  return c.json({ success: true });
}
