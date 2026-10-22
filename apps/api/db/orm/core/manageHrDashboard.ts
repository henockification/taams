import { and, desc, eq, gte, inArray, lte, or } from 'drizzle-orm';
import { PENDING_CORRECTION_STATUSES } from '../../../lib/attendance/correction-status';
import { addisToday } from '../../../lib/attendance/schedule-evaluator';
import {
  absentUntilArrived,
  addDays,
  attendanceRate,
  countStatuses,
  punctualityRate,
} from '../../../lib/dashboard/executive-metrics';
import { db } from '../../db';
import {
  attendancePunches,
  employees,
  leaveBalances,
  leaveFiscalYears,
  leaveRequests,
  manualPunchRequests,
} from '../../schema';
import { countMissingRecords, hasMissingCheckout, loadAttendanceDays, resolveDepartmentScope, type AttendanceDay } from './attendanceDays';
import { getAttendanceReportingDisciplineSummary } from './manageAttendanceReportingDiscipline';
import type { EmployeeVisibilityScope } from './manageEmployeeVisibility';
import { getIsmisLeavePeriods } from './manageIsmisLeave';

const UPCOMING_LEAVE_DAYS = 14;
const LEAVE_EXPIRY_DAYS = 30;
/** Detail lists show this many rows; widget counts are always complete. */
const DETAIL_LIMIT = 20;
const PEOPLE_LIMIT = 200;

export type HrDashboardSummaryParams = {
  userId?: string;
  date?: string;
  scope?: EmployeeVisibilityScope;
  departmentId?: string;
};

type PersonStatus = 'ABSENT' | 'NOT_YET_ARRIVED' | 'LATE' | 'MISSING_CHECKOUT' | 'EARLY_DEPARTURE';

export async function getHrDashboardSummary(params: HrDashboardSummaryParams = {}) {
  const generatedAt = new Date();
  const today = addisToday(generatedAt);
  const selectedDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today ? params.date : today;
  const isLive = selectedDate === today;
  const monthStart = `${selectedDate.slice(0, 7)}-01`;
  const upcomingLeaveEnd = addDays(selectedDate, UPCOMING_LEAVE_DAYS);
  const leaveExpiryEnd = addDays(selectedDate, LEAVE_EXPIRY_DAYS);

  const context = await loadAttendanceDays({ from: selectedDate, to: selectedDate, now: generatedAt });
  const allowedDepartmentIds = allowedDepartmentsForScope(params.scope);
  const { selectedDepartment, inScope, visibleDepartments } = resolveDepartmentScope({
    departments: context.departments,
    departmentId: params.departmentId,
    allowedDepartmentIds,
  });
  const inScopeEmployee = (employeeId: string | null | undefined, date = selectedDate) => Boolean(
    employeeId && context.employeeById.has(employeeId) && inScope(context.effectiveDepartment(employeeId, date)),
  );
  const scopedEmployees = context.employees.filter((employee) => (
    context.isCounted(employee, selectedDate) && inScope(context.effectiveDepartment(employee.id, selectedDate))
  ));
  const days = absentUntilArrived(context.days.filter((day) => day.date === selectedDate && inScope(day.departmentId)));
  const counts = countStatuses(days);
  const notYetArrived = days.filter((day) => day.notYetArrived).length;
  const { missingRecords, missingToday } = countMissingRecords({
    from: selectedDate,
    to: selectedDate,
    today,
    employees: context.employees,
    isCounted: context.isCounted,
    effectiveDepartment: context.effectiveDepartment,
    include: (_employee, departmentId) => inScope(departmentId),
    days,
  });

  const [
    activeFiscalYear,
    currentEmployee,
    pendingAuthorizations,
    pendingCorrections,
    returnedCorrections,
    upcomingLeave,
    upcomingIsmisLeave,
    unprocessedPunches,
  ] = await Promise.all([
    db.query.leaveFiscalYears.findFirst({
      where: and(eq(leaveFiscalYears.isActive, true), lte(leaveFiscalYears.startsAt, selectedDate), gte(leaveFiscalYears.endsAt, selectedDate)),
    }),
    params.userId
      ? db.query.employees.findFirst({ where: eq(employees.userId, params.userId), with: { department: true, position: true } })
      : Promise.resolve(null),
    db.query.leaveRequests.findMany({
      where: eq(leaveRequests.status, 'APPROVED'),
      with: { employee: { with: { department: true, position: true } }, leaveType: true },
      orderBy: (table, { asc }) => [asc(table.approvedAt), asc(table.createdAt)],
    }),
    db.query.manualPunchRequests.findMany({
      where: inArray(manualPunchRequests.status, PENDING_CORRECTION_STATUSES),
      with: { employee: { with: { department: true, position: true } } },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    }),
    db.query.manualPunchRequests.findMany({
      where: and(
        or(eq(manualPunchRequests.status, 'HR_REJECTED'), eq(manualPunchRequests.status, 'SUPERVISOR_REJECTED')),
        gte(manualPunchRequests.createdAt, new Date(`${monthStart}T00:00:00+03:00`)),
        lte(manualPunchRequests.createdAt, new Date(`${selectedDate}T23:59:59.999+03:00`)),
      ),
      with: { employee: { with: { department: true, position: true } } },
      orderBy: (table) => [desc(table.rejectedAt), desc(table.createdAt)],
    }),
    db.query.leaveRequests.findMany({
      where: and(eq(leaveRequests.status, 'AUTHORIZED'), gte(leaveRequests.startDate, addDays(selectedDate, 1)), lte(leaveRequests.startDate, upcomingLeaveEnd)),
      with: { employee: { with: { department: true, position: true } }, leaveType: true },
      orderBy: (table, { asc }) => [asc(table.startDate)],
    }),
    // Permanent employees' leave comes from confirmed ISMIS imports, not leave requests.
    getIsmisLeavePeriods(addDays(selectedDate, 1), upcomingLeaveEnd),
    db.select({ id: attendancePunches.id, employeeId: attendancePunches.employeeId }).from(attendancePunches).where(eq(attendancePunches.isProcessed, false)),
  ]);

  const scopedAuthorizations = pendingAuthorizations.filter((request) => inScopeEmployee(request.employeeId));
  const scopedCorrections = pendingCorrections.filter((request) => inScopeEmployee(request.employeeId));
  const scopedReturned = returnedCorrections.filter((request) => inScopeEmployee(request.employeeId));
  const scopedUpcoming = [...upcomingLeave, ...upcomingIsmisLeave]
    .filter((request) => inScopeEmployee(request.employeeId, String(request.startDate)))
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)));
  const scopedUnprocessed = unprocessedPunches.filter((punch) => inScopeEmployee(punch.employeeId));

  const [leaveBalancesNearExpiry, currentAnnualLeaveBalance, unprocessedDetails] = await Promise.all([
    activeFiscalYear && String(activeFiscalYear.endsAt) <= leaveExpiryEnd
      ? db.query.leaveBalances.findMany({
        where: and(eq(leaveBalances.fiscalYearId, activeFiscalYear.id), gte(leaveBalances.available, '0.01')),
        with: { employee: { with: { department: true, position: true } }, fiscalYear: true },
      }).then((balances) => balances.filter((balance) => inScopeEmployee(balance.employeeId)))
      : Promise.resolve([]),
    currentEmployee?.employmentType === 'CONTRACT' && activeFiscalYear
      ? db.query.leaveBalances.findFirst({
        where: and(eq(leaveBalances.employeeId, currentEmployee.id), eq(leaveBalances.fiscalYearId, activeFiscalYear.id)),
        with: { employee: { with: { department: true, position: true } }, fiscalYear: true },
      })
      : Promise.resolve(null),
    scopedUnprocessed.length
      ? db.query.attendancePunches.findMany({
        where: inArray(attendancePunches.id, scopedUnprocessed.slice(0, DETAIL_LIMIT).map((punch) => punch.id)),
        with: { employee: { with: { department: true, position: true } }, device: true },
        orderBy: (table) => [desc(table.punchTime)],
      })
      : Promise.resolve([]),
  ]);

  // One row per person needing attention today; a person can appear for more than one reason.
  const people: Array<{ employeeId: string; status: PersonStatus; minutes: number | null }> = [];
  for (const day of days) {
    if (day.status === 'ABSENT') {
      people.push({ employeeId: day.record.employeeId, status: day.notYetArrived ? 'NOT_YET_ARRIVED' : 'ABSENT', minutes: null });
    }
    if (day.status === 'LATE') people.push({ employeeId: day.record.employeeId, status: 'LATE', minutes: Number(day.record.lateMinutes ?? 0) });
    if (hasMissingCheckout(day, generatedAt, today)) people.push({ employeeId: day.record.employeeId, status: 'MISSING_CHECKOUT', minutes: null });
    if (isPresent(day) && Number(day.record.earlyDepartureMinutes ?? 0) > 0) {
      people.push({ employeeId: day.record.employeeId, status: 'EARLY_DEPARTURE', minutes: Number(day.record.earlyDepartureMinutes) });
    }
  }
  const leaveDays = days.filter((day) => day.status === 'LEAVE');
  const detailEmployeeIds = [...new Set([...people.slice(0, PEOPLE_LIMIT), ...leaveDays].map((item: any) => item.employeeId ?? item.record.employeeId))];
  const detailEmployees = detailEmployeeIds.length
    ? await db.query.employees.findMany({ where: inArray(employees.id, detailEmployeeIds), with: { department: true, position: true } })
    : [];
  const employeeDetail = new Map(detailEmployees.map((employee) => [employee.id, employee]));
  const peopleWithEmployees = people
    .slice(0, PEOPLE_LIMIT)
    .map((person) => ({ ...person, employee: employeeDetail.get(person.employeeId) ?? null }))
    .filter((person) => person.employee);
  const byStatus = (status: PersonStatus) => peopleWithEmployees.filter((person) => person.status === status).map((person) => person.employee!);

  const missingCheckoutCount = people.filter((person) => person.status === 'MISSING_CHECKOUT').length;
  const earlyDepartureCount = people.filter((person) => person.status === 'EARLY_DEPARTURE').length;
  const withoutPunchCount = counts.ABSENT;
  const attendanceExceptions = buildAttendanceExceptions({
    date: selectedDate,
    departmentId: selectedDepartment?.id ?? null,
    absent: counts.ABSENT,
    notYetArrived,
    missingCheckout: missingCheckoutCount,
    late: counts.LATE,
    earlyDeparture: earlyDepartureCount,
    noSchedule: counts.NO_SCHEDULE,
    notGenerated: missingRecords,
    unprocessedPunches: scopedUnprocessed.length,
    isLive,
  });
  const attendanceReportingDiscipline = await getAttendanceReportingDisciplineSummary({
    employees: context.employees
      .filter((employee) => context.isCounted(employee, selectedDate) && inScope(employee.departmentId))
      .map((employee) => ({
        id: employee.id,
        departmentId: employee.departmentId,
        department: employee.departmentId ? { nameEn: context.departmentById.get(employee.departmentId)?.nameEn ?? null } : null,
        sourceDepartmentName: employee.sourceDepartmentName,
      })),
    dateFrom: selectedDate,
    dateTo: selectedDate,
  });

  return {
    generatedAt,
    date: selectedDate,
    isLive,
    scope: { departmentId: selectedDepartment?.id ?? null, departmentName: selectedDepartment?.nameEn ?? null },
    departments: visibleDepartments,
    currentAnnualLeaveBalance: currentAnnualLeaveBalance ?? null,
    attendanceReportingDiscipline,
    attendanceSummary: {
      headcount: scopedEmployees.length,
      present: counts.ON_TIME + counts.LATE,
      onTime: counts.ON_TIME,
      late: counts.LATE,
      absent: counts.ABSENT,
      notYetArrived,
      onLeave: counts.LEAVE,
      biometricExempt: counts.EXEMPT,
      restDay: counts.REST,
      noSchedule: counts.NO_SCHEDULE,
      attendanceRate: attendanceRate(counts),
      punctualityRate: punctualityRate(counts),
    },
    dataQuality: { missingRecords, missingToday, noScheduleEmployees: counts.NO_SCHEDULE },
    widgets: {
      pendingApprovals: createWidget('pending-approvals', 'Pending Approvals', scopedAuthorizations.length, '/leave-management/authorizations'),
      // Corrections are decided by supervisors; HR has no review page, so these open the dashboard's own list.
      correctionsReturned: createWidget('corrections-returned', 'Corrections Returned', scopedReturned.length, OPEN_ITEMS_ANCHOR),
      manualAttendanceRequests: createWidget('manual-attendance-requests', 'Manual Attendance Requests', scopedCorrections.length, OPEN_ITEMS_ANCHOR),
      employeesOnLeave: createWidget('employees-on-leave', 'Employees on Leave', counts.LEAVE, `/reports/attendance-daily?view=daily&onLeave=true&dateFrom=${selectedDate}&dateTo=${selectedDate}`),
      employeesWithoutPunch: createWidget('employees-without-punch', 'Employees Without Punch', withoutPunchCount, absentEmployeesHref(selectedDate, selectedDepartment?.id)),
      missingCheckout: createWidget('missing-check-out', 'Missing Check-out', missingCheckoutCount, attendanceApprovalsHref(selectedDate, 'missing-checkout')),
      lateEmployees: createWidget('late-employees', 'Late Employees', counts.LATE, attendanceApprovalsHref(selectedDate, 'late')),
      attendanceExceptions: createWidget('attendance-exceptions', 'Attendance Exceptions', attendanceExceptions.total, attendanceApprovalsHref(selectedDate, 'any')),
      upcomingLeave: createWidget('upcoming-leave', 'Upcoming Leave', scopedUpcoming.length, `/reports/leave-requests?status=AUTHORIZED&dateFrom=${addDays(selectedDate, 1)}&dateTo=${upcomingLeaveEnd}`),
      employeesNearLeaveExpiry: createWidget(
        'employees-near-leave-expiry',
        'Employees Near Leave Expiry',
        leaveBalancesNearExpiry.length,
        activeFiscalYear ? `/reports/leave-balances?fiscalYearId=${activeFiscalYear.id}&hasAvailable=true` : '/leave-management/balances',
      ),
    },
    details: {
      pendingManualRequests: scopedCorrections.slice(0, DETAIL_LIMIT),
      pendingLeaveRequests: scopedAuthorizations.slice(0, DETAIL_LIMIT),
      returnedCorrections: scopedReturned.slice(0, DETAIL_LIMIT),
      employeesOnLeave: leaveDays.slice(0, PEOPLE_LIMIT).map((day) => ({
        employee: employeeDetail.get(day.record.employeeId) ?? null,
        leaveType: day.leave?.typeLabel ?? null,
        category: day.leave?.category ?? null,
      })).filter((item) => item.employee),
      people: peopleWithEmployees,
      employeesWithoutPunch: [...byStatus('ABSENT'), ...byStatus('NOT_YET_ARRIVED')],
      missingCheckoutEmployees: byStatus('MISSING_CHECKOUT'),
      lateEmployees: byStatus('LATE'),
      attendanceExceptions: attendanceExceptions.items,
      upcomingLeave: scopedUpcoming.slice(0, DETAIL_LIMIT),
      employeesNearLeaveExpiry: leaveBalancesNearExpiry.slice(0, DETAIL_LIMIT),
      unprocessedPunches: unprocessedDetails,
    },
  };
}

function allowedDepartmentsForScope(scope?: EmployeeVisibilityScope) {
  if (!scope || scope.type === 'unrestricted' || scope.type === 'hr') return null;
  if (scope.type === 'hr-departments') return scope.departmentIds;
  return [];
}

function isPresent(day: AttendanceDay) {
  return day.status === 'ON_TIME' || day.status === 'LATE';
}

/** The absent report lists the same people as the dashboard's Absent count for that day and department. */
function absentEmployeesHref(date: string, departmentId?: string | null) {
  return `/reports/absent-employees?view=daily&dateFrom=${date}&dateTo=${date}${departmentId ? `&departmentId=${departmentId}` : ''}`;
}

const OPEN_ITEMS_ANCHOR = '#open-items';

/** Opens HR attendance approval for the day, narrowed to one kind of exception when given. */
function attendanceApprovalsHref(date: string, exception?: 'late' | 'missing-checkout' | 'early-departure' | 'any') {
  return `/attendance-approvals/hr?date=${date}${exception ? `&exception=${exception}` : ''}`;
}

function buildAttendanceExceptions(input: {
  date: string;
  departmentId: string | null;
  absent: number;
  notYetArrived: number;
  missingCheckout: number;
  late: number;
  earlyDeparture: number;
  noSchedule: number;
  notGenerated: number;
  unprocessedPunches: number;
  isLive: boolean;
}) {
  const severity = (count: number) => (count > 0 ? 'warning' : 'info') as 'warning' | 'info';
  const items = [
    { id: 'absent', href: absentEmployeesHref(input.date, input.departmentId), severity: severity(input.absent), title: 'Absent', count: input.absent, description: `Due to work with no check-in${input.notYetArrived > 0 ? `, including ${input.notYetArrived} not yet arrived today` : ''}. Rest days, approved leave and biometric-exempt staff are excluded.` },
    { id: 'missing-check-out', href: attendanceApprovalsHref(input.date, 'missing-checkout'), severity: severity(input.missingCheckout), title: 'Missing check-out', count: input.missingCheckout, description: 'Checked in for a session but did not check out before its window closed.' },
    { id: 'late-employees', href: attendanceApprovalsHref(input.date, 'late'), severity: severity(input.late), title: 'Late arrivals', count: input.late, description: "Checked in after the shift's allowed start." },
    { id: 'early-departure', href: attendanceApprovalsHref(input.date, 'early-departure'), severity: severity(input.earlyDeparture), title: 'Early departure', count: input.earlyDeparture, description: 'Left before the end of the last session.' },
    { id: 'no-schedule', href: '/work-schedule-assignments', severity: severity(input.noSchedule), title: 'No work schedule', count: input.noSchedule, description: 'Attendance cannot be judged without a schedule; assign work schedules.' },
    {
      id: 'not-generated',
      href: '',
      severity: severity(input.notGenerated),
      title: 'Attendance not generated',
      count: input.notGenerated,
      description: input.isLive ? 'No attendance record yet today; it appears after the next biometric sync.' : 'Generate daily records for this date.',
    },
    { id: 'unprocessed-punches', href: '/reports/attendance-punches?status=unprocessed&dateFrom=&dateTo=', severity: severity(input.unprocessedPunches), title: 'Unprocessed attendance punches', count: input.unprocessedPunches, description: 'Raw punches that still need attendance processing.' },
  ];
  return {
    total: input.absent + input.missingCheckout + input.late + input.earlyDeparture,
    items,
  };
}

function createWidget(id: string, label: string, count: number, href: string) {
  return { id, label, count, href };
}
