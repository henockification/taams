import { Context } from 'hono';
import { db } from '../../../db/db';
import { deleteSessionByToken, getSessionByToken } from '../../../db/orm/auth/manageAuth';
import { writeAuditEvent } from '../../../lib/audit';
import { getRequestClientIp } from '../../../middleware/auth';
import { clearSessionCookie, getSessionCookie } from './helpers';

export async function signOutHandler(c: Context) {
  const token = getSessionCookie(c);
  const session = token ? await getSessionByToken(token) : null;

  if (token) {
    await deleteSessionByToken(token);
  }

  if (session?.user) {
    await writeAuditEvent(db, {
      action: 'AUTH_SIGN_OUT',
      resourceType: 'auth_session',
      resourceId: session.id,
      resourceLabel: session.user.email,
      actorUserId: session.user.id,
      actorName: session.user.name,
      actorEmail: session.user.email,
      actorType: 'USER',
      ipAddress: session.ipAddress ?? getRequestClientIp(c),
      userAgent: session.userAgent ?? c.req.header('user-agent') ?? null,
      requestId: c.get('requestId') ?? null,
    });
  }

  clearSessionCookie(c);

  return c.json({ success: true });
}
