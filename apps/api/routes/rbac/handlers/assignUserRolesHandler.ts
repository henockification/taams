import { Context } from 'hono';
import { AssignUserRolesRequestSchema } from '../../../schemas/rbac.schema';
import { assignRolesToUser } from '../../../db/orm/rbac/manageRbac';
import { formatUser } from './formatters';

export async function assignUserRolesHandler(c: Context) {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();
    const parsed = AssignUserRolesRequestSchema.safeParse(body);

    if (!userId) {
      return c.json({ success: false, error: 'User ID is required' }, 400);
    }

    if (!parsed.success) {
      return c.json({
        success: false,
        error: 'Invalid user roles payload',
        details: parsed.error.message,
      }, 400);
    }

    const user = await assignRolesToUser(userId, parsed.data.roleIds);

    return c.json({
      success: true,
      user: formatUser(user),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'User not found' ? 404 : message.includes('not found') ? 400 : 500;

    return c.json({
      success: false,
      error: 'Failed to assign roles to user',
      details: message,
    }, status);
  }
}
