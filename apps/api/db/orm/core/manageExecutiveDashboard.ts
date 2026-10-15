import { and, eq, gte, inArray, lte, or } from 'drizzle-orm';
import { PENDING_CORRECTION_STATUSES } from '../../../lib/attendance/correction-status';
import { addisToday } from '../../../lib/attendance/schedule-evaluator';
import { isIndefinitelyAbsent } from '../../../lib/employees/absence';
import { isWorkingEmployee } from '../../../lib/employees/employment-status';
import {
  addDays,
  attendanceRate,
  countStatuses,
  datesBetween,
  leaveRate,
  leaveSummary,
  monthRange,
  punctualityRate,
  rate,
  round1,
  shiftMonth,
  trendDirection,
  weekRange,
  workforceDistribution,
  workforceStatus,
  type ClassifiedDay,
} from '../../../lib/dashboard/executive-metrics';
import { db } from '../../db';
import {
  attendancePunches,
  attendanceSyncBatches,
  biometricDevices,
  leaveRequests,
  manualPunchRequests,
} from '../../schema';
import { countMissingRecords, loadAttendanceDays, resolveDepartmentScope } from './attendanceDays';
import { getAttendanceReportingDisciplineSummary } from './manageAttendanceReportingDiscipline';

const LOW_ATTENDANCE_THRESHOLD = 90;
/** A department needs at least this many due employee-days before it can be flagged as low. */
const LOW_ATTENDANCE_MIN_DUE_DAYS = 5;
const TIMELINE_START_HOUR = 6;
const TIMELINE_END_HOUR = 20;
const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;

export type ExecutiveDashboardSummaryParams = {
  date?: string;
  month?: string;
  period?: 'day' | 'week' | 'month';
  departmentId?: string;
};

type EmployeeRow = {
  id: string;
  departmentId: string | null;
  sourceDepartmentName: string | null;
  sourceEmploymentStatus: string | null;
  employmentStatus: string | null;
  isActive: boolean;
  hireDate: string | null;
  absenceReason: string | null;
};

export async function getExecutiveDashboardSummary(params: ExecutiveDashboardSummaryParams = {}) {
  const now = new Date();
  const today = addisToday(now);
  const period = params.period === 'week' || params.period === 'month' ? params.period : 'day';
  const anchor = isYmd(params.date) && params.date <= today ? params.date : today;
  const month = params.month && /^\d{4}-\d{2}$/.test(params.month) ? params.month : anchor.slice(0, 7);

  const range = period === 'month' ? monthRange(month) : period === 'week' ? weekRange(anchor) : { start: anchor, end: anchor };
  const rangeEnd = range.end < today ? range.end : today;
  const rangeDates = range.start <= rangeEnd ? datesBetween(range.start, rangeEnd) : [];
  const previousEnd = addDays(range.start, -1);
  const previousStart = addDays(range.start, -Math.max(rangeDates.length, 1));
  const trendMonths = Array.from({ length: 6 }, (_, index) => shiftMonth(month, index - 5));
  const trendStart = monthRange(trendMonths[0]).start;
  const trendEnd = minDate(monthRange(month).end, today);
  const loadStart = minDate(previousStart, trendStart, range.start);
  const loadEnd = maxDate(rangeEnd, trendEnd);
  // Compound status and the punch timeline describe one day: the selected day, or the
  // last day of the period so far.
  const focusDate = period === 'day' ? anchor : (rangeDates.at(-1) ?? anchor);
  const isLive = focusDate === today;

  // Every query starts at once: the reads are independent and the database may be remote.
  const otherQueries = loadActivityData({ rangeStart: range.start, rangeEnd, focusDate });
  // Errors still surface where these are awaited; this only stops an early return from leaving them unhandled.
  otherQueries.catch(() => undefined);
  const context = await loadAttendanceDays({ from: loadStart, to: loadEnd, now });
  const { employees: employeeRows, employeeById, departmentById, effectiveDepartment, isCounted } = context;
  const { selectedDepartment, scopeIds, inScope, visibleDepartments } = resolveDepartmentScope({
    departments: context.departments,
    departmentId: params.departmentId,
  });

  // Headcount: working employees in scope on the last day of the period.
  const headcountEmployees = employeeRows.filter((employee) => isCounted(employee, focusDate) && inScope(effectiveDepartment(employee.id, focusDate)));
  const headcountIds = new Set(headcountEmployees.map((employee) => employee.id));
  const indefinitelyAbsentCount = employeeRows.filter((employee) => (
    isWorkingEmployee(employee) && isIndefinitelyAbsent(employee) && inScope(effectiveDepartment(employee.id, focusDate))
  )).length;

  const disciplineEmployees = employeeRows
    .filter((employee) => isWorkingEmployee(employee) && inScope(employee.departmentId))
    .map((employee) => ({
      id: employee.id,
      departmentId: employee.departmentId,
      department: employee.departmentId ? { nameEn: departmentById.get(employee.departmentId)?.nameEn ?? null } : null,
      sourceDepartmentName: employee.sourceDepartmentName,
    }));
  const disciplineQuery = getAttendanceReportingDisciplineSummary({ employees: disciplineEmployees, dateFrom: range.start, dateTo: rangeEnd });
  disciplineQuery.catch(() => undefined);
  const [pendingLeaves, pendingCorrections, decidedLeaves, decidedCorrections, focusPunches, activeDevices, recentSyncBatches] = await otherQueries;
  const attendanceReportingDiscipline = await disciplineQuery;

  // Every classified day in scope, attributed to the department the employee worked in that day.
  const classified = context.days.filter((day) => inScope(day.departmentId));
  const inRange = (start: string, end: string) => classified.filter((day) => day.date >= start && day.date <= end);
  const current = rangeDates.length ? inRange(range.start, rangeEnd) : [];
  const previous = inRange(previousStart, previousEnd);
  const currentCounts = countStatuses(current);
  const previousCounts = countStatuses(previous);

  const { missingRecords, missingToday } = rangeDates.length
    ? countMissingRecords({
      from: range.start,
      to: rangeEnd,
      today,
      employees: employeeRows,
      isCounted,
      effectiveDepartment,
      include: (_employee, departmentId) => inScope(departmentId),
      days: current,
    })
    : { missingRecords: 0, missingToday: 0 };

  const status = workforceStatus(currentCounts, headcountEmployees.length);
  const departmentPerformance = buildDepartmentPerformance({
    current,
    previous,
    headcountEmployees,
    focusDate,
    effectiveDepartment,
    departmentById,
    pendingEmployeeIds: [...pendingLeaves, ...pendingCorrections].map((item) => item.employeeId),
    employeeById,
    inScope,
  });

  const focusDays = classified.filter((day) => day.date === focusDate);
  const scopedPunches = focusPunches.filter((punch) => (
    punch.employeeId && inScope(effectiveDepartment(punch.employeeId, focusDate))
  ));
  const scopedPending = (items: Array<{ employeeId: string }>) => items
    .filter((item) => headcountIds.has(item.employeeId) || inScope(effectiveDepartment(item.employeeId, today))).length;
  const nonRestCurrent = current.filter((day) => day.status !== 'REST');
  const hrPerformance = {
    pendingHrApproval: current.filter((day) => day.record.status === 'SUPERVISOR_APPROVED').length,
    pendingCorrections: scopedPending(pendingCorrections),
    pendingLeaveApproval: scopedPending(pendingLeaves),
    averageApprovalTimeHours: round1(average([
      ...decidedLeaves.filter((item) => inScope(effectiveDepartment(item.employeeId, today)))
        .map((item) => hoursBetween(item.createdAt, item.authorizedAt ?? item.authorizationRejectedAt ?? item.rejectedAt)),
      ...decidedCorrections.filter((item) => inScope(effectiveDepartment(item.employeeId, today)))
        .map((item) => hoursBetween(item.createdAt, item.approvedAt ?? item.rejectedAt)),
    ].filter((value): value is number => value !== null))),
    correctionsReturned: current.filter((day) => Boolean(day.record.returnedAt)).length,
    payrollReadyPercent: rate(nonRestCurrent.filter((day) => day.record.status === 'HR_APPROVED').length, nonRestCurrent.length) ?? 0,
  };


  const noScheduleEmployees = new Set(current.filter((day) => day.status === 'NO_SCHEDULE').map((day) => day.record.employeeId)).size;
  const deviceHealth = {
    total: activeDevices.length,
    online: activeDevices.filter((device) => device.healthStatus === 'ONLINE').length,
    offline: activeDevices.filter((device) => device.healthStatus === 'OFFLINE').length,
    error: activeDevices.filter((device) => device.healthStatus === 'ERROR').length,
    unknown: activeDevices.filter((device) => !['ONLINE', 'OFFLINE', 'ERROR'].includes(String(device.healthStatus))).length,
  };
  const syncFailures = recentSyncBatches.filter((batch) => batch.syncStatus === 'FAILED' || batch.syncStatus === 'PARTIAL').length;
  const exceptions = buildExceptions({
    counts: currentCounts,
    period,
    departmentPerformance,
    deviceHealth,
    syncFailures,
    hrPerformance,
    missingRecords,
    missingToday,
    isLive,
    noScheduleEmployees,
  });

  return {
    generatedAt: now,
    date: anchor,
    month,
    period,
    dateFrom: range.start,
    dateTo: rangeEnd,
    focusDate,
    isLive,
    scope: {
      departmentId: selectedDepartment?.id ?? null,
      departmentName: selectedDepartment?.nameEn ?? null,
      departmentCount: scopeIds?.size ?? context.departments.length,
    },
    departments: visibleDepartments,
    workforceStatus: {
      ...status,
      indefinitelyAbsent: indefinitelyAbsentCount,
      previousAttendanceRate: attendanceRate(previousCounts),
      attendanceTrend: trendDirection(attendanceRate(currentCounts), attendanceRate(previousCounts)),
    },
    dataQuality: {
      missingRecords,
      missingToday,
      noScheduleEmployees,
      classifiedDays: current.length,
    },
    workforceDistribution: workforceDistribution(currentCounts, missingRecords),
    departmentAttendanceRanking: departmentPerformance
      .filter((department) => department.attendanceRate !== null)
      .slice()
      .sort((left, right) => (right.attendanceRate ?? 0) - (left.attendanceRate ?? 0))
      .slice(0, 8)
      .map(({ department, attendanceRate: value, present, totalEmployees }) => ({ department, attendanceRate: value ?? 0, present, totalEmployees })),
    compoundStatus: buildCompoundStatus(focusDays),
    liveAttendanceTimeline: buildTimeline(scopedPunches),
    leaveSummary: leaveSummary(current),
    hrPerformance,
    attendanceReportingDiscipline,
    departmentPerformance,
    monthlyAttendanceTrend: trendMonths.map((trendMonth) => {
      const { start, end } = monthRange(trendMonth);
      const counts = countStatuses(start > today ? [] : inRange(start, minDate(end, today)));
      return {
        month: new Date(`${trendMonth}-01T00:00:00Z`).toLocaleString('en', { month: 'short', timeZone: 'UTC' }),
        monthKey: trendMonth,
        present: counts.ON_TIME + counts.LATE,
        dueDays: counts.ON_TIME + counts.LATE + counts.ABSENT,
        attendanceRate: attendanceRate(counts),
      };
    }),
    attendanceExceptions: exceptions.attendance,
    deviceHealth,
    executiveAlerts: exceptions.executive,
  };
}

/** Attendance, leave, correction, punch and device reads for the dashboard period. */
function loadActivityData(input: { rangeStart: string; rangeEnd: string; focusDate: string }) {
  return Promise.all([
    db.select({ employeeId: leaveRequests.employeeId }).from(leaveRequests).where(inArray(leaveRequests.status, ['PENDING', 'APPROVED'])),
    db.select({ employeeId: manualPunchRequests.employeeId }).from(manualPunchRequests).where(inArray(manualPunchRequests.status, PENDING_CORRECTION_STATUSES)),
    db.select({
      employeeId: leaveRequests.employeeId,
      createdAt: leaveRequests.createdAt,
      authorizedAt: leaveRequests.authorizedAt,
      authorizationRejectedAt: leaveRequests.authorizationRejectedAt,
      rejectedAt: leaveRequests.rejectedAt,
    }).from(leaveRequests).where(or(
      and(gte(leaveRequests.authorizedAt, addisDayStart(input.rangeStart)), lte(leaveRequests.authorizedAt, addisDayEnd(input.rangeEnd))),
      and(gte(leaveRequests.authorizationRejectedAt, addisDayStart(input.rangeStart)), lte(leaveRequests.authorizationRejectedAt, addisDayEnd(input.rangeEnd))),
      and(gte(leaveRequests.rejectedAt, addisDayStart(input.rangeStart)), lte(leaveRequests.rejectedAt, addisDayEnd(input.rangeEnd))),
    )),
    db.select({
      employeeId: manualPunchRequests.employeeId,
      createdAt: manualPunchRequests.createdAt,
      approvedAt: manualPunchRequests.approvedAt,
      rejectedAt: manualPunchRequests.rejectedAt,
    }).from(manualPunchRequests).where(or(
      and(gte(manualPunchRequests.approvedAt, addisDayStart(input.rangeStart)), lte(manualPunchRequests.approvedAt, addisDayEnd(input.rangeEnd))),
      and(gte(manualPunchRequests.rejectedAt, addisDayStart(input.rangeStart)), lte(manualPunchRequests.rejectedAt, addisDayEnd(input.rangeEnd))),
    )),
    db.select({ employeeId: attendancePunches.employeeId, punchTime: attendancePunches.punchTime }).from(attendancePunches).where(and(
      gte(attendancePunches.punchTime, addisDayStart(input.focusDate)),
      lte(attendancePunches.punchTime, addisDayEnd(input.focusDate)),
    )),
    db.select({ healthStatus: biometricDevices.healthStatus }).from(biometricDevices).where(eq(biometricDevices.isActive, true)),
    db.select({ syncStatus: attendanceSyncBatches.syncStatus }).from(attendanceSyncBatches)
      .where(gte(attendanceSyncBatches.createdAt, addisDayStart(addDays(input.rangeEnd, -30)))),
  ]);
}

function buildDepartmentPerformance(input: {
  current: Array<ClassifiedDay & { departmentId: string | null }>;
  previous: Array<ClassifiedDay & { departmentId: string | null }>;
  headcountEmployees: EmployeeRow[];
  focusDate: string;
  effectiveDepartment: (employeeId: string, date: string) => string | null;
  departmentById: Map<string, { id: string; nameEn: string }>;
  pendingEmployeeIds: string[];
  employeeById: Map<string, EmployeeRow>;
  inScope: (departmentId: string | null) => boolean;
}) {
  const key = (departmentId: string | null) => departmentId ?? 'unassigned';
  const currentByDepartment = groupBy(input.current, (day) => key(day.departmentId));
  const previousByDepartment = groupBy(input.previous, (day) => key(day.departmentId));
  const headcountByDepartment = new Map<string, number>();
  for (const employee of input.headcountEmployees) {
    const departmentKey = key(input.effectiveDepartment(employee.id, input.focusDate));
    headcountByDepartment.set(departmentKey, (headcountByDepartment.get(departmentKey) ?? 0) + 1);
  }
  const pendingByDepartment = new Map<string, number>();
  for (const employeeId of input.pendingEmployeeIds) {
    const departmentId = input.effectiveDepartment(employeeId, input.focusDate);
    if (!input.employeeById.has(employeeId) || !input.inScope(departmentId)) continue;
    pendingByDepartment.set(key(departmentId), (pendingByDepartment.get(key(departmentId)) ?? 0) + 1);
  }

  const departmentKeys = new Set([...headcountByDepartment.keys(), ...currentByDepartment.keys()]);
  return [...departmentKeys]
    .map((departmentKey) => {
      const counts = countStatuses(currentByDepartment.get(departmentKey) ?? []);
      const previousCounts = countStatuses(previousByDepartment.get(departmentKey) ?? []);
      const currentRate = attendanceRate(counts);
      const previousRate = attendanceRate(previousCounts);
      const departmentId = departmentKey === 'unassigned' ? null : departmentKey;
      return {
        departmentId,
        department: departmentId ? input.departmentById.get(departmentId)?.nameEn ?? 'Unknown department' : 'Unassigned',
        totalEmployees: headcountByDepartment.get(departmentKey) ?? 0,
        present: counts.ON_TIME + counts.LATE,
        absent: counts.ABSENT,
        lateEmployees: counts.LATE,
        onLeave: counts.LEAVE,
        dueDays: counts.ON_TIME + counts.LATE + counts.ABSENT,
        pendingApprovals: pendingByDepartment.get(departmentKey) ?? 0,
        leaveRate: leaveRate(counts) ?? 0,
        attendanceRate: currentRate,
        punctualityRate: punctualityRate(counts),
        previousAttendanceRate: previousRate,
        trend: trendDirection(currentRate, previousRate),
      };
    })
    .sort((left, right) => (
      (right.attendanceRate ?? -1) - (left.attendanceRate ?? -1) || left.department.localeCompare(right.department)
    ));
}

/** Where people are on the focus day, from their attendance sessions. */
function buildCompoundStatus(days: ClassifiedDay[]) {
  let currentlyInside = 0;
  let checkedOut = 0;
  for (const day of days) {
    if (day.status !== 'ON_TIME' && day.status !== 'LATE') continue;
    const sessions = Array.isArray(day.record.sessionEvaluations)
      ? day.record.sessionEvaluations as Array<{ checkInAt?: string | null; checkOutAt?: string | null }>
      : [];
    const lastAttended = [...sessions].reverse().find((session) => session.checkInAt || session.checkOutAt);
    const stillIn = lastAttended ? Boolean(lastAttended.checkInAt && !lastAttended.checkOutAt) : !day.record.checkOutAt;
    if (stillIn) currentlyInside += 1;
    else checkedOut += 1;
  }
  return {
    currentlyInside,
    checkedOut,
    notYetArrived: days.filter((day) => day.status === 'NOT_YET_ARRIVED').length,
  };
}

/** Punches and first arrivals per half hour, in Addis Ababa time. */
function buildTimeline(punches: Array<{ employeeId: string | null; punchTime: Date }>) {
  const labels: string[] = [];
  for (let hour = TIMELINE_START_HOUR; hour <= TIMELINE_END_HOUR; hour += 1) {
    labels.push(`${String(hour).padStart(2, '0')}:00`, `${String(hour).padStart(2, '0')}:30`);
  }
  const punchCounts = new Map(labels.map((label) => [label, 0]));
  const arrivalCounts = new Map(labels.map((label) => [label, 0]));
  const firstPunch = new Map<string, Date>();
  const bucket = (value: Date) => {
    const local = new Date(new Date(value).getTime() + ADDIS_OFFSET_MS);
    const hour = local.getUTCHours();
    if (hour < TIMELINE_START_HOUR || hour > TIMELINE_END_HOUR) return null;
    return `${String(hour).padStart(2, '0')}:${local.getUTCMinutes() < 30 ? '00' : '30'}`;
  };
  for (const punch of punches) {
    const label = bucket(punch.punchTime);
    if (label) punchCounts.set(label, (punchCounts.get(label) ?? 0) + 1);
    if (!punch.employeeId) continue;
    const earliest = firstPunch.get(punch.employeeId);
    if (!earliest || new Date(punch.punchTime) < earliest) firstPunch.set(punch.employeeId, new Date(punch.punchTime));
  }
  for (const time of firstPunch.values()) {
    const label = bucket(time);
    if (label) arrivalCounts.set(label, (arrivalCounts.get(label) ?? 0) + 1);
  }
  return labels.map((time) => ({ time, count: punchCounts.get(time) ?? 0, arrivals: arrivalCounts.get(time) ?? 0 }));
}

type Severity = 'critical' | 'warning' | 'info';

function buildExceptions(input: {
  counts: ReturnType<typeof countStatuses>;
  period: 'day' | 'week' | 'month';
  departmentPerformance: ReturnType<typeof buildDepartmentPerformance>;
  deviceHealth: { offline: number; error: number };
  syncFailures: number;
  hrPerformance: { pendingHrApproval: number; pendingCorrections: number; pendingLeaveApproval: number; payrollReadyPercent: number };
  missingRecords: number;
  missingToday: number;
  isLive: boolean;
  noScheduleEmployees: number;
}) {
  const unit = input.period === 'day' ? 'employee(s)' : 'employee-day(s)';
  const attendance: Array<{ id: string; severity: Severity; title: string; count: number; description: string }> = [];
  const executive: Array<{ id: string; severity: Severity; title: string; description: string }> = [];
  const lowDepartments = input.departmentPerformance.filter((department) => (
    department.attendanceRate !== null
    && department.attendanceRate < LOW_ATTENDANCE_THRESHOLD
    && department.dueDays >= LOW_ATTENDANCE_MIN_DUE_DAYS
  ));

  if (input.counts.ABSENT > 0) {
    attendance.push({ id: 'absent-employees', severity: 'warning', title: 'Absent', count: input.counts.ABSENT, description: `${unit} due to work with no check-in. Rest days, approved leave and biometric-exempt staff are excluded.` });
  }
  if (input.counts.LATE > 0) {
    attendance.push({ id: 'late-arrivals', severity: 'warning', title: 'Late arrivals', count: input.counts.LATE, description: `${unit} that checked in after the shift's allowed start.` });
  }
  if (lowDepartments.length > 0) {
    attendance.push({
      id: 'low-attendance-departments',
      severity: 'critical',
      title: `Departments below ${LOW_ATTENDANCE_THRESHOLD}% attendance`,
      count: lowDepartments.length,
      description: lowDepartments.slice(0, 3).map((department) => `${department.department} (${department.attendanceRate}%)`).join(', '),
    });
    executive.push({
      id: 'low-department-attendance',
      severity: 'critical',
      title: `${lowDepartments.length} department(s) below ${LOW_ATTENDANCE_THRESHOLD}% attendance`,
      description: `Lowest: ${lowDepartments.at(-1)!.department} at ${lowDepartments.at(-1)!.attendanceRate}%.`,
    });
  }
  if (input.noScheduleEmployees > 0) {
    attendance.push({ id: 'no-schedule', severity: 'warning', title: 'Employees without a work schedule', count: input.noScheduleEmployees, description: 'Their attendance cannot be judged, so they are not counted as present or absent. Assign work schedules.' });
  }
  if (input.isLive && input.missingToday > 0) {
    executive.push({ id: 'today-not-generated', severity: 'warning', title: `Today's attendance not generated for ${input.missingToday} employee(s)`, description: 'Figures for today are incomplete until the next biometric sync generates attendance.' });
  }
  const missingPast = input.missingRecords - input.missingToday;
  if (missingPast > 0) {
    executive.push({ id: 'missing-records', severity: 'warning', title: `${missingPast} employee-day(s) without attendance records`, description: 'Attendance was not generated for these days, so they are not in any figure. Generate daily records for the period.' });
  }
  if (input.deviceHealth.offline + input.deviceHealth.error > 0) {
    executive.push({ id: 'device-health', severity: 'critical', title: `${input.deviceHealth.offline + input.deviceHealth.error} biometric device issue(s)`, description: 'Offline or failing devices may miss punches (all devices, not filtered by department).' });
  }
  if (input.syncFailures > 0) {
    executive.push({ id: 'sync-failures', severity: 'warning', title: `${input.syncFailures} failed or partial device sync(s) in the last 30 days`, description: 'Some punches may not have been collected.' });
  }
  if (input.hrPerformance.pendingHrApproval > 0) {
    executive.push({ id: 'pending-hr-approvals', severity: 'warning', title: `${input.hrPerformance.pendingHrApproval} attendance record(s) awaiting HR approval`, description: 'Records must be HR-approved before payroll export.' });
  }
  if (input.hrPerformance.pendingCorrections > 0) {
    executive.push({ id: 'pending-corrections', severity: 'info', title: `${input.hrPerformance.pendingCorrections} attendance correction(s) pending`, description: 'Corrections requested by employees are awaiting review.' });
  }
  if (input.hrPerformance.pendingLeaveApproval > 0) {
    executive.push({ id: 'pending-leave-approvals', severity: 'info', title: `${input.hrPerformance.pendingLeaveApproval} leave request(s) awaiting a decision`, description: 'Pending supervisor approval or HR authorization.' });
  }

  return { attendance, executive };
}

function isYmd(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function addisDayStart(date: string) {
  return new Date(`${date}T00:00:00+03:00`);
}

function addisDayEnd(date: string) {
  return new Date(`${date}T23:59:59.999+03:00`);
}

function minDate(...dates: string[]) {
  return dates.reduce((min, date) => (date < min ? date : min));
}

function maxDate(...dates: string[]) {
  return dates.reduce((max, date) => (date > max ? date : max));
}

function hoursBetween(from: Date | string | null, to: Date | string | null) {
  if (!from || !to) return null;
  const hours = (new Date(to).getTime() - new Date(from).getTime()) / 3_600_000;
  return Number.isFinite(hours) && hours >= 0 ? hours : null;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    const list = grouped.get(value);
    if (list) list.push(item);
    else grouped.set(value, [item]);
  }
  return grouped;
}
