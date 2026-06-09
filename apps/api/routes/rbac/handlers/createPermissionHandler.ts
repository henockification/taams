import { Context } from 'hono';
import { CreatePermissionRequestSchema } from '../../../schemas/rbac.schema';
import { createPermission } from '../../../db/orm/rbac/manageRbac';
import { formatPermission } from './formatters';

export async function createPermissionHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreatePermissionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: 'Invalid permission payload',
        details: parsed.error.message,
      }, 400);
    }

    const permission = await createPermission(parsed.data);

    return c.json({
      success: true,
      permission: formatPermission(permission),
    }, 201);
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to create permission',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}
