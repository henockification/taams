import { Context } from 'hono';
import { UpdatePermissionRequestSchema } from '../../../schemas/rbac.schema';
import { updatePermission } from '../../../db/orm/rbac/manageRbac';
import { formatPermission } from './formatters';

export async function updatePermissionHandler(c: Context) {
  try {
    const permissionId = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdatePermissionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: 'Invalid permission payload',
        details: parsed.error.message,
      }, 400);
    }

    const permission = await updatePermission(permissionId, parsed.data);

    return c.json({
      success: true,
      permission: formatPermission(permission),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 404 : 500;

    return c.json({
      success: false,
      error: 'Failed to update permission',
      details: message,
    }, status);
  }
}
