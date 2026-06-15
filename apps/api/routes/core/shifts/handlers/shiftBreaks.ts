import { Context } from 'hono';
import {
  CreateShiftBreakRequestSchema,
  UpdateShiftBreakRequestSchema,
} from '../../../../schemas/core.schema';
import {
  createShiftBreak,
  getShiftBreakById,
  getShiftBreaks,
  updateShiftBreak,
} from '../../../../db/orm/core/manageShifts';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatShiftBreak } from '../../helpers/formatters';

export async function createShiftBreakHandler(c: Context) {
  try {
    const shiftId = c.req.param('id');
    const body = await c.req.json();
    const parsed = CreateShiftBreakRequestSchema.safeParse({
      ...body,
      shiftId,
    });

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const shiftBreak = await createShiftBreak(parsed.data);

    return c.json({
      success: true,
      shiftBreak: formatShiftBreak(shiftBreak),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create shift break');
  }
}

export async function getShiftBreaksHandler(c: Context) {
  try {
    const shiftId = c.req.param('id');
    const result = await getShiftBreaks(shiftId);

    return c.json({
      success: true,
      shiftBreaks: result.map(formatShiftBreak),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch shift breaks');
  }
}

export async function updateShiftBreakHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateShiftBreakRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const shiftBreak = await updateShiftBreak(id, parsed.data);

    return c.json({
      success: true,
      shiftBreak: formatShiftBreak(shiftBreak),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update shift break');
  }
}
