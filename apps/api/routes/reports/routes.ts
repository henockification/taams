import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import { and, asc, desc, eq, gte, ilike, lte, or } from 'drizzle-orm';
import { db } from '../../db/db';
import {
  attendanceDailyRecords,
  attendancePunches,
  attendanceSyncBatches,
  biometricDevices,
  departments,
    employees,
  leaveBalances,
  leaveFiscalYears,
  leaveRequests,
  leaveTypes,
  overtimeRequests,
  roles,
  user,
} from '../../db/schema';
import { listAuditEvents, auditActionLabel } from '../../db/orm/core/manageAuditEvents';
import { summarizeChanges, type AuditChanges } from '../../lib/audit';
import { getSessionByToken } from '../../db/orm/auth/manageAuth';
import { getUserPermissionNames, userHasPermission } from '../../db/orm/rbac/manageRbac';
import {
  getHeadedDepartmentScope,
  isEmployeeVisibleInScope,
  resolveEmployeeVisibilityScope,
  scopedEmployeeWhere,
  type EmployeeVisibilityScope,
} from '../../db/orm/core/manageEmployeeVisibility';
import {
  getSupervisorAttendanceRecords,
  type SupervisorReportScope,
} from '../../db/orm/core/manageSupervisorReport';
import {
  buildSessionSlotColumns,
  formatDuration,
  isNoDutyDay,
  minutesToHours,
  recordExceptionMinutes,
  recordSessions,
  recordWorkedMinutes,
  sessionSlotValues,
  type AttendanceSession,
} from '../../lib/attendance/session-slots';
import { clearSessionCookie, getSessionCookie } from '../auth/handlers/helpers';
import { employeeDisplayName, parseNameLocale, withNameLocale } from '../../lib/employees/display-name';

type ReportKey =
  | 'attendance-daily'
  | 'attendance-punches'
  | 'late-attendance'
  | 'overtime'
  | 'leave-balances'
  | 'leave-requests'
  | 'employees'
  | 'device-sync'
  | 'audit'
  | 'users'
  | 'supervisor-attendance'
  | 'supervisor-attendance-summary';

type ReportColumn = {
  key: string;
  label: string;
};

type ReportDefinition = {
  title: string;
  /** Permission-gated reports; supervisor reports are gated by role instead. */
  permission: string | null;
  access?: 'supervisor';
  columns: ReportColumn[];
  /** Rows only, or rows with their own columns when the columns depend on the data. */
  buildRows: (input: ReportInput) => Promise<Record<string, unknown>[] | ReportResult>;
};

type ReportResult = {
  rows: Record<string, unknown>[];
  columns: ReportColumn[];
  /** Headline totals shown above the table, like the counters on the attendance approval screen. */
  highlights?: ReportHighlight[];
};

type ReportHighlight = {
  label: string;
  value: string | number;
  detail?: string;
};

type ReportInput = {
  query: URLSearchParams;
  scope: EmployeeVisibilityScope;
  supervisorScope: SupervisorReportScope | null;
};

const SUPERVISOR_REPORT_ADMIN_ROLES = ['super_admin', 'superadmin', 'admin'];

const reportsApp = new Hono();

// Session check-in/check-out/status columns are inserted after the department column by the builders.
const attendanceDailyColumns: ReportColumn[] = [
  { key: 'attendanceDate', label: 'Date' },
  { key: 'employeeCode', label: 'Employee ID' },
  { key: 'employeeName', label: 'Employee name' },
  { key: 'department', label: 'Department' },
  { key: 'workedTime', label: 'Worked time' },
  { key: 'lateMinutes', label: 'Late (min)' },
  { key: 'earlyBreakMinutes', label: 'Early break (min)' },
  { key: 'earlyDepartureMinutes', label: 'Early leave (min)' },
  { key: 'attendanceDays', label: 'Attendance days' },
  { key: 'leaveDays', label: 'Leave days' },
  { key: 'holidayDays', label: 'Holiday/off days' },
  { key: 'payableDays', label: 'Payable days' },
  { key: 'absenceDays', label: 'Absence days' },
  { key: 'overtimeMinutes', label: 'Overtime (min)' },
  { key: 'overtimeHours', label: 'Overtime hours' },
  { key: 'status', label: 'Approval status' },
  { key: 'payrollNote', label: 'Note' },
];

const attendanceTotalsColumns: ReportColumn[] = [
  { key: 'employeeCode', label: 'Employee ID' },
  { key: 'employeeName', label: 'Employee name' },
  { key: 'department', label: 'Department' },
  { key: 'daysRecorded', label: 'Days recorded' },
  { key: 'workedTime', label: 'Worked time' },
  { key: 'workedHours', label: 'Worked hours' },
  { key: 'attendanceDays', label: 'Attendance days' },
  { key: 'absenceDays', label: 'Absence days' },
  { key: 'absentSessions', label: 'Absent sessions' },
  { key: 'leaveDays', label: 'Leave days' },
  { key: 'holidayDays', label: 'Holiday/off days' },
  { key: 'payableDays', label: 'Payable days' },
  { key: 'lateDays', label: 'Late days' },
  { key: 'lateMinutes', label: 'Late (min)' },
  { key: 'lateTime', label: 'Late time' },
  { key: 'earlyLeaveDays', label: 'Early leave days' },
  { key: 'earlyLeaveMinutes', label: 'Early break + leave (min)' },
  { key: 'overtimeHours', label: 'Overtime hours' },
  { key: 'pendingSupervisor', label: 'Pending supervisor' },
  { key: 'payrollReady', label: 'Payroll ready' },
];

const lateAttendanceColumns: ReportColumn[] = [
  { key: 'attendanceDate', label: 'Date' },
  { key: 'employeeCode', label: 'Employee ID' },
  { key: 'employeeName', label: 'Employee name' },
  { key: 'department', label: 'Department' },
  { key: 'lateCheckInMinutes', label: 'Late check-in (min)' },
  { key: 'lateReturnMinutes', label: 'Late return (min)' },
  { key: 'lateMinutes', label: 'Total late (min)' },
  { key: 'lateTime', label: 'Late time' },
  { key: 'attendanceDays', label: 'Attendance days' },
  { key: 'absenceDays', label: 'Absence days' },
  { key: 'leaveDays', label: 'Leave days' },
  { key: 'status', label: 'Approval status' },
];

const lateTotalsColumns: ReportColumn[] = [
  { key: 'employeeCode', label: 'Employee ID' },
  { key: 'employeeName', label: 'Employee name' },
  { key: 'department', label: 'Department' },
  { key: 'lateDays', label: 'Late days' },
  { key: 'lateCheckInMinutes', label: 'Late check-in (min)' },
  { key: 'lateReturnMinutes', label: 'Late return (min)' },
  { key: 'lateMinutes', label: 'Total late (min)' },
  { key: 'lateTime', label: 'Late time' },
  { key: 'averageLateMinutes', label: 'Average per late day (min)' },
];

const attendanceStatusLabels: Record<string, string> = {
  PENDING_SUPERVISOR: 'Pending supervisor',
  RETURNED: 'Returned',
  SUPERVISOR_APPROVED: 'Supervisor approved',
  HR_APPROVED: 'HR approved',
};

const reportDefinitions: Record<ReportKey, ReportDefinition> = {
  'attendance-daily': {
    title: 'Attendance Daily Summary',
    permission: 'reports-attendance-daily:read',
    columns: attendanceDailyColumns,
    buildRows: buildAttendanceDailyRows,
  },
  'attendance-punches': {
    title: 'Attendance Punches',
    permission: 'reports-attendance-punches:read',
    columns: [
      { key: 'punchTime', label: 'Punch time' },
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'department', label: 'Department' },
      { key: 'biometricId', label: 'Biometric ID' },
      { key: 'deviceName', label: 'Device' },
      { key: 'punchType', label: 'Punch type' },
      { key: 'source', label: 'Source' },
      { key: 'processed', label: 'Processed' },
    ],
    buildRows: buildAttendancePunchRows,
  },
  'late-attendance': {
    title: 'Late Attendance',
    permission: 'reports-late-attendance:read',
    columns: lateAttendanceColumns,
    buildRows: buildLateAttendanceRows,
  },
  overtime: {
    title: 'Overtime',
    permission: 'reports-overtime:read',
    columns: [
      { key: 'attendanceDate', label: 'Date' },
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'department', label: 'Department' },
      { key: 'startAt', label: 'Approved start' },
      { key: 'endAt', label: 'Approved end' },
      { key: 'approvedMinutes', label: 'Approved minutes' },
      { key: 'approvedHours', label: 'Approved hours' },
      { key: 'overtimeDays', label: 'Overtime days' },
      { key: 'reason', label: 'Reason' },
      { key: 'payrollNote', label: 'Payroll note' },
      { key: 'status', label: 'Status' },
    ],
    buildRows: buildOvertimeRows,
  },
  'leave-balances': {
    title: 'Leave Balances',
    permission: 'reports-leave-balances:read',
    columns: [
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'department', label: 'Department' },
      { key: 'fiscalYear', label: 'Fiscal year' },
      { key: 'employmentType', label: 'Employment type' },
      { key: 'opening', label: 'Opening' },
      { key: 'transferredIn', label: 'Transferred in' },
      { key: 'reserved', label: 'Reserved' },
      { key: 'used', label: 'Used' },
      { key: 'available', label: 'Available' },
    ],
    buildRows: buildLeaveBalanceRows,
  },
  'leave-requests': {
    title: 'Leave Requests',
    permission: 'reports-leave-requests:read',
    columns: [
      { key: 'createdAt', label: 'Requested at' },
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'department', label: 'Department' },
      { key: 'leaveType', label: 'Leave type' },
      { key: 'startDate', label: 'Start date' },
      { key: 'endDate', label: 'End date' },
      { key: 'requestedDays', label: 'Days' },
      { key: 'approvedDays', label: 'Approved days' },
      { key: 'consumedDays', label: 'Consumed days' },
      { key: 'interruptedDays', label: 'Interrupted days' },
      { key: 'remainingDays', label: 'Remaining days' },
      { key: 'status', label: 'Status' },
    ],
    buildRows: buildLeaveRequestRows,
  },
  employees: {
    title: 'Employee Roster',
    permission: 'reports-employees:read',
    columns: [
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'department', label: 'Department' },
      { key: 'position', label: 'Position' },
      { key: 'employmentType', label: 'Employment type' },
      { key: 'employmentStatus', label: 'Employment status' },
      { key: 'hireDate', label: 'Hire date' },
      { key: 'phoneNumber', label: 'Phone' },
      { key: 'email', label: 'Email' },
    ],
    buildRows: buildEmployeeRows,
  },
  'device-sync': {
    title: 'Device Sync',
    permission: 'reports-device-sync:read',
    columns: [
      { key: 'syncStartedAt', label: 'Started at' },
      { key: 'syncCompletedAt', label: 'Completed at' },
      { key: 'deviceName', label: 'Device' },
      { key: 'deviceCode', label: 'Device code' },
      { key: 'department', label: 'Department' },
      { key: 'syncStatus', label: 'Status' },
      { key: 'totalRecords', label: 'Total' },
      { key: 'successfulRecords', label: 'Successful' },
      { key: 'failedRecords', label: 'Failed' },
      { key: 'errorMessage', label: 'Error' },
    ],
    buildRows: buildDeviceSyncRows,
  },
  audit: {
    title: 'Audit Trail',
    permission: 'reports-audit:read',
    columns: [
      { key: 'occurredAt', label: 'Time' },
      { key: 'actorName', label: 'Actor' },
      { key: 'actorType', label: 'Actor type' },
      { key: 'actionLabel', label: 'Action' },
      { key: 'outcome', label: 'Outcome' },
      { key: 'resourceLabel', label: 'Resource' },
      { key: 'employeeName', label: 'Employee' },
      { key: 'department', label: 'Department' },
      { key: 'delegated', label: 'Delegated' },
      { key: 'changesSummary', label: 'Changes' },
    ],
    buildRows: buildAuditRows,
  },
  users: {
    title: 'Users',
    permission: 'reports-users:read',
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'roles', label: 'Roles' },
      { key: 'loginStatus', label: 'Login status' },
      { key: 'emailStatus', label: 'Email status' },
      { key: 'failedLoginCount', label: 'Failed logins' },
      { key: 'lockedUntil', label: 'Locked until' },
      { key: 'accessRevokedAt', label: 'Access revoked at' },
      { key: 'accessRevokedReason', label: 'Revoke reason' },
      { key: 'createdAt', label: 'Created' },
    ],
    buildRows: buildUserRows,
  },
  'supervisor-attendance': {
    title: 'Supervisor Attendance Report',
    permission: null,
    access: 'supervisor',
    columns: [
      { key: 'attendanceDate', label: 'Date' },
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'department', label: 'Department' },
      { key: 'temporaryFrom', label: 'Temporarily from' },
      { key: 'directSupervisor', label: 'Direct supervisor' },
      // Check-in/check-out/status columns per shift session are inserted here by the builder.
      { key: 'workedTime', label: 'Worked time' },
      { key: 'lateMinutes', label: 'Late (min)' },
      { key: 'earlyBreakMinutes', label: 'Early break (min)' },
      { key: 'earlyDepartureMinutes', label: 'Early leave (min)' },
      { key: 'attendanceDays', label: 'Attendance days' },
      { key: 'leaveDays', label: 'Leave days' },
      { key: 'holidayDays', label: 'Holiday/off days' },
      { key: 'absenceDays', label: 'Absence days' },
      { key: 'status', label: 'Approval status' },
    ],
    buildRows: buildSupervisorAttendanceRows,
  },
  'supervisor-attendance-summary': {
    title: 'Supervisor Attendance Summary',
    permission: null,
    access: 'supervisor',
    columns: [
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'department', label: 'Department' },
      { key: 'directSupervisor', label: 'Direct supervisor' },
      { key: 'daysRecorded', label: 'Days recorded' },
      { key: 'temporaryAssignmentDays', label: 'Days on temporary assignment' },
      { key: 'workedTime', label: 'Worked time' },
      { key: 'attendanceDays', label: 'Attendance days' },
      { key: 'absenceDays', label: 'Absence days' },
      { key: 'absentSessions', label: 'Absent sessions' },
      { key: 'leaveDays', label: 'Leave days' },
      { key: 'holidayDays', label: 'Holiday/off days' },
      { key: 'lateDays', label: 'Late days' },
      { key: 'lateMinutes', label: 'Total late (min)' },
      { key: 'lateTime', label: 'Late time' },
      { key: 'earlyLeaveMinutes', label: 'Early break + leave (min)' },
      { key: 'pendingSupervisor', label: 'Pending approval' },
    ],
    buildRows: buildSupervisorAttendanceSummaryRows,
  },
};

// Departments the signed-in supervisor can report on, for the report's department filter.
reportsApp.get('/reports/supervisor/departments', async (c) => {
  try {
    const { supervisorScope } = await getReportContext(c, reportDefinitions['supervisor-attendance']);
    const allDepartments = await db.query.departments.findMany({
      columns: { id: true, nameEn: true, parentDepartmentId: true, isContract: true },
      orderBy: [asc(departments.nameEn)],
    });
    const visibleIds = supervisorScope?.type === 'departments' ? new Set(supervisorScope.departmentIds) : null;

    return c.json({
      success: true,
      unrestricted: supervisorScope?.type === 'all',
      headedDepartmentIds: supervisorScope?.type === 'departments' ? supervisorScope.headedDepartmentIds : [],
      departments: allDepartments.filter((department) => !visibleIds || visibleIds.has(department.id)),
    });
  } catch (error) {
    return reportError(c, error);
  }
});

// Roles for the users report's role filter, so the report doesn't depend on role-management access.
reportsApp.get('/reports/users/roles', async (c) => {
  try {
    await getReportContext(c, reportDefinitions.users);
    const roleRows = await db.select({ id: roles.id, name: roles.name }).from(roles).orderBy(asc(roles.name));
    return c.json({ success: true, roles: roleRows });
  } catch (error) {
    return reportError(c, error);
  }
});

reportsApp.get('/reports/:key', async (c) => {
  try {
    const key = c.req.param('key') as ReportKey;
    const definition = reportDefinitions[key];
    if (!definition) return c.json({ success: false, error: 'Report not found' }, 404);

    const context = await getReportContext(c, definition);
    const { rows, columns, highlights } = await runReport(definition, {
      query: new URL(c.req.url).searchParams,
      scope: context.scope,
      supervisorScope: context.supervisorScope,
    });

    return c.json({
      success: true,
      report: {
        key,
        title: definition.title,
        generatedAt: new Date().toISOString(),
        columns,
        rows,
        summary: { totalRows: rows.length, highlights: highlights ?? [] },
      },
    });
  } catch (error) {
    return reportError(c, error);
  }
});

reportsApp.get('/reports/:key/excel', async (c) => {
  try {
    const key = c.req.param('key') as ReportKey;
    const definition = reportDefinitions[key];
    if (!definition) return c.json({ success: false, error: 'Report not found' }, 404);

    const context = await getReportContext(c, definition);
    const { rows, columns } = await runReport(definition, {
      query: new URL(c.req.url).searchParams,
      scope: context.scope,
      supervisorScope: context.supervisorScope,
    });
    const worksheetRows = rows.map((row) => Object.fromEntries(
      columns.map((column) => [column.label, row[column.key] ?? '']),
    ));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${key}-report.xlsx"`,
      },
    });
  } catch (error) {
    return reportError(c, error);
  }
});

async function runReport(definition: ReportDefinition, input: ReportInput): Promise<ReportResult> {
  // Employee names follow the language the report was requested in (`locale`, default English).
  const result = await withNameLocale(parseNameLocale(input.query.get('locale')), () => definition.buildRows(input));
  return Array.isArray(result) ? { rows: result, columns: definition.columns } : result;
}

async function getReportContext(c: any, definition: ReportDefinition) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');

  const session = await getSessionByToken(token);
  if (!session?.user?.id) {
    clearSessionCookie(c);
    throw new Error('Authentication required');
  }

  const roles = (session.user.role ?? []).map((role) => role.toLowerCase());
  let supervisorScope: SupervisorReportScope | null = null;
  if (definition.access === 'supervisor') {
    if (roles.some((role) => SUPERVISOR_REPORT_ADMIN_ROLES.includes(role))) {
      supervisorScope = { type: 'all' };
    } else if (roles.includes('supervisor')) {
      supervisorScope = { type: 'departments', ...(await getHeadedDepartmentScope(session.user.id)) };
    } else {
      throw new Error('You do not have permission to view this report');
    }
  } else {
    const unrestricted = roles.some((role) => ['super_admin', 'superadmin', 'admin', 'executive'].includes(role));
    if (!unrestricted && !(definition.permission && await userHasPermission(session.user.id, definition.permission))) {
      throw new Error('You do not have permission to view this report');
    }
  }

  const permissions = await getUserPermissionNames(session.user.id);
  const scope = await resolveEmployeeVisibilityScope({
    userId: session.user.id,
    roles: session.user.role ?? [],
    permissions,
  });

  return { session, scope, supervisorScope };
}

/**
 * One attendance day prepared for reporting: its sessions and exception minutes are derived the
 * same way the attendance approval screen derives them, so both always show the same numbers.
 */
type AttendanceDay = {
  record: any;
  department: string;
  homeDepartment: string;
  isTemporary: boolean;
  sessions: AttendanceSession[];
  noDuty: boolean;
  lateCheckInMinutes: number;
  lateReturnMinutes: number;
  lateMinutes: number;
  earlyBreakMinutes: number;
  earlyDepartureMinutes: number;
  workedMinutes: number;
};

function toAttendanceDay(record: any, department: string, homeDepartment = department, isTemporary = false): AttendanceDay {
  const sessions = recordSessions(record);
  const exceptions = recordExceptionMinutes(record, sessions);
  return {
    record,
    department,
    homeDepartment,
    isTemporary,
    sessions,
    noDuty: isNoDutyDay(record),
    lateCheckInMinutes: exceptions.lateMinutes,
    lateReturnMinutes: exceptions.lateReturnMinutes,
    lateMinutes: exceptions.lateMinutes + exceptions.lateReturnMinutes,
    earlyBreakMinutes: exceptions.earlyBreakMinutes,
    earlyDepartureMinutes: exceptions.earlyDepartureMinutes,
    workedMinutes: recordWorkedMinutes(record, sessions),
  };
}

async function loadAttendanceDays({ query, scope }: ReportInput) {
  const records = await db.query.attendanceDailyRecords.findMany({
    where: and(
      dateFrom(query) ? gte(attendanceDailyRecords.attendanceDate, dateFrom(query)!) : undefined,
      dateTo(query) ? lte(attendanceDailyRecords.attendanceDate, dateTo(query)!) : undefined,
      query.get('status') ? eq(attendanceDailyRecords.status, query.get('status')!) : undefined,
      query.get('employeeId') ? eq(attendanceDailyRecords.employeeId, query.get('employeeId')!) : undefined,
    ),
    with: {
      employee: { with: { department: true } },
      holiday: true,
    },
    orderBy: (table, { desc }) => [desc(table.attendanceDate)],
  });

  return sortAttendanceDays(records
    .filter((record) => matchesEmployeeFilters(record.employee, query, scope))
    .map((record) => toAttendanceDay(record, record.employee?.department?.nameEn ?? '')));
}

/** Newest day first, then by department and name so each day reads like the approval list. */
function sortAttendanceDays(days: AttendanceDay[]) {
  return days.sort((a, b) => (
    String(b.record.attendanceDate).localeCompare(String(a.record.attendanceDate))
    || a.department.localeCompare(b.department)
    || employeeName(a.record.employee).localeCompare(employeeName(b.record.employee))
  ));
}

function isSummaryView(query: URLSearchParams) {
  return query.get('view') === 'summary';
}

/** Puts one check-in, check-out and status column per shift session right after `afterKey`. */
function withSessionColumns(baseColumns: ReportColumn[], afterKey: string, days: AttendanceDay[]) {
  const { slotCount, columns: sessionColumns } = buildSessionSlotColumns(days.map((day) => day.sessions));
  const insertAt = baseColumns.findIndex((column) => column.key === afterKey) + 1;
  return {
    columns: [...baseColumns.slice(0, insertAt), ...sessionColumns, ...baseColumns.slice(insertAt)],
    sessionCells: (day: AttendanceDay) => sessionSlotValues(day.record, day.sessions, slotCount),
  };
}

/** Exception minutes do not apply on rest days and holidays; a dash reads better than a 0 there. */
function dutyMinutes(day: AttendanceDay, minutes: number) {
  return day.noDuty ? '-' : minutes;
}

function attendanceDayValues(day: AttendanceDay) {
  const { record } = day;
  return {
    attendanceDate: record.attendanceDate,
    employeeCode: record.employee?.employeeCode ?? '',
    employeeName: employeeName(record.employee),
    department: day.department,
    workedTime: day.workedMinutes ? formatDuration(day.workedMinutes) : '',
    lateMinutes: dutyMinutes(day, day.lateMinutes),
    earlyBreakMinutes: dutyMinutes(day, day.earlyBreakMinutes),
    earlyDepartureMinutes: dutyMinutes(day, day.earlyDepartureMinutes),
    attendanceDays: record.attendanceDays,
    leaveDays: record.leaveDays,
    holidayDays: record.holidayDays ?? '0.00',
    payableDays: record.payableDays,
    absenceDays: record.absenceDays,
    overtimeMinutes: record.overtimeMinutes ?? 0,
    overtimeHours: record.overtimeHours ?? '0.00',
    status: attendanceStatusLabels[record.status] ?? record.status,
    payrollNote: record.payrollNote ?? '',
  };
}

type EmployeeAttendanceTotals = {
  employeeCode: string;
  employeeName: string;
  department: string;
  directSupervisor: string;
  daysRecorded: number;
  temporaryAssignmentDays: number;
  workedMinutes: number;
  attendanceDays: number;
  absenceDays: number;
  absentSessions: number;
  leaveDays: number;
  holidayDays: number;
  payableDays: number;
  lateDays: number;
  lateCheckInMinutes: number;
  lateReturnMinutes: number;
  lateMinutes: number;
  earlyLeaveDays: number;
  earlyLeaveMinutes: number;
  overtimeMinutes: number;
  pendingSupervisor: number;
  payrollReady: number;
};

/** Per-employee totals; days arrive newest first, so the department shown is the latest one in range. */
function totalAttendanceByEmployee(days: AttendanceDay[]) {
  const totals = new Map<string, EmployeeAttendanceTotals>();
  for (const day of days) {
    const { record } = day;
    const total = totals.get(record.employeeId) ?? {
      employeeCode: record.employee?.employeeCode ?? '',
      employeeName: employeeName(record.employee),
      department: day.department,
      directSupervisor: directSupervisorName(record.employee),
      daysRecorded: 0,
      temporaryAssignmentDays: 0,
      workedMinutes: 0,
      attendanceDays: 0,
      absenceDays: 0,
      absentSessions: 0,
      leaveDays: 0,
      holidayDays: 0,
      payableDays: 0,
      lateDays: 0,
      lateCheckInMinutes: 0,
      lateReturnMinutes: 0,
      lateMinutes: 0,
      earlyLeaveDays: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      pendingSupervisor: 0,
      payrollReady: 0,
    };
    total.daysRecorded += 1;
    if (day.isTemporary) total.temporaryAssignmentDays += 1;
    total.workedMinutes += day.workedMinutes;
    total.attendanceDays += Number(record.attendanceDays ?? 0);
    total.absenceDays += Number(record.absenceDays ?? 0);
    total.absentSessions += day.sessions.filter((session) => session.attendanceStatus === 'ABSENT').length;
    total.leaveDays += Number(record.leaveDays ?? 0);
    total.holidayDays += Number(record.holidayDays ?? 0);
    total.payableDays += Number(record.payableDays ?? 0);
    if (!day.noDuty && day.lateMinutes > 0) total.lateDays += 1;
    if (!day.noDuty) {
      total.lateCheckInMinutes += day.lateCheckInMinutes;
      total.lateReturnMinutes += day.lateReturnMinutes;
      total.lateMinutes += day.lateMinutes;
      const earlyLeave = day.earlyBreakMinutes + day.earlyDepartureMinutes;
      if (earlyLeave > 0) total.earlyLeaveDays += 1;
      total.earlyLeaveMinutes += earlyLeave;
    }
    total.overtimeMinutes += Number(record.overtimeMinutes ?? 0);
    if (record.status === 'PENDING_SUPERVISOR') total.pendingSupervisor += 1;
    if (record.status === 'HR_APPROVED') total.payrollReady += 1;
    totals.set(record.employeeId, total);
  }

  return [...totals.values()]
    .sort((a, b) => a.department.localeCompare(b.department) || a.employeeName.localeCompare(b.employeeName))
    .map((total) => ({
      ...total,
      workedTime: formatDuration(total.workedMinutes),
      workedHours: minutesToHours(total.workedMinutes),
      attendanceDays: roundDays(total.attendanceDays),
      absenceDays: roundDays(total.absenceDays),
      leaveDays: roundDays(total.leaveDays),
      holidayDays: roundDays(total.holidayDays),
      payableDays: roundDays(total.payableDays),
      lateTime: formatDuration(total.lateMinutes),
      overtimeHours: minutesToHours(total.overtimeMinutes),
      averageLateMinutes: total.lateDays ? Math.round(total.lateMinutes / total.lateDays) : 0,
    }));
}

function roundDays(value: number) {
  return Math.round(value * 100) / 100;
}

function attendanceHighlights(days: AttendanceDay[]): ReportHighlight[] {
  const sum = (pick: (day: AttendanceDay) => number) => days.reduce((total, day) => total + pick(day), 0);
  const dutyDays = days.filter((day) => !day.noDuty);
  const lateDays = dutyDays.filter((day) => day.lateMinutes > 0);
  const earlyDays = dutyDays.filter((day) => day.earlyBreakMinutes + day.earlyDepartureMinutes > 0);
  return [
    { label: 'Employees', value: new Set(days.map((day) => day.record.employeeId)).size, detail: `${days.length} day records` },
    { label: 'Attendance days', value: roundDays(sum((day) => Number(day.record.attendanceDays ?? 0))) },
    { label: 'Absence days', value: roundDays(sum((day) => Number(day.record.absenceDays ?? 0))) },
    {
      label: 'Absent sessions',
      value: sum((day) => day.sessions.filter((session) => session.attendanceStatus === 'ABSENT').length),
    },
    { label: 'Leave days', value: roundDays(sum((day) => Number(day.record.leaveDays ?? 0))) },
    { label: 'Late', value: lateDays.length, detail: formatDuration(lateDays.reduce((total, day) => total + day.lateMinutes, 0)) },
    {
      label: 'Early break / leave',
      value: earlyDays.length,
      detail: formatDuration(earlyDays.reduce((total, day) => total + day.earlyBreakMinutes + day.earlyDepartureMinutes, 0)),
    },
    { label: 'Payable days', value: roundDays(sum((day) => Number(day.record.payableDays ?? 0))) },
  ];
}

async function buildAttendanceDailyRows(input: ReportInput): Promise<ReportResult> {
  const days = await loadAttendanceDays(input);
  const highlights = attendanceHighlights(days);
  if (isSummaryView(input.query)) {
    return { rows: totalAttendanceByEmployee(days), columns: attendanceTotalsColumns, highlights };
  }

  const { columns, sessionCells } = withSessionColumns(attendanceDailyColumns, 'department', days);
  const rows = days.map((day) => {
    const { attendanceDate, employeeCode, employeeName, department, ...metrics } = attendanceDayValues(day);
    return { attendanceDate, employeeCode, employeeName, department, ...sessionCells(day), ...metrics };
  });
  return { rows, columns, highlights };
}

async function buildLateAttendanceRows(input: ReportInput): Promise<ReportResult> {
  const minLateMinutes = numberFilter(input.query, 'minLateMinutes');
  const lateDays = (await loadAttendanceDays(input))
    .filter((day) => !day.noDuty && day.lateMinutes > 0 && day.lateMinutes >= minLateMinutes);
  const totalLate = lateDays.reduce((total, day) => total + day.lateMinutes, 0);
  const highlights: ReportHighlight[] = [
    { label: 'Late records', value: lateDays.length },
    { label: 'Employees late', value: new Set(lateDays.map((day) => day.record.employeeId)).size },
    { label: 'Total late time', value: formatDuration(totalLate), detail: `${totalLate} min` },
    { label: 'Late check-in', value: formatDuration(lateDays.reduce((total, day) => total + day.lateCheckInMinutes, 0)) },
    { label: 'Late return from break', value: formatDuration(lateDays.reduce((total, day) => total + day.lateReturnMinutes, 0)) },
    { label: 'Average per late day', value: lateDays.length ? `${Math.round(totalLate / lateDays.length)} min` : '0 min' },
  ];

  if (isSummaryView(input.query)) {
    const rows = totalAttendanceByEmployee(lateDays)
      .sort((a, b) => b.lateMinutes - a.lateMinutes || a.employeeName.localeCompare(b.employeeName));
    return { rows, columns: lateTotalsColumns, highlights };
  }

  const { columns, sessionCells } = withSessionColumns(lateAttendanceColumns, 'department', lateDays);
  const rows = lateDays.map((day) => {
    const { attendanceDate, employeeCode, employeeName, department, attendanceDays, absenceDays, leaveDays, status } = attendanceDayValues(day);
    return {
      attendanceDate,
      employeeCode,
      employeeName,
      department,
      ...sessionCells(day),
      lateCheckInMinutes: day.lateCheckInMinutes,
      lateReturnMinutes: day.lateReturnMinutes,
      lateMinutes: day.lateMinutes,
      lateTime: formatDuration(day.lateMinutes),
      attendanceDays,
      absenceDays,
      leaveDays,
      status,
    };
  });
  return { rows, columns, highlights };
}

async function buildAttendancePunchRows({ query, scope }: ReportInput) {
  const records = await db.query.attendancePunches.findMany({
    where: and(
      dateTimeFrom(query) ? gte(attendancePunches.punchTime, dateTimeFrom(query)!) : undefined,
      dateTimeTo(query) ? lte(attendancePunches.punchTime, dateTimeTo(query)!) : undefined,
      query.get('deviceId') ? eq(attendancePunches.deviceId, query.get('deviceId')!) : undefined,
      query.get('status') === 'processed' ? eq(attendancePunches.isProcessed, true) : undefined,
      query.get('status') === 'unprocessed' ? eq(attendancePunches.isProcessed, false) : undefined,
    ),
    with: {
      employee: { with: { department: true, position: true } },
      device: true,
    },
    orderBy: (table, { desc }) => [desc(table.punchTime)],
  });

  return records
    .filter((record) => matchesEmployeeFilters(record.employee, query, scope))
    .map((record) => ({
      punchTime: formatDateTime(record.punchTime),
      employeeCode: record.employee?.employeeCode ?? '',
      employeeName: employeeName(record.employee),
      department: record.employee?.department?.nameEn ?? '',
      biometricId: record.biometricId,
      deviceName: record.device?.deviceName ?? '',
      punchType: record.punchType,
      source: record.source,
      processed: record.isProcessed ? 'Yes' : 'No',
    }));
}

async function buildOvertimeRows({ query, scope }: ReportInput) {
  const requests = await db.query.overtimeRequests.findMany({
    where: and(
      eq(overtimeRequests.status, 'APPROVED'),
      dateFrom(query) ? gte(overtimeRequests.overtimeDate, dateFrom(query)!) : undefined,
      dateTo(query) ? lte(overtimeRequests.overtimeDate, dateTo(query)!) : undefined,
    ),
    with: {
      employee: { with: { department: true, position: true } },
    },
    orderBy: (table, { desc }) => [desc(table.overtimeDate)],
  });
  const minOvertimeMinutes = numberFilter(query, 'minOvertimeMinutes');

  return requests
    .filter((request) => matchesEmployeeFilters(request.employee, query, scope))
    .map((request) => {
      if (request.approvedMinutes < minOvertimeMinutes) return null;

      return {
        attendanceDate: request.overtimeDate,
        employeeCode: request.employee?.employeeCode ?? '',
        employeeName: employeeName(request.employee),
        department: request.employee?.department?.nameEn ?? '',
        startAt: formatDateTime(request.startAt),
        endAt: formatDateTime(request.endAt),
        approvedMinutes: request.approvedMinutes,
        approvedHours: Math.round((request.approvedMinutes / 60) * 100) / 100,
        overtimeDays: request.overtimeDays,
        reason: request.reason,
        payrollNote: request.payrollNote ?? '',
        status: request.status,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
}

async function buildLeaveBalanceRows({ query, scope }: ReportInput) {
  const records = await db.query.leaveBalances.findMany({
    where: and(
      query.get('fiscalYearId') ? eq(leaveBalances.fiscalYearId, query.get('fiscalYearId')!) : undefined,
      query.get('lowBalance') === 'true' ? lte(leaveBalances.available, '5') : undefined,
    ),
    with: {
      employee: { with: { department: true, position: true } },
      fiscalYear: true,
    },
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  });

  return records
    .filter((record) => matchesEmployeeFilters(record.employee, query, scope))
    .map((record) => ({
      employeeCode: record.employee?.employeeCode ?? '',
      employeeName: employeeName(record.employee),
      department: record.employee?.department?.nameEn ?? '',
      fiscalYear: record.fiscalYear?.name ?? '',
      employmentType: record.employmentTypeSnapshot,
      opening: record.opening,
      transferredIn: record.transferredIn,
      reserved: record.reserved,
      used: record.used,
      available: record.available,
    }));
}

async function buildLeaveRequestRows({ query, scope }: ReportInput) {
  const records = await db.query.leaveRequests.findMany({
    where: and(
      dateFrom(query) ? gte(leaveRequests.startDate, dateFrom(query)!) : undefined,
      dateTo(query) ? lte(leaveRequests.startDate, dateTo(query)!) : undefined,
      query.get('status')
        ? eq(leaveRequests.status, query.get('status')!)
        : scope.type === 'hr'
          ? eq(leaveRequests.status, 'AUTHORIZED')
          : undefined,
      query.get('leaveTypeId') ? eq(leaveRequests.leaveTypeId, query.get('leaveTypeId')!) : undefined,
    ),
    with: {
      employee: { with: { department: true, position: true } },
      leaveType: true,
      fiscalYear: true,
      annualLeaveDates: true,
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return records
    .filter((record) => matchesEmployeeFilters(record.employee, query, scope))
    .map((record) => {
      const originalApproved = record.annualLeaveDates
        .filter((date) => date.source === 'ORIGINAL' && date.status === 'APPROVED')
        .reduce((sum, date) => sum + Number(date.approvedDayValue ?? 0), 0);
      const consumed = record.annualLeaveDates
        .filter((date) => date.status === 'APPROVED' && date.utilizationStatus === 'CONSUMED')
        .reduce((sum, date) => sum + Number(date.approvedDayValue ?? 0), 0);
      const interrupted = record.annualLeaveDates
        .filter((date) => date.status === 'APPROVED' && date.utilizationStatus === 'INTERRUPTED')
        .reduce((sum, date) => sum + Number(date.approvedDayValue ?? 0), 0);
      return {
      createdAt: formatDateTime(record.createdAt),
      employeeCode: record.employee?.employeeCode ?? '',
      employeeName: employeeName(record.employee),
      department: record.employee?.department?.nameEn ?? '',
      leaveType: record.leaveType?.nameEn ?? '',
      startDate: record.startDate,
      endDate: record.endDate,
      requestedDays: record.requestedDays,
      approvedDays: originalApproved.toFixed(2),
      consumedDays: consumed.toFixed(2),
      interruptedDays: interrupted.toFixed(2),
      remainingDays: Math.max(0, originalApproved - consumed).toFixed(2),
      status: record.status,
      };
    });
}

async function buildEmployeeRows({ query, scope }: ReportInput) {
  const records = await db.query.employees.findMany({
    where: and(
      scopedEmployeeWhere(scope),
      query.get('departmentId') ? eq(employees.departmentId, query.get('departmentId')!) : undefined,
      query.get('employmentType') ? eq(employees.employmentType, query.get('employmentType')!) : undefined,
      query.get('employmentStatus') ? eq(employees.employmentStatus, query.get('employmentStatus')!) : undefined,
      query.get('employeeId') ? eq(employees.id, query.get('employeeId')!) : undefined,
      query.get('search') ? or(
        ilike(employees.employeeCode, `%${query.get('search')}%`),
        ilike(employees.firstNameEn, `%${query.get('search')}%`),
        ilike(employees.lastNameEn, `%${query.get('search')}%`),
        ilike(employees.firstNameAm, `%${query.get('search')}%`),
        ilike(employees.lastNameAm, `%${query.get('search')}%`),
      ) : undefined,
    ),
    with: { department: true, position: true },
    orderBy: (table, { asc }) => [asc(table.employeeCode)],
  });

  return records.map((employee) => ({
    employeeCode: employee.employeeCode,
    employeeName: employeeName(employee),
    department: employee.department?.nameEn ?? '',
    position: employee.position?.nameEn ?? employee.positionName ?? '',
    employmentType: employee.employmentType,
    employmentStatus: employee.employmentStatus,
    hireDate: employee.hireDate ?? '',
    phoneNumber: employee.phoneNumber ?? '',
    email: employee.email ?? '',
  }));
}

const NO_ROLE_FILTER = '__none';

// Same filters as the users list: search (name, email, phone, role), role, login status and email status.
async function buildUserRows({ query }: ReportInput): Promise<ReportResult> {
  const search = query.get('search')?.trim().toLowerCase() ?? '';
  const roleFilter = query.get('role') ?? '';
  const loginStatus = query.get('loginStatus') ?? '';
  const emailStatus = query.get('emailStatus') ?? '';
  const now = Date.now();

  const users = await db.query.user.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      phone: true,
      emailVerified: true,
      failedLoginCount: true,
      lockedUntil: true,
      accessRevokedAt: true,
      accessRevokedReason: true,
      createdAt: true,
    },
    with: { userRoles: { with: { role: { columns: { name: true } } } } },
    orderBy: [asc(user.name)],
  });

  const rows = users
    .map((record) => {
      const roleNames = record.userRoles.map((userRole) => userRole.role.name).sort();
      const locked = Boolean(record.lockedUntil && new Date(record.lockedUntil).getTime() > now);
      const status = record.accessRevokedAt ? 'revoked' : locked ? 'locked' : 'active';
      return { record, roleNames, locked, status };
    })
    .filter(({ record, roleNames, status }) => {
      if (roleFilter === NO_ROLE_FILTER ? roleNames.length > 0 : roleFilter && !roleNames.includes(roleFilter)) return false;
      if (loginStatus && status !== loginStatus) return false;
      if (emailStatus && (emailStatus === 'verified') !== Boolean(record.emailVerified)) return false;
      if (!search) return true;
      return [record.name, record.email, record.phone, ...roleNames]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(search);
    })
    .map(({ record, roleNames, locked, status }) => ({
      name: record.name ?? '',
      email: record.email ?? '',
      phone: record.phone ?? '',
      roles: roleNames.join(', '),
      loginStatus: status === 'revoked' ? 'Access revoked' : status === 'locked' ? 'Locked' : 'Active',
      emailStatus: record.emailVerified ? 'Verified' : 'Unverified',
      failedLoginCount: record.failedLoginCount ?? 0,
      lockedUntil: locked ? formatDateTime(record.lockedUntil) : '',
      accessRevokedAt: formatDateTime(record.accessRevokedAt),
      accessRevokedReason: record.accessRevokedReason ?? '',
      createdAt: formatDateTime(record.createdAt),
      roleNames,
    }));

  // Headcount per role among the matching users; a user with several roles counts under each.
  const roleCounts = new Map<string, number>();
  for (const row of rows) {
    for (const role of row.roleNames.length ? row.roleNames : ['No role']) {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
  }

  return {
    rows: rows.map(({ roleNames: _roleNames, ...row }) => row),
    columns: reportDefinitions.users.columns,
    highlights: [
      { label: 'Users', value: rows.length },
      ...[...roleCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([role, count]) => ({ label: role, value: count })),
    ],
  };
}

async function buildDeviceSyncRows({ query }: ReportInput) {
  const records = await db.query.attendanceSyncBatches.findMany({
    where: and(
      dateTimeFrom(query, 'dateFrom') ? gte(attendanceSyncBatches.syncStartedAt, dateTimeFrom(query, 'dateFrom')!) : undefined,
      dateTimeTo(query, 'dateTo') ? lte(attendanceSyncBatches.syncStartedAt, dateTimeTo(query, 'dateTo')!) : undefined,
      query.get('deviceId') ? eq(attendanceSyncBatches.deviceId, query.get('deviceId')!) : undefined,
      query.get('status') ? eq(attendanceSyncBatches.syncStatus, query.get('status')!) : undefined,
    ),
    with: { device: { with: { department: true } } },
    orderBy: (table, { desc }) => [desc(table.syncStartedAt)],
  });

  return records.map((record) => ({
    syncStartedAt: formatDateTime(record.syncStartedAt),
    syncCompletedAt: formatDateTime(record.syncCompletedAt),
    deviceName: record.device?.deviceName ?? '',
    deviceCode: record.device?.deviceCode ?? '',
    department: record.device?.department?.nameEn ?? '',
    syncStatus: record.syncStatus,
    totalRecords: record.totalRecords,
    successfulRecords: record.successfulRecords,
    failedRecords: record.failedRecords,
    errorMessage: record.errorMessage ?? '',
  }));
}

async function loadSupervisorAttendanceDays({ query, supervisorScope }: ReportInput) {
  if (!supervisorScope) throw new Error('You do not have permission to view this report');
  const rows = await getSupervisorAttendanceRecords({
    scope: supervisorScope,
    departmentId: query.get('departmentId'),
    search: query.get('search'),
    dateFrom: dateFrom(query),
    dateTo: dateTo(query),
    status: query.get('status'),
  });
  return rows.map(({ record, effectiveDepartmentName, homeDepartmentName, isTemporary }) => (
    toAttendanceDay(record, effectiveDepartmentName, homeDepartmentName, isTemporary)
  ));
}

function directSupervisorName(employee: any) {
  return employeeName(employee?.supervisorAssignments?.[0]?.supervisor);
}

async function buildSupervisorAttendanceRows(input: ReportInput): Promise<ReportResult> {
  const days = await loadSupervisorAttendanceDays(input);
  const { columns, sessionCells } = withSessionColumns(
    reportDefinitions['supervisor-attendance'].columns,
    'directSupervisor',
    days,
  );

  const rows = days.map((day) => {
    const values = attendanceDayValues(day);
    return {
      attendanceDate: values.attendanceDate,
      employeeCode: values.employeeCode,
      employeeName: values.employeeName,
      department: values.department,
      temporaryFrom: day.isTemporary ? day.homeDepartment : '',
      directSupervisor: directSupervisorName(day.record.employee),
      ...sessionCells(day),
      workedTime: values.workedTime,
      lateMinutes: values.lateMinutes,
      earlyBreakMinutes: values.earlyBreakMinutes,
      earlyDepartureMinutes: values.earlyDepartureMinutes,
      attendanceDays: values.attendanceDays,
      leaveDays: values.leaveDays,
      holidayDays: values.holidayDays,
      absenceDays: values.absenceDays,
      status: values.status,
    };
  });

  return { rows, columns, highlights: attendanceHighlights(days) };
}

async function buildSupervisorAttendanceSummaryRows(input: ReportInput): Promise<ReportResult> {
  const days = await loadSupervisorAttendanceDays(input);
  return {
    rows: totalAttendanceByEmployee(days),
    columns: reportDefinitions['supervisor-attendance-summary'].columns,
    highlights: attendanceHighlights(days),
  };
}

function matchesEmployeeFilters(employee: any, query: URLSearchParams, scope: EmployeeVisibilityScope) {
  if (!employee) return false;
  if (!isEmployeeVisibleInScope(employee, scope)) return false;
  if (query.get('departmentId') && employee.departmentId !== query.get('departmentId')) return false;
  if (query.get('employeeId') && employee.id !== query.get('employeeId')) return false;
  return true;
}

async function buildAuditRows({ query, scope }: ReportInput) {
  const events = await listAuditEvents({
    departmentIds: scope.type === 'hr-departments' ? scope.departmentIds : null,
    dateFrom: dateFrom(query),
    dateTo: dateTo(query),
    actorUserId: query.get('actorUserId'),
    actorSearch: query.get('actorSearch'),
    action: query.get('action'),
    resourceType: query.get('resourceType'),
    employeeId: query.get('employeeId'),
    departmentId: query.get('departmentId'),
    outcome: query.get('outcome'),
    delegatedOnly: query.get('delegatedOnly') === 'true',
  });

  return events.map((event) => ({
    occurredAt: event.occurredAt ? new Date(event.occurredAt).toISOString() : '',
    actorName: event.actorName ?? (event.actorType === 'SYSTEM' ? 'System' : ''),
    actorType: event.actorType,
    action: event.action,
    actionLabel: auditActionLabel(event.action),
    outcome: event.outcome,
    resourceType: event.resourceType,
    resourceLabel: event.resourceLabel ?? '',
    employeeName: employeeName(event.employee),
    department: event.department?.nameEn ?? '',
    delegated: event.supervisorDelegationId ? 'Yes' : 'No',
    changesSummary: summarizeChanges(event.changes as AuditChanges | null),
  }));
}

function employeeName(employee: any) {
  return employeeDisplayName(employee);
}

function dateFrom(query: URLSearchParams) {
  return query.get('dateFrom') || null;
}

function dateTo(query: URLSearchParams) {
  return query.get('dateTo') || null;
}

function dateTimeFrom(query: URLSearchParams, key = 'dateFrom') {
  const date = query.get(key);
  const time = key === 'dateFrom' ? query.get('timeFrom') : null;
  return date ? new Date(`${date}T${time || '00:00'}:00`) : null;
}

function dateTimeTo(query: URLSearchParams, key = 'dateTo') {
  const date = query.get(key);
  const time = key === 'dateTo' ? query.get('timeTo') : null;
  return date ? new Date(`${date}T${time || '23:59'}:59.999`) : null;
}

function numberFilter(query: URLSearchParams, key: string) {
  const value = Number(query.get(key) ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16);
}

function reportError(c: any, error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const status = message.includes('Authentication')
    ? 401
    : message.includes('permission')
      ? 403
      : 500;
  if (status >= 500) {
    console.error('Report error', error);
  }
  return c.json({ success: false, error: status >= 500 ? 'Failed to generate report' : message }, status);
}

export default reportsApp;
