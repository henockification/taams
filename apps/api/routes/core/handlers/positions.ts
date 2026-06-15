import { Context } from 'hono';
import {
  CreatePositionRequestSchema,
  UpdatePositionRequestSchema,
} from '../../../schemas/core.schema';
import {
  createPosition,
  getPositions,
  updatePosition,
} from '../../../db/orm/core/manageCore';
import { coreErrorResponse, validationErrorResponse } from '../helpers/errors';
import { formatPosition } from '../helpers/formatters';

export async function createPositionHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreatePositionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const position = await createPosition(parsed.data);

    return c.json({
      success: true,
      position: formatPosition(position),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create position');
  }
}

export async function getPositionsHandler(c: Context) {
  try {
    const result = await getPositions();

    return c.json({
      success: true,
      positions: result.map(formatPosition),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch positions');
  }
}

export async function updatePositionHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdatePositionRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const position = await updatePosition(id, parsed.data);

    return c.json({
      success: true,
      position: formatPosition(position),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update position');
  }
}
