import { Context } from 'hono';
import { getRoles } from '../../../db/orm/rbac/manageRbac';
import { formatRole } from './formatters';

export async function getRolesHandler(c: Context) {
  try {
    const roles = await getRoles();

    return c.json({
      success: true,
      roles: roles.map(formatRole),
    });
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to fetch roles',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}
