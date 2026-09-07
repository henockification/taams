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
    console.error('Failed to fetch roles', error);
    return c.json({
      success: false,
      error: 'Failed to fetch roles',
    }, 500);
  }
}
