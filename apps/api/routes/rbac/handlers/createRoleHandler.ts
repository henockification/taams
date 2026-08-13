import { Context } from 'hono';
import { CreateRoleRequestSchema } from '../../../schemas/rbac.schema';
import { createRole } from '../../../db/orm/rbac/manageRbac';
import { formatRole } from './formatters';

export async function createRoleHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreateRoleRequestSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        success: false,
        error: 'Invalid role payload',
        details: parsed.error.message,
      }, 400);
    }

    const role = await createRole(parsed.data);

    return c.json({
      success: true,
      role: formatRole(role),
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isClientError = message.includes('not found') || message.includes('reserved by the system');
    const status = isClientError ? 400 : 500;

    return c.json({
      success: false,
      error: isClientError ? message : 'Failed to create role',
      details: message,
    }, status);
  }
}
