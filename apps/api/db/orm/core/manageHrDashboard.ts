import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendancePunches,
  attendanceSyncBatches,
  biometricDevices,
  biometricExemptions,
  employeeWorkSchedules,
  employees,
  leaveBalances,
  leaveFiscalYears,
  leaveRequests,
  manualPunchRequests,
} from '../../schema';
import { isEmployeeBiometricExempt } from '../../../lib/biometric-exemptions';
import { getAttendanceReportingDisciplineSummary } from './manageAttendanceReportingDiscipline';
import { scopedEmployeeWhere, type EmployeeVisibilityScope } from './manageHrUnits';

const DEFAULT_SHIFT_START = '08:30:00';
const DEFAULT_SHIFT_END = '17:30:00';
const UPCOMING_LEAVE_DAYS = 14;
const LEAVE_EXPIRY_DAYS = 30;

export type HrDashboardSummaryParams = {
  userId?: string;
  date?: string;
  scope?: EmployeeVisibilityScope;
};

type Punch = typeof attendancePunches.$inferSelect;

export async function getHrDashboardSummary(params: HrDashboardSummaryParams = {}) {
  const selectedDate = normalizeDateParam(params.date);
  const generatedAt = new Date();
  const dayRange = getDayRange(selectedDate);
  const monthRange = getMonthRange(selectedDate.slice(0, 7));
  const upcomingLeaveEnd = addDays(selectedDate, UPCOMING_LEAVE_DAYS);
  const leaveExpiryEnd = addDays(selectedDate, LEAVE_EXPIRY_DAYS);

  const [
    activeEmployees,
    dayPunches,
    approvedLeavesToday,
    upcomingLeaveRequests,
    activeExemptions,
    workScheduleAssignments,
    pendingManualRequests,
    returnedCorrections,
    unprocessedPunches,
    activeDevices,
    recentSyncBatches,
    activeFiscalYear,
    currentEmployee,
  ] = await Promise.all([
    db.query.employees.findMany({
      where: and(eq(employees.isActive, true), params.scope ? scopedEmployeeWhere(params.scope) : undefined),
      with: { department: true, hrUnit: true, position: true },
    }),
    db.query.attendancePunches.findMany({
      where: and(gte(attendancePunches.punchTime, dayRange.start), lte(attendancePunches.punchTime, dayRange.end)),
      with: { employee: { with: { department: true, hrUnit: true, position: true } }, device: true },
      orderBy: (table, { asc }) => [asc(table.punchTime)],
    }),
    db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.status, 'APPROVED'),
        lte(leaveRequests.startDate, selectedDate),
        gte(leaveRequests.endDate, selectedDate),
      ),
      with: { employee: { with: { department: true, hrUnit: true, position: true } }, leaveType: true },
    }),
    db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.status, 'APPROVED'),
        gte(leaveRequests.startDate, selectedDate),
        lte(leaveRequests.startDate, upcomingLeaveEnd),
      ),
      with: { employee: { with: { department: true, hrUnit: true, position: true } }, leaveType: true },
      orderBy: (table, { asc }) => [asc(table.startDate)],
      limit: 20,
    }),
    db.query.biometricExemptions.findMany({
      where: eq(biometricExemptions.isActive, true),
    }),
    db.query.employeeWorkSchedules.findMany({
      where: eq(employeeWorkSchedules.isActive, true),
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
      orderBy: (table, { desc }) => [desc(table.effectiveFrom), desc(table.createdAt)],
    }),
    db.query.manualPunchRequests.findMany({
      where: eq(manualPunchRequests.status, 'PENDING'),
      with: { employee: { with: { department: true, hrUnit: true, position: true } } },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit: 20,
    }),
    db.query.manualPunchRequests.findMany({
      where: and(
        eq(manualPunchRequests.status, 'REJECTED'),
        gte(manualPunchRequests.createdAt, monthRange.start),
        lte(manualPunchRequests.createdAt, monthRange.end),
      ),
      with: { employee: { with: { department: true, hrUnit: true, position: true } } },
      orderBy: (table, { desc }) => [desc(table.rejectedAt), desc(table.createdAt)],
      limit: 20,
    }),
    db.query.attendancePunches.findMany({
      where: eq(attendancePunches.isProcessed, false),
      with: { employee: { with: { department: true, hrUnit: true, position: true } }, device: true },
      orderBy: (table, { desc }) => [desc(table.punchTime)],
      limit: 20,
    }),
    db.query.biometricDevices.findMany({
      where: eq(biometricDevices.isActive, true),
      with: { department: true },
    }),
    db.query.attendanceSyncBatches.findMany({
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      with: { device: true },
      limit: 20,
    }),
    db.query.leaveFiscalYears.findFirst({
      where: and(
        eq(leaveFiscalYears.isActive, true),
        lte(leaveFiscalYears.startsAt, selectedDate),
        gte(leaveFiscalYears.endsAt, selectedDate),
      ),
    }),
    params.userId
      ? db.query.employees.findFirst({
        where: eq(employees.userId, params.userId),
        with: { department: true, hrUnit: true, position: true },
      })
      : Promise.resolve(null),
  ]);

  const activeEmployeeIds = new Set(activeEmployees.map((employee) => employee.id));
  const isVisibleEmployee = (employeeId: string | null | undefined) => Boolean(employeeId && activeEmployeeIds.has(employeeId));
  const scopedDayPunches = dayPunches.filter((punch) => isVisibleEmployee(punch.employeeId));
  const scopedApprovedLeavesToday = approvedLeavesToday.filter((request) => isVisibleEmployee(request.employeeId));
  const scopedUpcomingLeaveRequests = upcomingLeaveRequests.filter((request) => isVisibleEmployee(request.employeeId));
  const scopedWorkScheduleAssignments = workScheduleAssignments.filter((assignment) => isVisibleEmployee(assignment.employeeId));
  const scopedPendingManualRequests = pendingManualRequests.filter((request) => isVisibleEmployee(request.employeeId));
  const scopedPendingLeaveRequests: any[] = [];
  const scopedReturnedCorrections = returnedCorrections.filter((request) => isVisibleEmployee(request.employeeId));
  const scopedUnprocessedPunches = unprocessedPunches.filter((punch) => isVisibleEmployee(punch.employeeId));
  const exemptEmployeeIds = new Set(
    activeEmployees
      .filter((employee) => isEmployeeBiometricExempt(employee, activeExemptions))
      .map((employee) => employee.id),
  );
  const punchesByEmployee = groupPunchesByEmployee(scopedDayPunches);
  const leaveEmployeeIds = new Set(
    scopedApprovedLeavesToday
      .filter((request) => activeEmployeeIds.has(request.employeeId))
      .map((request) => request.employeeId),
  );
  const scheduleByEmployee = getScheduleByEmployee(scopedWorkScheduleAssignments, selectedDate);
  const lateEmployeeIds = getLateEmployeeIds(punchesByEmployee, scheduleByEmployee, selectedDate);
  const employeesWithoutPunch = activeEmployees.filter((employee) => (
    !punchesByEmployee.has(employee.id)
    && !leaveEmployeeIds.has(employee.id)
    && !exemptEmployeeIds.has(employee.id)
  ));
  const missingCheckoutEmployees = getMissingCheckoutEmployees({
    employees: activeEmployees,
    punchesByEmployee,
    scheduleByEmployee,
    date: selectedDate,
  });
  const leaveBalancesNearExpiry = activeFiscalYear && activeFiscalYear.endsAt <= leaveExpiryEnd
    ? await db.query.leaveBalances.findMany({
      where: and(
        eq(leaveBalances.fiscalYearId, activeFiscalYear.id),
        gte(leaveBalances.available, '0.01'),
      ),
      with: { employee: { with: { department: true, hrUnit: true, position: true } }, fiscalYear: true },
      limit: 20,
    })
    : [];
  const scopedLeaveBalancesNearExpiry = leaveBalancesNearExpiry.filter((balance) => isVisibleEmployee(balance.employeeId));
  const currentAnnualLeaveBalance = activeFiscalYear && currentEmployee
    ? await db.query.leaveBalances.findFirst({
      where: and(
        eq(leaveBalances.employeeId, currentEmployee.id),
        eq(leaveBalances.fiscalYearId, activeFiscalYear.id),
      ),
      with: { employee: { with: { department: true, hrUnit: true, position: true } }, fiscalYear: true },
    })
    : null;

  const offlineDevices = activeDevices.filter((device) => device.healthStatus === 'OFFLINE');
  const syncStatus = buildSyncStatus(recentSyncBatches);
  const attendanceExceptions = buildAttendanceExceptions({
    employeesWithoutPunch: employeesWithoutPunch.length,
    missingCheckout: missingCheckoutEmployees.length,
    lateEmployees: lateEmployeeIds.size,
    unprocessedPunches: scopedUnprocessedPunches.length,
  });
  const attendanceReportingDiscipline = await getAttendanceReportingDisciplineSummary({
    employees: activeEmployees,
    dateFrom: selectedDate,
    dateTo: selectedDate,
  });

  return {
    generatedAt,
    date: selectedDate,
    currentAnnualLeaveBalance,
    attendanceReportingDiscipline,
    widgets: {
      pendingApprovals: createWidget(
        'pending-approvals',
        'Pending Approvals',
        scopedPendingManualRequests.length + scopedPendingLeaveRequests.length,
        '/leave-request-approvals',
      ),
      correctionsReturned: createWidget(
        'corrections-returned',
        'Corrections Returned',
        scopedReturnedCorrections.length,
        '/manual-punch-requests',
      ),
      manualAttendanceRequests: createWidget(
        'manual-attendance-requests',
        'Manual Attendance Requests',
        scopedPendingManualRequests.length,
        '/manual-punch-requests',
      ),
      employeesOnLeave: createWidget(
        'employees-on-leave',
        'Employees on Leave',
        leaveEmployeeIds.size,
        '/leave-request-approvals',
      ),
      employeesWithoutPunch: createWidget(
        'employees-without-punch',
        'Employees Without Punch',
        employeesWithoutPunch.length,
        '/attendance-punches',
      ),
      missingCheckout: createWidget(
        'missing-check-out',
        'Missing Check-out',
        missingCheckoutEmployees.length,
        '/attendance-punches',
      ),
      lateEmployees: createWidget(
        'late-employees',
        'Late Employees',
        lateEmployeeIds.size,
        '/attendance-punches',
      ),
      attendanceExceptions: createWidget(
        'attendance-exceptions',
        'Attendance Exceptions',
        attendanceExceptions.total,
        '/attendance-punches',
      ),
      upcomingLeave: createWidget(
        'upcoming-leave',
        'Upcoming Leave',
        scopedUpcomingLeaveRequests.length,
        '/leave-request-approvals',
      ),
      employeesNearLeaveExpiry: createWidget(
        'employees-near-leave-expiry',
        'Employees Near Leave Expiry',
        scopedLeaveBalancesNearExpiry.length,
        '/leave-management/balances',
      ),
      devicesOffline: createWidget(
        'devices-offline',
        'Devices Offline',
        offlineDevices.length,
        '/biometric-devices',
      ),
      synchronizationStatus: createWidget(
        'synchronization-status',
        'Synchronization Status',
        syncStatus.openIssues,
        '/biometric-devices',
      ),
    },
    details: {
      pendingManualRequests: scopedPendingManualRequests,
      pendingLeaveRequests: scopedPendingLeaveRequests,
      returnedCorrections: scopedReturnedCorrections,
      employeesOnLeave: scopedApprovedLeavesToday,
      employeesWithoutPunch,
      missingCheckoutEmployees,
      lateEmployees: activeEmployees.filter((employee) => lateEmployeeIds.has(employee.id)),
      attendanceExceptions: attendanceExceptions.items,
      upcomingLeave: scopedUpcomingLeaveRequests,
      employeesNearLeaveExpiry: scopedLeaveBalancesNearExpiry,
      devicesOffline: offlineDevices,
      synchronizationStatus: syncStatus,
      unprocessedPunches: scopedUnprocessedPunches,
    },
  };
}

function normalizeDateParam(date?: string) {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date().toISOString().slice(0, 10);
}

function getDayRange(date: string) {
  return {
    start: new Date(`${date}T00:00:00`),
    end: new Date(`${date}T23:59:59.999`),
  };
}

function getMonthRange(month: string) {
  const [year, zeroBasedMonth] = month.split('-').map(Number);
  return {
    start: new Date(year, zeroBasedMonth - 1, 1, 0, 0, 0, 0),
    end: new Date(year, zeroBasedMonth, 0, 23, 59, 59, 999),
  };
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function groupPunchesByEmployee(punches: any[]) {
  const grouped = new Map<string, Punch[]>();

  for (const punch of punches) {
    if (!punch.employeeId) continue;
    grouped.set(punch.employeeId, [...(grouped.get(punch.employeeId) ?? []), punch]);
  }

  return grouped;
}

function getScheduleByEmployee(assignments: any[], date: string) {
  const selected = new Map<string, any>();

  for (const assignment of assignments) {
    if (assignment.effectiveFrom > date) continue;
    if (assignment.effectiveTo && assignment.effectiveTo < date) continue;
    if (!selected.has(assignment.employeeId)) {
      selected.set(assignment.employeeId, assignment);
    }
  }

  return selected;
}

function getLateEmployeeIds(punchesByEmployee: Map<string, Punch[]>, scheduleByEmployee: Map<string, any>, date: string) {
  const lateEmployeeIds = new Set<string>();
  const dayOfWeek = getDayOfWeek(date);

  for (const [employeeId, punches] of punchesByEmployee) {
    const firstPunch = punches[0];
    if (!firstPunch) continue;
    const lateAfter = getShiftBoundary(scheduleByEmployee.get(employeeId), dayOfWeek, date, 'start');
    if (firstPunch.punchTime > lateAfter) {
      lateEmployeeIds.add(employeeId);
    }
  }

  return lateEmployeeIds;
}

function getMissingCheckoutEmployees(input: {
  employees: any[];
  punchesByEmployee: Map<string, Punch[]>;
  scheduleByEmployee: Map<string, any>;
  date: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const dayOfWeek = getDayOfWeek(input.date);

  return input.employees.filter((employee) => {
    const punches = input.punchesByEmployee.get(employee.id);
    const latestPunch = punches?.[punches.length - 1];
    if (!latestPunch || latestPunch.punchType === 'OUT' || latestPunch.punchType === 'BREAK_OUT') return false;
    if (input.date < today) return true;
    if (input.date > today) return false;
    return new Date() >= getShiftBoundary(input.scheduleByEmployee.get(employee.id), dayOfWeek, input.date, 'end');
  });
}

function getShiftBoundary(assignment: any, dayOfWeek: string, date: string, boundary: 'start' | 'end') {
  const day = assignment?.workSchedule?.days?.find((item: any) => item.dayOfWeek === dayOfWeek && item.isActive && !item.isOffDay);
  const shift = day?.shift;
  const segments = [...(shift?.segments ?? [])].sort((left: any, right: any) => {
    const sortOrder = Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0);
    return sortOrder || String(left.startTime).localeCompare(String(right.startTime));
  });
  const segment = boundary === 'start' ? segments[0] : segments[segments.length - 1];
  const fallback = boundary === 'start' ? DEFAULT_SHIFT_START : DEFAULT_SHIFT_END;
  const time = boundary === 'start' ? segment?.startTime ?? fallback : segment?.endTime ?? fallback;
  const value = new Date(`${date}T${time}`);

  if (boundary === 'start') {
    const graceMinutes = Number(shift?.gracePeriodMinutes ?? 0) + Number(shift?.lateAfterMinutes ?? 0);
    value.setMinutes(value.getMinutes() + graceMinutes);
  }

  return value;
}

function getDayOfWeek(date: string) {
  return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date(`${date}T00:00:00`).getDay()];
}

function buildAttendanceExceptions(input: {
  employeesWithoutPunch: number;
  missingCheckout: number;
  lateEmployees: number;
  unprocessedPunches: number;
}) {
  const items = [
    {
      id: 'employees-without-punch',
      severity: input.employeesWithoutPunch > 0 ? 'warning' : 'info',
      title: 'Employees without punch',
      count: input.employeesWithoutPunch,
      description: 'Active employees with no punch for the selected date.',
    },
    {
      id: 'missing-check-out',
      severity: input.missingCheckout > 0 ? 'warning' : 'info',
      title: 'Missing check-out',
      count: input.missingCheckout,
      description: 'Employees whose latest punch does not close the work day.',
    },
    {
      id: 'late-employees',
      severity: input.lateEmployees > 0 ? 'warning' : 'info',
      title: 'Late employees',
      count: input.lateEmployees,
      description: 'Employees whose first punch is after the scheduled grace period.',
    },
    {
      id: 'unprocessed-punches',
      severity: input.unprocessedPunches > 0 ? 'warning' : 'info',
      title: 'Unprocessed attendance punches',
      count: input.unprocessedPunches,
      description: 'Raw punches that still need attendance processing.',
    },
  ] as const;

  return {
    total: items.reduce((sum, item) => sum + item.count, 0),
    items,
  };
}

function buildSyncStatus(batches: any[]) {
  const counts = {
    started: batches.filter((batch) => batch.syncStatus === 'STARTED').length,
    completed: batches.filter((batch) => batch.syncStatus === 'COMPLETED').length,
    failed: batches.filter((batch) => batch.syncStatus === 'FAILED').length,
    partial: batches.filter((batch) => batch.syncStatus === 'PARTIAL').length,
  };

  return {
    latest: batches[0] ?? null,
    recent: batches,
    counts,
    openIssues: counts.started + counts.failed + counts.partial,
  };
}

function createWidget(id: string, label: string, count: number, href: string) {
  return { id, label, count, href };
}
