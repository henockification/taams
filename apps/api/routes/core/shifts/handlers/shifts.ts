import { Context } from 'hono';
import {
  CreateShiftRequestSchema,
  UpdateShiftRequestSchema,
} from '../../../../schemas/core.schema';
import {
  createShift,
  getShiftById,
  getShifts,
  updateShift,
} from '../../../../db/orm/core/manageShifts';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatShift } from '../../helpers/formatters';

export async function createShiftHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreateShiftRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const shift = await createShift(parsed.data);

    return c.json({
      success: true,
      shift: formatShift(shift),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create shift');
  }
}

export async function getShiftsHandler(c: Context) {
  try {
    const result = await getShifts();

    return c.json({
      success: true,
      shifts: result.map(formatShift),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch shifts');
  }
}

export async function getShiftHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const shift = await getShiftById(id);

    if (!shift) {
      return c.json({
        success: false,
        error: 'Shift not found',
      }, 404);
    }

    return c.json({
      success: true,
      shift: formatShift(shift),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch shift');
  }
}

export async function updateShiftHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateShiftRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const shift = await updateShift(id, parsed.data);

    return c.json({
      success: true,
      shift: formatShift(shift),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update shift');
  }
}
