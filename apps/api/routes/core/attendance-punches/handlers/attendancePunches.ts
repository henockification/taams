import { Context } from 'hono';
import { CreateAttendancePunchRequestSchema } from '../../../../schemas/core.schema';
import {
  createAttendancePunch,
  getAttendancePunches,
  getAttendancePunchesByEmployeeId,
  getAttendancePunchesPaginated,
  getUnprocessedAttendancePunches,
} from '../../../../db/orm/core/manageBiometricDevices';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getUserPermissionNames } from '../../../../db/orm/rbac/manageRbac';
import { assertCanAccessEmployee, resolveEmployeeVisibilityScope } from '../../../../db/orm/core/manageEmployeeVisibility';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatAttendancePunch } from '../../helpers/formatters';

export async function createAttendancePunchHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const body = await c.req.json();
    const parsed = CreateAttendancePunchRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    if (parsed.data.employeeId) {
      await assertCanAccessEmployee(parsed.data.employeeId, scope);
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
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const attendancePunches = await getAttendancePunches(scope);

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
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
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
      scope,
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
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const employeeId = c.req.param('employeeId');
    const attendancePunches = await getAttendancePunchesByEmployeeId(employeeId, scope);

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
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const attendancePunches = await getUnprocessedAttendancePunches(scope);

    return c.json({
      success: true,
      attendancePunches: attendancePunches.map(formatAttendancePunch),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch unprocessed attendance punches');
  }
}

async function resolveSession(c: Context) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');
  const session = await getSessionByToken(token);
  if (!session?.user?.id) throw new Error('Authentication required');
  return session;
}

async function resolveScope(session: Awaited<ReturnType<typeof getSessionByToken>>) {
  if (!session?.user?.id) throw new Error('Authentication required');
  const permissions = await getUserPermissionNames(session.user.id);
  return resolveEmployeeVisibilityScope({
    userId: session.user.id,
    roles: session.user.role ?? [],
    permissions,
  });
}
