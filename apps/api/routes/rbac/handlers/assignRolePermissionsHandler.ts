import { Context } from 'hono';
import { AssignRolePermissionsRequestSchema } from '../../../schemas/rbac.schema';
import { assignPermissionsToRole } from '../../../db/orm/rbac/manageRbac';
import { formatRole } from './formatters';

export async function assignRolePermissionsHandler(c: Context) {
  try {
    const roleId = c.req.param('id');
    const body = await c.req.json();
    const parsed = AssignRolePermissionsRequestSchema.safeParse(body);

    if (!roleId) {
      return c.json({ success: false, error: 'Role ID is required' }, 400);
    }

    if (!parsed.success) {
      return c.json({
        success: false,
        error: 'Invalid role permissions payload',
        details: parsed.error.message,
      }, 400);
    }

    const role = await assignPermissionsToRole(roleId, parsed.data.permissionIds);

    return c.json({
      success: true,
      role: formatRole(role),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Role not found' ? 404 : message.includes('not found') ? 400 : 500;

    return c.json({
      success: false,
      error: 'Failed to assign permissions to role',
      details: message,
    }, status);
  }
}
