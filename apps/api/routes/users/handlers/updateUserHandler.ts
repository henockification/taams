import { Context } from 'hono';
import { UpdateUserRequestSchema } from '../../../schemas/users.schema';
import { updateUserWithRoles } from '../../../db/orm/rbac/manageRbac';
import { formatUser } from '../../rbac/handlers/formatters';

export async function updateUserHandler(c: Context) {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateUserRequestSchema.safeParse(body);

    if (!userId) {
      return c.json({ success: false, error: 'User ID is required' }, 400);
    }

    if (!parsed.success) {
      return c.json({
        success: false,
        error: 'Invalid user payload',
        details: parsed.error.message,
      }, 400);
    }

    const updatedUser = await updateUserWithRoles(userId, parsed.data);

    return c.json({
      success: true,
      user: formatUser(updatedUser),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'User not found'
      ? 404
      : message.includes('not found') || message.includes('already used') || message.includes('required') || message.includes('duplicate') || message.toLowerCase().includes('invalid')
        ? 400
        : 500;

    console.error('Failed to update user', error);
    return c.json({
      success: false,
      error: status >= 500 ? 'Failed to update user' : message,
    }, status);
  }
}
