import { Context } from 'hono';
import { CreateAttendancePunchRequestSchema } from '../../../../schemas/core.schema';
import {
  createAttendancePunch,
  getAttendancePunches,
  getAttendancePunchesByEmployeeId,
  getAttendancePunchesPaginated,
  getUnprocessedAttendancePunches,
} from '../../../../db/orm/core/manageBiometricDevices';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatAttendancePunch } from '../../helpers/formatters';

export async function createAttendancePunchHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreateAttendancePunchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const attendancePunch = await createAttendancePunch(parsed.data);

    return c.json({
      success: true,
      attendancePunch: formatAttendancePunch(attendancePunch),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create attendance punch');
  }
}

export async function getAttendancePunchesHandler(c: Context) {
  try {
    const attendancePunches = await getAttendancePunches();

    return c.json({
      success: true,
      attendancePunches: attendancePunches.map(formatAttendancePunch),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch attendance punches');
  }
}

export async function getAttendancePunchesPaginatedHandler(c: Context) {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 50);
    const employeeId = c.req.query('employeeId') || null;
    const deviceId = c.req.query('deviceId') || null;
    const statusParam = c.req.query('status');
    const status = statusParam === 'processed' || statusParam === 'unprocessed' ? statusParam : null;
    const dateFrom = c.req.query('dateFrom') || null;
    const dateTo = c.req.query('dateTo') || null;
    const timeFrom = c.req.query('timeFrom') || null;
    const timeTo = c.req.query('timeTo') || null;
    const result = await getAttendancePunchesPaginated({
      page,
      pageSize,
      employeeId,
      deviceId,
      status,
      dateFrom,
      dateTo,
      timeFrom,
      timeTo,
    });

    return c.json({
      success: true,
      attendancePunches: result.attendancePunches.map(formatAttendancePunch),
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch paginated attendance punches');
  }
}

export async function getAttendancePunchesByEmployeeHandler(c: Context) {
  try {
    const employeeId = c.req.param('employeeId');
    const attendancePunches = await getAttendancePunchesByEmployeeId(employeeId);

    return c.json({
      success: true,
      attendancePunches: attendancePunches.map(formatAttendancePunch),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch employee attendance punches');
  }
}

export async function getUnprocessedAttendancePunchesHandler(c: Context) {
  try {
    const attendancePunches = await getUnprocessedAttendancePunches();

    return c.json({
      success: true,
      attendancePunches: attendancePunches.map(formatAttendancePunch),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch unprocessed attendance punches');
  }
}
