import { Context } from 'hono';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getTimeOperationsSummaryForUser } from '../../../../db/orm/core/manageTimeOperations';
import { clearSessionCookie, getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse } from '../../helpers/errors';
import { formatTimeOperationsSummary } from '../../helpers/formatters';

export async function getTimeOperationsSummaryHandler(c: Context) {
  try {
    const token = getSessionCookie(c);

    if (!token) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const session = await getSessionByToken(token);

    if (!session) {
      clearSessionCookie(c);
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const timeOperations = await getTimeOperationsSummaryForUser({
      id: session.user.id,
      role: session.user.role,
    });

    return c.json({
      success: true,
      timeOperations: formatTimeOperationsSummary(timeOperations),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch time operations summary');
  }
}
