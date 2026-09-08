import { Context } from 'hono';
import { UpdateProfileRequestSchema } from '../../../schemas/profile.schema';
import { getOwnProfile, updateOwnProfile } from '../../../db/orm/users/manageProfile';
import { getSessionByToken } from '../../../db/orm/auth/manageAuth';
import { getSessionCookie } from '../../auth/handlers/helpers';
import { formatUser } from '../../rbac/handlers/formatters';
import { formatEmployee } from '../../core/helpers/formatters';

async function requireSessionUserId(c: Context) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');
  const session = await getSessionByToken(token);
  if (!session?.user?.id) throw new Error('Authentication required');
  return session.user.id;
}

function profileResponse(profile: Awaited<ReturnType<typeof getOwnProfile>>) {
  return {
    success: true,
    user: formatUser(profile.user),
    employee: profile.employee ? formatEmployee(profile.employee) : null,
  };
}

export async function getProfileHandler(c: Context) {
  try {
    const userId = await requireSessionUserId(c);
    return c.json(profileResponse(await getOwnProfile(userId)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch profile';
    const status = message === 'Authentication required' ? 401 : message.includes('not found') ? 404 : 500;
    return c.json({ success: false, error: status >= 500 ? 'Failed to fetch profile' : message }, status);
  }
}

export async function updateProfileHandler(c: Context) {
  try {
    const userId = await requireSessionUserId(c);
    const parsed = UpdateProfileRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ success: false, error: 'Invalid profile payload', details: parsed.error.message }, 400);
    }

    return c.json(profileResponse(await updateOwnProfile(userId, parsed.data)));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    const status = message === 'Authentication required'
      ? 401
      : message.includes('linked') || message.includes('Invalid') || message.includes('already used')
        ? 400
        : message.includes('not found')
          ? 404
          : 500;
    return c.json({ success: false, error: status >= 500 ? 'Failed to update profile' : message }, status);
  }
}
