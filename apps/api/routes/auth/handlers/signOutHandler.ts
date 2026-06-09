import { Context } from 'hono';
import { deleteSessionByToken } from '../../../db/orm/auth/manageAuth';
import { clearSessionCookie, getSessionCookie } from './helpers';

export async function signOutHandler(c: Context) {
  const token = getSessionCookie(c);

  if (token) {
    await deleteSessionByToken(token);
  }

  clearSessionCookie(c);

  return c.json({ success: true });
}
