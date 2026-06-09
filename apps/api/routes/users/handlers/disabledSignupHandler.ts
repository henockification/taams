import { Context } from 'hono';

export async function disabledSignupHandler(c: Context) {
  return c.json({
    success: false,
    error: 'Public signup is disabled. Users must be created by an administrator.',
  }, 404);
}
