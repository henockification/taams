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
import { getUserPermissionNames } from '../../../../db/orm/rbac/manageRbac';
import { resolveEmployeeVisibilityScope } from '../../../../db/orm/core/manageEmployeeVisibility';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { clearSessionCookie, getSessionCookie } from '../../../auth/handlers/helpers';
import {
  ReturnAttendanceDailyRecordRequestSchema,
  UpdateAttendanceDailyRecordPayrollRequestSchema,
} from '../../../../schemas/core.schema';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatAttendanceDailyRecord } from '../../helpers/formatters';
// import { safeEnqueueWorkflowNotification } from '../../../../lib/notifications';

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
    const scope = await resolveScope(session);
    const records = await getSupervisorAttendanceDailyRecords({
      userId: session.user.id,
      roles: session.user.role ?? [],
      date,
      scope,
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
    const scope = await resolveScope(session);
    const records = await getHrAttendanceDailyRecords(date, scope);

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
    const scope = await resolveScope(session);
    const record = await supervisorApproveAttendanceDailyRecord(id, {
      userId: session.user.id,
      roles: session.user.role ?? [],
      scope,
    });
    // Notification trigger disabled until SMS/email provider credentials are available.
    // await safeEnqueueWorkflowNotification('ATTENDANCE_SUPERVISOR_APPROVED', {
    //   entityId: record.id,
    //   employeeId: record.employeeId,
    //   date: record.attendanceDate,
    // });

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
      roles: session.user.role ?? [],
      scope: await resolveScope(session),
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
    const scope = await resolveScope(session);
    const record = await hrApproveAttendanceDailyRecord(id, { userId: session.user.id, scope });
    // Notification trigger disabled until SMS/email provider credentials are available.
    // await safeEnqueueWorkflowNotification('ATTENDANCE_HR_APPROVED', {
    //   entityId: record.id,
    //   employeeId: record.employeeId,
    //   date: record.attendanceDate,
    // });

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
    const scope = canHrReturn ? await resolveScope(session) : undefined;
    const record = await returnAttendanceDailyRecord(id, {
      userId: session.user.id,
      roles: session.user.role ?? [],
      reason: parsed.data.reason,
      canHrReturn,
      scope,
    });
    // Notification trigger disabled until SMS/email provider credentials are available.
    // await safeEnqueueWorkflowNotification('ATTENDANCE_RETURNED', {
    //   entityId: record.id,
    //   employeeId: record.employeeId,
    //   date: record.attendanceDate,
    //   reason: record.returnReason ?? parsed.data.reason,
    // });

    return c.json({
      success: true,
      attendanceDailyRecord: formatAttendanceDailyRecord(record),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to return attendance');
  }
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

  if (
    normalizedRoles.includes('super_admin')
    || normalizedRoles.includes('superadmin')
    || normalizedRoles.includes('admin')
    || normalizedRoles.includes('executive')
    || normalizedRoles.includes('human_resource')
  ) {
    return true;
  }

  return userHasPermission(userId, 'hr-attendance-approvals:approve');
}
