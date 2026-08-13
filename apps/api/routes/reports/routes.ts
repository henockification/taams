import { Hono } from 'hono';
import * as XLSX from 'xlsx';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or } from 'drizzle-orm';
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
} from '../../db/schema';
import { getSessionByToken } from '../../db/orm/auth/manageAuth';
import { getUserPermissionNames, userHasPermission } from '../../db/orm/rbac/manageRbac';
import {
  resolveEmployeeVisibilityScope,
  scopedEmployeeWhere,
  type EmployeeVisibilityScope,
} from '../../db/orm/core/manageHrUnits';
import { clearSessionCookie, getSessionCookie } from '../auth/handlers/helpers';

type ReportKey =
  | 'attendance-daily'
  | 'attendance-punches'
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

const reportDefinitions: Record<ReportKey, ReportDefinition> = {
  'attendance-daily': {
    title: 'Attendance Daily Summary',
    permission: 'reports-attendance-daily:read',
    columns: [
      { key: 'attendanceDate', label: 'Date' },
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'hrUnit', label: 'HR Unit' },
      { key: 'department', label: 'Department' },
      { key: 'checkInAt', label: 'Check in' },
      { key: 'checkOutAt', label: 'Check out' },
      { key: 'totalPunches', label: 'Punches' },
      { key: 'attendanceDays', label: 'Attendance days' },
      { key: 'leaveDays', label: 'Leave days' },
      { key: 'payableDays', label: 'Payable days' },
      { key: 'absenceDays', label: 'Absence days' },
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
      { key: 'hrUnit', label: 'HR Unit' },
      { key: 'department', label: 'Department' },
      { key: 'biometricId', label: 'Biometric ID' },
      { key: 'deviceName', label: 'Device' },
      { key: 'punchType', label: 'Punch type' },
      { key: 'source', label: 'Source' },
      { key: 'processed', label: 'Processed' },
    ],
    buildRows: buildAttendancePunchRows,
  },
  'leave-balances': {
    title: 'Leave Balances',
    permission: 'reports-leave-balances:read',
    columns: [
      { key: 'employeeCode', label: 'Employee ID' },
      { key: 'employeeName', label: 'Employee name' },
      { key: 'hrUnit', label: 'HR Unit' },
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
      { key: 'hrUnit', label: 'HR Unit' },
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
      { key: 'hrUnit', label: 'HR Unit' },
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
      employee: { with: { department: true, hrUnit: true, position: true } },
    },
    orderBy: (table, { desc }) => [desc(table.attendanceDate)],
  });

  return records
    .filter((record) => matchesEmployeeFilters(record.employee, query, scope))
    .map((record) => ({
      attendanceDate: record.attendanceDate,
      employeeCode: record.employee?.employeeCode ?? '',
      employeeName: employeeName(record.employee),
      hrUnit: record.employee?.hrUnit?.nameEn ?? '',
      department: record.employee?.department?.nameEn ?? '',
      checkInAt: formatDateTime(record.checkInAt),
      checkOutAt: formatDateTime(record.checkOutAt),
      totalPunches: record.totalPunches,
      attendanceDays: record.attendanceDays,
      leaveDays: record.leaveDays,
      payableDays: record.payableDays,
      absenceDays: record.absenceDays,
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
      employee: { with: { department: true, hrUnit: true, position: true } },
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
      hrUnit: record.employee?.hrUnit?.nameEn ?? '',
      department: record.employee?.department?.nameEn ?? '',
      biometricId: record.biometricId,
      deviceName: record.device?.deviceName ?? '',
      punchType: record.punchType,
      source: record.source,
      processed: record.isProcessed ? 'Yes' : 'No',
    }));
}

async function buildLeaveBalanceRows({ query, scope }: ReportInput) {
  const records = await db.query.leaveBalances.findMany({
    where: and(
      query.get('fiscalYearId') ? eq(leaveBalances.fiscalYearId, query.get('fiscalYearId')!) : undefined,
      query.get('lowBalance') === 'true' ? lte(leaveBalances.available, '5') : undefined,
    ),
    with: {
      employee: { with: { department: true, hrUnit: true, position: true } },
      fiscalYear: true,
    },
    orderBy: (table, { desc }) => [desc(table.updatedAt)],
  });

  return records
    .filter((record) => matchesEmployeeFilters(record.employee, query, scope))
    .map((record) => ({
      employeeCode: record.employee?.employeeCode ?? '',
      employeeName: employeeName(record.employee),
      hrUnit: record.employee?.hrUnit?.nameEn ?? '',
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
      scope.type === 'hr_units' ? eq(leaveRequests.status, 'APPROVED') : undefined,
      query.get('status') ? eq(leaveRequests.status, query.get('status')!) : undefined,
      query.get('leaveTypeId') ? eq(leaveRequests.leaveTypeId, query.get('leaveTypeId')!) : undefined,
    ),
    with: {
      employee: { with: { department: true, hrUnit: true, position: true } },
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
      hrUnit: record.employee?.hrUnit?.nameEn ?? '',
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
      query.get('hrUnitId') ? eq(employees.hrUnitId, query.get('hrUnitId')!) : undefined,
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
    with: { department: true, hrUnit: true, position: true },
    orderBy: (table, { asc }) => [asc(table.employeeCode)],
  });

  return records.map((employee) => ({
    employeeCode: employee.employeeCode,
    employeeName: employeeName(employee),
    hrUnit: employee.hrUnit?.nameEn ?? '',
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

function matchesEmployeeFilters(employee: any, query: URLSearchParams, scope: EmployeeVisibilityScope) {
  if (!employee) return false;
  if (scope.type === 'self' && employee.userId !== scope.userId) return false;
  if (scope.type === 'hr_units' && (!employee.hrUnitId || !scope.hrUnitIds.includes(employee.hrUnitId))) return false;
  if (query.get('hrUnitId') && employee.hrUnitId !== query.get('hrUnitId')) return false;
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
