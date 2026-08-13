import { Context } from 'hono';
import { UpdateRoleRequestSchema } from '../../../schemas/rbac.schema';
import { updateRole } from '../../../db/orm/rbac/manageRbac';
import { formatRole } from './formatters';

export async function updateRoleHandler(c: Context) {
  try {
    const roleId = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateRoleRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: 'Invalid role payload',
        details: parsed.error.message,
      }, 400);
    }

    const role = await updateRole(roleId, parsed.data);

    return c.json({
      success: true,
      role: formatRole(role),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isReservedRoleName = message.includes('reserved by the system');
    const status = message.includes('not found') ? 404 : isReservedRoleName ? 400 : 500;

    return c.json({
      success: false,
      error: isReservedRoleName ? message : 'Failed to update role',
      details: message,
    }, status);
  }
}
