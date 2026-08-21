import { Context } from 'hono';
import {
  CreateHolidayRequestSchema,
  UpdateHolidayRequestSchema,
} from '../../../../schemas/core.schema';
import {
  createHoliday,
  getHolidays,
  updateHoliday,
} from '../../../../db/orm/core/manageHolidays';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatHoliday } from '../../helpers/formatters';

export async function getHolidaysHandler(c: Context) {
  try {
    await resolveSession(c);
    const holidays = await getHolidays();
    return c.json({
      success: true,
      holidays: holidays.map(formatHoliday),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch holidays/off days');
  }
}

export async function createHolidayHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const parsed = CreateHolidayRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const holiday = await createHoliday({
      ...parsed.data,
      createdBy: session.user.id ?? c.user?.id ?? parsed.data.createdBy,
      updatedBy: session.user.id ?? c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    });

    return c.json({
      success: true,
      holiday: formatHoliday(holiday),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create holiday/off day');
  }
}

export async function updateHolidayHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const id = c.req.param('id');
    const parsed = UpdateHolidayRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const holiday = await updateHoliday(id, {
      ...parsed.data,
      holidayId: id,
      updatedBy: session.user.id ?? c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    });

    if (!holiday) {
      return c.json({ success: false, error: 'Holiday/off day not found' }, 404);
    }

    return c.json({
      success: true,
      holiday: formatHoliday(holiday),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update holiday/off day');
  }
}

async function resolveSession(c: Context) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');
  const session = await getSessionByToken(token);
  if (!session?.user?.id) throw new Error('Authentication required');
  return session;
}
