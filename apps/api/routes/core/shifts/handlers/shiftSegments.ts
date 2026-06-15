import { Context } from 'hono';
import {
  CreateShiftSegmentRequestSchema,
  UpdateShiftSegmentRequestSchema,
} from '../../../../schemas/core.schema';
import {
  createShiftSegment,
  getShiftSegments,
  updateShiftSegment,
} from '../../../../db/orm/core/manageShifts';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatShiftSegment } from '../../helpers/formatters';

export async function createShiftSegmentHandler(c: Context) {
  try {
    const shiftId = c.req.param('id');
    const body = await c.req.json();
    const parsed = CreateShiftSegmentRequestSchema.safeParse({
      ...body,
      shiftId,
    });

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const shiftSegment = await createShiftSegment(parsed.data);

    return c.json({
      success: true,
      shiftSegment: formatShiftSegment(shiftSegment),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create shift segment');
  }
}

export async function getShiftSegmentsHandler(c: Context) {
  try {
    const shiftId = c.req.param('id');
    const result = await getShiftSegments(shiftId);

    return c.json({
      success: true,
      shiftSegments: result.map(formatShiftSegment),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch shift segments');
  }
}

export async function updateShiftSegmentHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateShiftSegmentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const shiftSegment = await updateShiftSegment(id, parsed.data);

    return c.json({
      success: true,
      shiftSegment: formatShiftSegment(shiftSegment),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update shift segment');
  }
}
