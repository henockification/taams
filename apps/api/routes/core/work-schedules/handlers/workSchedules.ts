import { Context } from 'hono';
import {
  CreateWorkScheduleRequestSchema,
  UpdateWorkScheduleRequestSchema,
} from '../../../../schemas/core.schema';
import {
  createWorkSchedule,
  getWorkScheduleById,
  getWorkSchedules,
  updateWorkSchedule,
} from '../../../../db/orm/core/manageWorkSchedules';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatWorkSchedule } from '../../helpers/formatters';

export async function createWorkScheduleHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreateWorkScheduleRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const workSchedule = await createWorkSchedule(parsed.data);

    return c.json({
      success: true,
      workSchedule: formatWorkSchedule(workSchedule),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create work schedule');
  }
}

export async function getWorkSchedulesHandler(c: Context) {
  try {
    const result = await getWorkSchedules();

    return c.json({
      success: true,
      workSchedules: result.map(formatWorkSchedule),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch work schedules');
  }
}

export async function getWorkScheduleHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const workSchedule = await getWorkScheduleById(id);

    if (!workSchedule) {
      return c.json({
        success: false,
        error: 'Work schedule not found',
      }, 404);
    }

    return c.json({
      success: true,
      workSchedule: formatWorkSchedule(workSchedule),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch work schedule');
  }
}

export async function updateWorkScheduleHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateWorkScheduleRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const workSchedule = await updateWorkSchedule(id, parsed.data);

    return c.json({
      success: true,
      workSchedule: formatWorkSchedule(workSchedule),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update work schedule');
  }
}
