import { Context } from 'hono';
import { getPermissions } from '../../../db/orm/rbac/manageRbac';
import { formatPermission } from './formatters';

export async function getPermissionsHandler(c: Context) {
  try {
    const permissions = await getPermissions();

    return c.json({
      success: true,
      permissions: permissions.map(formatPermission),
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to fetch permissions',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}
