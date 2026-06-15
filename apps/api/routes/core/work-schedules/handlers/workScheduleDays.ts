import { Context } from 'hono';
import {
  CreateWorkScheduleDayRequestSchema,
  UpdateWorkScheduleDayRequestSchema,
} from '../../../../schemas/core.schema';
import {
  createWorkScheduleDay,
  getWorkScheduleDays,
  getWorkScheduleDayById,
  updateWorkScheduleDay,
} from '../../../../db/orm/core/manageWorkSchedules';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatWorkScheduleDay } from '../../helpers/formatters';

export async function createWorkScheduleDayHandler(c: Context) {
  try {
    const workScheduleId = c.req.param('id');
    const body = await c.req.json();
    const parsed = CreateWorkScheduleDayRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const day = await createWorkScheduleDay(workScheduleId, parsed.data);

    return c.json({
      success: true,
      day: formatWorkScheduleDay(day),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create work schedule day');
  }
}

export async function getWorkScheduleDaysHandler(c: Context) {
  try {
    const workScheduleId = c.req.param('id');
    const result = await getWorkScheduleDays(workScheduleId);

    return c.json({
      success: true,
      days: result.map(formatWorkScheduleDay),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch work schedule days');
  }
}

export async function updateWorkScheduleDayHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateWorkScheduleDayRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const day = await updateWorkScheduleDay(id, parsed.data);

    return c.json({
      success: true,
      day: formatWorkScheduleDay(day),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update work schedule day');
  }
}
