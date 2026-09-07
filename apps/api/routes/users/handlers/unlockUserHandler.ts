import { Context } from 'hono';
import { db } from '../../../db/db';
import { unlockUserLogin } from '../../../db/orm/auth/manageAuth';
import { writeAuditEvent } from '../../../lib/audit';
import { formatUser } from '../../rbac/handlers/formatters';

export async function unlockUserHandler(c: Context) {
  try {
    const userId = c.req.param('id');
    if (!userId) {
      return c.json({ success: false, error: 'User ID is required' }, 400);
    }

    const unlocked = await unlockUserLogin(userId);

    await writeAuditEvent(db, {
      action: 'USER_UNLOCKED',
      resourceType: 'user',
      resourceId: unlocked.id,
      resourceLabel: unlocked.email ?? unlocked.phone ?? unlocked.id,
    });

    return c.json({
      success: true,
      user: formatUser(unlocked),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'User not found' ? 404 : 500;
    console.error('Failed to unlock user', error);
    return c.json({
      success: false,
      error: status >= 500 ? 'Failed to unlock user' : message,
    }, status);
  }
}
