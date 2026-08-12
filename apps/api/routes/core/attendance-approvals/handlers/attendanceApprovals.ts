import { Context } from 'hono';
import {
  generateAttendanceDailyRecords,
  getHrAttendanceDailyRecords,
  getSupervisorAttendanceDailyRecords,
  hrApproveAttendanceDailyRecord,
  returnAttendanceDailyRecord,
  supervisorApproveAttendanceDailyRecord,
  updateSupervisorAttendanceDailyRecordPayroll,
} from '../../../../db/orm/core/manageAttendanceApprovals';
import { userHasPermission } from '../../../../db/orm/rbac/manageRbac';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { clearSessionCookie, getSessionCookie } from '../../../auth/handlers/helpers';
import {
  ReturnAttendanceDailyRecordRequestSchema,
  UpdateAttendanceDailyRecordPayrollRequestSchema,
} from '../../../../schemas/core.schema';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatAttendanceDailyRecord } from '../../helpers/formatters';

export async function generateAttendanceDailyRecordsHandler(c: Context) {
  try {
    await requireAuthenticatedUser(c);
    const date = c.req.query('date');
    const records = await generateAttendanceDailyRecords(date);

    return c.json({
      success: true,
      generated: records.length,
      attendanceDailyRecords: records.map(formatAttendanceDailyRecord),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to generate attendance daily records');
  }
}

export async function getSupervisorAttendanceDailyRecordsHandler(c: Context) {
  try {
    const session = await requireAuthenticatedUser(c);
    const date = c.req.query('date');
    const records = await getSupervisorAttendanceDailyRecords({
      userId: session.user.id,
      date,
    });

    return c.json({
      success: true,
      attendanceDailyRecords: records.map(formatAttendanceDailyRecord),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch supervisor attendance approvals');
  }
}

export async function getHrAttendanceDailyRecordsHandler(c: Context) {
  try {
    const session = await requireAuthenticatedUser(c);
    const hasPermission = await canUseHrApproval(session.user.id, session.user.role ?? []);

    if (!hasPermission) {
      return c.json({ success: false, error: 'You do not have permission to approve HR attendance' }, 403);
    }

    const date = c.req.query('date');
    const records = await getHrAttendanceDailyRecords(date);

    return c.json({
      success: true,
      attendanceDailyRecords: records.map(formatAttendanceDailyRecord),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch HR attendance approvals');
  }
}

export async function supervisorApproveAttendanceDailyRecordHandler(c: Context) {
  try {
    const session = await requireAuthenticatedUser(c);
    const id = c.req.param('id');
    const record = await supervisorApproveAttendanceDailyRecord(id, { userId: session.user.id });

    return c.json({
      success: true,
      attendanceDailyRecord: formatAttendanceDailyRecord(record),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to supervisor approve attendance');
  }
}

export async function updateSupervisorAttendanceDailyRecordPayrollHandler(c: Context) {
  try {
    const session = await requireAuthenticatedUser(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateAttendanceDailyRecordPayrollRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const record = await updateSupervisorAttendanceDailyRecordPayroll(id, {
      userId: session.user.id,
      ...parsed.data,
    });

    return c.json({
      success: true,
      attendanceDailyRecord: formatAttendanceDailyRecord(record),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update attendance payroll values');
  }
}

export async function hrApproveAttendanceDailyRecordHandler(c: Context) {
  try {
    const session = await requireAuthenticatedUser(c);
    const hasPermission = await canUseHrApproval(session.user.id, session.user.role ?? []);

    if (!hasPermission) {
      return c.json({ success: false, error: 'You do not have permission to approve HR attendance' }, 403);
    }

    const id = c.req.param('id');
    const record = await hrApproveAttendanceDailyRecord(id, { userId: session.user.id });

    return c.json({
      success: true,
      attendanceDailyRecord: formatAttendanceDailyRecord(record),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to HR approve attendance');
  }
}

export async function returnAttendanceDailyRecordHandler(c: Context) {
  try {
    const session = await requireAuthenticatedUser(c);
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = ReturnAttendanceDailyRecordRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const canHrReturn = await canUseHrApproval(session.user.id, session.user.role ?? []);
    const record = await returnAttendanceDailyRecord(id, {
      userId: session.user.id,
      reason: parsed.data.reason,
      canHrReturn,
    });

    return c.json({
      success: true,
      attendanceDailyRecord: formatAttendanceDailyRecord(record),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to return attendance');
  }
}

async function requireAuthenticatedUser(c: Context) {
  const token = getSessionCookie(c);

  if (!token) {
    throw new Error('Authentication required');
  }

  const session = await getSessionByToken(token);

  if (!session) {
    clearSessionCookie(c);
    throw new Error('Authentication required');
  }

  return session;
}

async function canUseHrApproval(userId: string, roles: string[]) {
  const normalizedRoles = roles.map((role) => role.toLowerCase());

  if (normalizedRoles.includes('super_admin') || normalizedRoles.includes('human_resource') || normalizedRoles.includes('hr')) {
    return true;
  }

  return userHasPermission(userId, 'hr-attendance-approvals:approve');
}
