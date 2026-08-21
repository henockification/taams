import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db/db';
import {
  attendanceDailyRecords,
  attendancePunches,
  attendanceSyncBatches,
  biometricDevices,
  departments,
  employeeWorkSchedules,
  employees,
  leaveBalances,
  leaveFiscalYears,
  leaveRequests,
  leaveTypes,
  overtimeRequests,
} from '../../db/schema';
import { getSessionByToken } from '../../db/orm/auth/manageAuth';
import { getUserPermissionNames, userHasPermission } from '../../db/orm/rbac/manageRbac';
import {
  resolveEmployeeVisibilityScope,
  scopedEmployeeWhere,
  type EmployeeVisibilityScope,
} from '../../db/orm/core/manageEmployeeVisibility';
import { clearSessionCookie, getSessionCookie } from '../auth/handlers/helpers';

type ReportKey =
  | 'attendance-daily'
  | 'attendance-punches'
  | 'late-attendance'
  | 'overtime'
  | 'leave-balances'
  | 'leave-requests'
  | 'employees'
  | 'device-sync';

type ReportColumn = {
  key: string;
  label: string;
};

type ReportDefinition = {
  title: string;
  permission: string;
  columns: ReportColumn[];
  buildRows: (input: ReportInput) => Promise<Record<string, unknown>[]>;
};

type ReportInput = {
  query: URLSearchParams;
  scope: EmployeeVisibilityScope;
};

const reportsApp = new Hono();
const DEFAULT_SHIFT_START = '08:30:00';

const reportDefinitions: Record<ReportKey, ReportDefinition> = {
  'attendance-daily': {
    title: 'Attendance Daily Summary',
    permission: 'reports-attendance-daily:read',
    columns: [
      { key: 'attendanceDate', label: 'Date' },
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'department', label: 'Department' },
      { key: 'checkInAt', label: 'Check in' },
      { key: 'checkOutAt', label: 'Check out' },
      { key: 'totalPunches', label: 'Punches' },
      { key: 'attendanceDays', label: 'Attendance days' },
      { key: 'leaveDays', label: 'Leave days' },
      { key: 'holidayDays', label: 'Holiday/off-day days' },
      { key: 'holidayName', label: 'Holiday/off-day' },
      { key: 'holidayType', label: 'Holiday/off-day type' },
      { key: 'payableDays', label: 'Payable days' },
      { key: 'absenceDays', label: 'Absence days' },
      { key: 'overtimeMinutes', label: 'Approved overtime minutes' },
      { key: 'overtimeHours', label: 'Approved overtime hours' },
      { key: 'overtimeDays', label: 'Overtime days' },
      { key: 'payrollNote', label: 'Payroll note' },
      { key: 'status', label: 'Status' },
    ],
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
    columns: [
      { key: 'attendanceDate', label: 'Date' },
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'department', label: 'Department' },
      { key: 'shiftName', label: 'Shift' },
      { key: 'scheduledStart', label: 'Scheduled start' },
      { key: 'lateThreshold', label: 'Late threshold' },
      { key: 'checkInAt', label: 'Actual check in' },
      { key: 'arrivalDelayMinutes', label: 'Delay from start (min)' },
      { key: 'lateMinutes', label: 'Late after grace (min)' },
      { key: 'status', label: 'Status' },
    ],
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
};

reportsApp.get('/reports/:key', async (c) => {
  try {
    const key = c.req.param('key') as ReportKey;
    const definition = reportDefinitions[key];
    if (!definition) return c.json({ success: false, error: 'Report not found' }, 404);

    const context = await getReportContext(c, definition.permission);
    const rows = await definition.buildRows({ query: new URL(c.req.url).searchParams, scope: context.scope });

    return c.json({
      success: true,
      report: {
        key,
        title: definition.title,
        generatedAt: new Date().toISOString(),
        columns: definition.columns,
        rows,
        summary: { totalRows: rows.length },
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

    const context = await getReportContext(c, definition.permission);
    const rows = await definition.buildRows({ query: new URL(c.req.url).searchParams, scope: context.scope });
    const worksheetRows = rows.map((row) => Object.fromEntries(
      definition.columns.map((column) => [column.label, row[column.key] ?? '']),
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

async function getReportContext(c: any, permission: string) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');

  const session = await getSessionByToken(token);
  if (!session?.user?.id) {
    clearSessionCookie(c);
    throw new Error('Authentication required');
  }

  const roles = (session.user.role ?? []).map((role) => role.toLowerCase());
  const unrestricted = roles.some((role) => ['super_admin', 'superadmin', 'admin', 'executive'].includes(role));
  if (!unrestricted && !(await userHasPermission(session.user.id, permission))) {
    throw new Error('You do not have permission to view this report');
  }

  const permissions = await getUserPermissionNames(session.user.id);
  const scope = await resolveEmployeeVisibilityScope({
    userId: session.user.id,
    roles: session.user.role ?? [],
    permissions,
  });

  return { session, scope };
}

async function buildAttendanceDailyRows({ query, scope }: ReportInput) {
  const records = await db.query.attendanceDailyRecords.findMany({
    where: and(
      dateFrom(query) ? gte(attendanceDailyRecords.attendanceDate, dateFrom(query)!) : undefined,
      dateTo(query) ? lte(attendanceDailyRecords.attendanceDate, dateTo(query)!) : undefined,
      query.get('status') ? eq(attendanceDailyRecords.status, query.get('status')!) : undefined,
    ),
    with: {
      employee: { with: { department: true, position: true } },
      holiday: true,
    },
    orderBy: (table, { desc }) => [desc(table.attendanceDate)],
  });

  return records
    .filter((record) => matchesEmployeeFilters(record.employee, query, scope))
    .map((record) => ({
      attendanceDate: record.attendanceDate,
      employeeCode: record.employee?.employeeCode ?? '',
      employeeName: employeeName(record.employee),
      department: record.employee?.department?.nameEn ?? '',
      checkInAt: formatDateTime(record.checkInAt),
      checkOutAt: formatDateTime(record.checkOutAt),
      totalPunches: record.totalPunches,
      attendanceDays: record.attendanceDays,
      leaveDays: record.leaveDays,
      holidayDays: record.holidayDays ?? '0.00',
      holidayName: record.holiday?.nameEn ?? '',
      holidayType: record.holiday?.type ?? '',
      payableDays: record.payableDays,
      absenceDays: record.absenceDays,
      overtimeMinutes: record.overtimeMinutes ?? 0,
      overtimeHours: record.overtimeHours ?? '0.00',
      overtimeDays: record.overtimeDays ?? '0.00',
      payrollNote: record.payrollNote ?? '',
      status: record.status,
    }));
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

async function buildLateAttendanceRows({ query, scope }: ReportInput) {
  const records = await getScheduleBasedAttendanceRecords(query);
  const schedules = await getScheduleAssignmentsForRecords(records);
  const minLateMinutes = numberFilter(query, 'minLateMinutes');

  return records
    .filter((record) => matchesEmployeeFilters(record.employee, query, scope))
    .map((record) => {
      if (!record.checkInAt) return null;
      const schedule = resolveScheduleWindow(record, schedules);
      if (!schedule) return null;
      const checkInAt = new Date(record.checkInAt);
      const lateMinutes = minutesBetween(schedule.lateThreshold, checkInAt);
      if (lateMinutes <= 0 || lateMinutes < minLateMinutes) return null;

      return {
        attendanceDate: record.attendanceDate,
        employeeCode: record.employee?.employeeCode ?? '',
        employeeName: employeeName(record.employee),
        department: record.employee?.department?.nameEn ?? '',
        shiftName: schedule.shiftName,
        scheduledStart: formatDateTime(schedule.scheduledStart),
        lateThreshold: formatDateTime(schedule.lateThreshold),
        checkInAt: formatDateTime(checkInAt),
        arrivalDelayMinutes: Math.max(0, minutesBetween(schedule.scheduledStart, checkInAt)),
        lateMinutes,
        status: record.status,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];
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
      used: record.used,
      available: record.available,
    }));
}

async function buildLeaveRequestRows({ query, scope }: ReportInput) {
  const records = await db.query.leaveRequests.findMany({
    where: and(
      dateFrom(query) ? gte(leaveRequests.startDate, dateFrom(query)!) : undefined,
      dateTo(query) ? lte(leaveRequests.startDate, dateTo(query)!) : undefined,
      scope.type === 'hr' ? eq(leaveRequests.status, 'APPROVED') : undefined,
      query.get('status') ? eq(leaveRequests.status, query.get('status')!) : undefined,
      query.get('leaveTypeId') ? eq(leaveRequests.leaveTypeId, query.get('leaveTypeId')!) : undefined,
    ),
    with: {
      employee: { with: { department: true, position: true } },
      leaveType: true,
      fiscalYear: true,
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  return records
    .filter((record) => matchesEmployeeFilters(record.employee, query, scope))
    .map((record) => ({
      createdAt: formatDateTime(record.createdAt),
      employeeCode: record.employee?.employeeCode ?? '',
      employeeName: employeeName(record.employee),
      department: record.employee?.department?.nameEn ?? '',
      leaveType: record.leaveType?.nameEn ?? '',
      startDate: record.startDate,
      endDate: record.endDate,
      requestedDays: record.requestedDays,
      status: record.status,
    }));
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

async function getScheduleBasedAttendanceRecords(query: URLSearchParams) {
  return db.query.attendanceDailyRecords.findMany({
    where: and(
      dateFrom(query) ? gte(attendanceDailyRecords.attendanceDate, dateFrom(query)!) : undefined,
      dateTo(query) ? lte(attendanceDailyRecords.attendanceDate, dateTo(query)!) : undefined,
      query.get('status') ? eq(attendanceDailyRecords.status, query.get('status')!) : undefined,
      query.get('employeeId') ? eq(attendanceDailyRecords.employeeId, query.get('employeeId')!) : undefined,
    ),
    with: {
      employee: { with: { department: true, position: true } },
    },
    orderBy: (table, { desc }) => [desc(table.attendanceDate)],
  });
}

async function getScheduleAssignmentsForRecords(records: any[]) {
  if (records.length === 0) return new Map<string, any[]>();

  const employeeIds = [...new Set(records.map((record) => record.employeeId).filter(Boolean))];
  const dates = records.map((record) => String(record.attendanceDate));
  const minDate = dates.reduce((min, date) => date < min ? date : min, dates[0]);
  const maxDate = dates.reduce((max, date) => date > max ? date : max, dates[0]);

  const assignments = await db.query.employeeWorkSchedules.findMany({
    where: and(
      inArray(employeeWorkSchedules.employeeId, employeeIds),
      eq(employeeWorkSchedules.isActive, true),
      lte(employeeWorkSchedules.effectiveFrom, maxDate),
      or(
        isNull(employeeWorkSchedules.effectiveTo),
        gte(employeeWorkSchedules.effectiveTo, minDate),
      ),
    ),
    with: {
      workSchedule: {
        with: {
          days: {
            with: {
              shift: {
                with: {
                  segments: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.effectiveFrom)],
  });

  const grouped = new Map<string, any[]>();
  for (const assignment of assignments) {
    grouped.set(assignment.employeeId, [...(grouped.get(assignment.employeeId) ?? []), assignment]);
  }
  return grouped;
}

function resolveScheduleWindow(record: any, schedulesByEmployee: Map<string, any[]>) {
  const date = String(record.attendanceDate);
  const assignment = (schedulesByEmployee.get(record.employeeId) ?? []).find((item) => (
    item.effectiveFrom <= date && (!item.effectiveTo || item.effectiveTo >= date)
  ));
  const dayOfWeek = getDayOfWeek(date);
  const day = assignment?.workSchedule?.days?.find((item: any) => item.dayOfWeek === dayOfWeek && item.isActive && !item.isOffDay);
  const shift = day?.shift;
  if (!shift) return null;

  const segments = [...(shift.segments ?? [])].filter((segment: any) => segment.isActive).sort((left: any, right: any) => {
    const sortOrder = Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0);
    return sortOrder || String(left.startTime).localeCompare(String(right.startTime));
  });
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const startTime = firstSegment?.startTime ?? DEFAULT_SHIFT_START;
  const endTime = lastSegment?.endTime ?? shiftEndFallback(startTime);
  const scheduledStart = new Date(`${date}T${startTime}`);
  const scheduledEnd = new Date(`${date}T${endTime}`);

  if (shift.isOvernight || scheduledEnd <= scheduledStart) {
    scheduledEnd.setDate(scheduledEnd.getDate() + 1);
  }

  const lateThreshold = new Date(scheduledStart);
  lateThreshold.setMinutes(lateThreshold.getMinutes() + Number(shift.gracePeriodMinutes ?? 0) + Number(shift.lateAfterMinutes ?? 0));

  return {
    shiftName: shift.nameEn ?? '',
    scheduledStart,
    lateThreshold,
    scheduledEnd,
  };
}

function getDayOfWeek(date: string) {
  return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date(`${date}T00:00:00`).getDay()];
}

function shiftEndFallback(startTime: string) {
  const start = new Date(`2000-01-01T${startTime}`);
  start.setHours(start.getHours() + 8);
  return start.toTimeString().slice(0, 8);
}

function minutesBetween(start: Date, end: Date) {
  return Math.floor((end.getTime() - start.getTime()) / 60_000);
}

function matchesEmployeeFilters(employee: any, query: URLSearchParams, scope: EmployeeVisibilityScope) {
  if (!employee) return false;
  if (scope.type === 'self' && employee.userId !== scope.userId) return false;
  if (query.get('departmentId') && employee.departmentId !== query.get('departmentId')) return false;
  if (query.get('employeeId') && employee.id !== query.get('employeeId')) return false;
  return true;
}

function employeeName(employee: any) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
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
  return c.json({ success: false, error: message }, status);
}

export default reportsApp;
