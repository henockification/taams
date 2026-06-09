import { Context } from 'hono';
import { randomUUID } from 'crypto';
import { CreateUserRequestSchema } from '../../../schemas/users.schema';
import { createUserWithRoles } from '../../../db/orm/rbac/manageRbac';
import { formatUser } from '../../rbac/handlers/formatters';

export async function createUserHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreateUserRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: 'Invalid user payload',
        details: parsed.error.message,
      }, 400);
    }

    const createdUser = await createUserWithRoles({
      id: randomUUID(),
      ...parsed.data,
    });

    return c.json({
      success: true,
      user: formatUser(createdUser),
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('not found') ? 400 : 500;

    return c.json({
      success: false,
      error: 'Failed to create user',
      details: message,
    }, status);
  }
}
