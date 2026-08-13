import { Context } from 'hono';
import {
  AssignUserHrUnitsRequestSchema,
  CreateHrUnitRequestSchema,
  UpdateHrUnitRequestSchema,
} from '../../../schemas/core.schema';
import {
  assignUserHrUnits,
  createHrUnit,
  getHrUnits,
  getUserHrUnits,
  updateHrUnit,
} from '../../../db/orm/core/manageHrUnits';
import { coreErrorResponse, validationErrorResponse } from '../helpers/errors';
import { formatHrUnit } from '../helpers/formatters';

export async function createHrUnitHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreateHrUnitRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const hrUnit = await createHrUnit(parsed.data);
    return c.json({ success: true, hrUnit: formatHrUnit(hrUnit) }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create HR unit');
  }
}

export async function getHrUnitsHandler(c: Context) {
  try {
    const hrUnits = await getHrUnits();
    return c.json({ success: true, hrUnits: hrUnits.map(formatHrUnit) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch HR units');
  }
}

export async function updateHrUnitHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateHrUnitRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const hrUnit = await updateHrUnit(id, parsed.data);
    return c.json({ success: true, hrUnit: formatHrUnit(hrUnit) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update HR unit');
  }
}

export async function getUserHrUnitsHandler(c: Context) {
  try {
    const userId = c.req.param('id');
    const memberships = await getUserHrUnits(userId);
    return c.json({
      success: true,
      hrUnits: memberships
        .map((membership) => membership.hrUnit)
        .filter(Boolean)
        .map(formatHrUnit),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch user HR units');
  }
}

export async function assignUserHrUnitsHandler(c: Context) {
  try {
    const userId = c.req.param('id');
    const body = await c.req.json();
    const parsed = AssignUserHrUnitsRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const memberships = await assignUserHrUnits(userId, parsed.data.hrUnitIds);
    return c.json({
      success: true,
      hrUnits: memberships
        .map((membership) => membership.hrUnit)
        .filter(Boolean)
        .map(formatHrUnit),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to assign user HR units');
  }
}
