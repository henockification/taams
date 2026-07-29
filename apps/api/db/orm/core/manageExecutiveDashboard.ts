import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendancePunches,
  attendanceSyncBatches,
  biometricDevices,
  biometricExemptions,
  employeeWorkSchedules,
  employees,
  leaveRequests,
  manualPunchRequests,
} from '../../schema';
import { isEmployeeBiometricExempt } from '../../../lib/biometric-exemptions';

const DEFAULT_SHIFT_START = '08:30:00';
const LOW_ATTENDANCE_THRESHOLD = 90;
const TIMELINE_START_HOUR = 7;
const TIMELINE_END_HOUR = 18;

export type ExecutiveDashboardSummaryParams = {
  date?: string;
  month?: string;
};

type Punch = typeof attendancePunches.$inferSelect;

export async function getExecutiveDashboardSummary(params: ExecutiveDashboardSummaryParams = {}) {
  const selectedDate = normalizeDateParam(params.date);
  const selectedMonth = normalizeMonthParam(params.month, selectedDate);
  const generatedAt = new Date();
  const dayRange = getDayRange(selectedDate);
  const monthRange = getMonthRange(selectedMonth);
  const trendRange = getSixMonthRange(selectedMonth);

  const [
    activeEmployees,
    dayPunches,
    approvedLeaves,
    activeExemptions,
    workScheduleAssignments,
    activeDevices,
    recentSyncBatches,
    pendingManualRequests,
    monthManualRequests,
    pendingLeaveRequests,
    monthLeaveRequests,
    trendPunches,
  ] = await Promise.all([
    db.query.employees.findMany({
      where: eq(employees.isActive, true),
      with: { department: true, position: true },
    }),
    db.query.attendancePunches.findMany({
      where: and(gte(attendancePunches.punchTime, dayRange.start), lte(attendancePunches.punchTime, dayRange.end)),
      with: { employee: { with: { department: true, position: true } }, device: true },
      orderBy: (table, { asc }) => [asc(table.punchTime)],
    }),
    db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.status, 'APPROVED'),
        lte(leaveRequests.startDate, selectedDate),
        gte(leaveRequests.endDate, selectedDate),
      ),
      with: { leaveType: true, employee: { with: { department: true, position: true } } },
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
    db.query.biometricDevices.findMany({
      where: eq(biometricDevices.isActive, true),
    }),
    db.query.attendanceSyncBatches.findMany({
      where: gte(attendanceSyncBatches.createdAt, monthRange.start),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit: 50,
    }),
    db.query.manualPunchRequests.findMany({
      where: eq(manualPunchRequests.status, 'PENDING'),
    }),
    db.query.manualPunchRequests.findMany({
      where: and(gte(manualPunchRequests.createdAt, monthRange.start), lte(manualPunchRequests.createdAt, monthRange.end)),
    }),
    db.query.leaveRequests.findMany({
      where: eq(leaveRequests.status, 'PENDING'),
    }),
    db.query.leaveRequests.findMany({
      where: and(gte(leaveRequests.createdAt, monthRange.start), lte(leaveRequests.createdAt, monthRange.end)),
      with: { leaveType: true },
    }),
    db.query.attendancePunches.findMany({
      where: and(gte(attendancePunches.punchTime, trendRange.start), lte(attendancePunches.punchTime, trendRange.end)),
      orderBy: (table, { asc }) => [asc(table.punchTime)],
    }),
  ]);

  const activeEmployeeIds = new Set(activeEmployees.map((employee) => employee.id));
  const exemptEmployeeIds = new Set(
    activeEmployees
      .filter((employee) => isEmployeeBiometricExempt(employee, activeExemptions))
      .map((employee) => employee.id),
  );
  const punchesByEmployee = groupPunchesByEmployee(dayPunches);
  const leaveGroups = groupApprovedLeave(approvedLeaves, activeEmployeeIds);
  const scheduleByEmployee = getScheduleByEmployee(workScheduleAssignments, selectedDate);
  const lateEmployeeIds = getLateEmployeeIds(punchesByEmployee, scheduleByEmployee, selectedDate);
  const presentEmployeeIds = new Set([...punchesByEmployee.keys()].filter((id) => activeEmployeeIds.has(id)));
  const absentEmployeeIds = activeEmployees
    .filter((employee) => (
      !presentEmployeeIds.has(employee.id)
      && !leaveGroups.all.has(employee.id)
      && !leaveGroups.officialDuty.has(employee.id)
      && !leaveGroups.fieldDuty.has(employee.id)
      && !leaveGroups.remote.has(employee.id)
      && !exemptEmployeeIds.has(employee.id)
    ))
    .map((employee) => employee.id);

  const departmentPerformance = buildDepartmentPerformance({
    employees: activeEmployees,
    presentEmployeeIds,
    leaveEmployeeIds: leaveGroups.all,
    dutyEmployeeIds: unionSets(leaveGroups.officialDuty, leaveGroups.fieldDuty, leaveGroups.remote),
    lateEmployeeIds,
    absentEmployeeIds: new Set(absentEmployeeIds),
    exemptEmployeeIds,
    pendingRequests: [...pendingManualRequests, ...pendingLeaveRequests],
  });
  const deviceHealth = buildDeviceHealth(activeDevices);
  const syncFailures = recentSyncBatches.filter((batch) => batch.syncStatus === 'FAILED' || batch.syncStatus === 'PARTIAL').length;
  const leaveSummary = buildLeaveSummary(approvedLeaves);
  const attendanceRate = percentage(
    presentEmployeeIds.size + leaveGroups.all.size + leaveGroups.officialDuty.size + leaveGroups.fieldDuty.size + leaveGroups.remote.size,
    Math.max(activeEmployees.length - exemptEmployeeIds.size, 0),
  );

  const workforceStatus = {
    totalEmployees: activeEmployees.length,
    presentToday: presentEmployeeIds.size,
    absentToday: absentEmployeeIds.length,
    onApprovedLeave: leaveGroups.all.size,
    lateArrivals: lateEmployeeIds.size,
    workingRemotely: leaveGroups.remote.size,
    officialAssignment: leaveGroups.officialDuty.size + leaveGroups.fieldDuty.size,
    attendanceRate,
  };
  const compoundStatus = buildCompoundStatus({
    employees: activeEmployees,
    punchesByEmployee,
    leaveEmployeeIds: unionSets(leaveGroups.all, leaveGroups.officialDuty, leaveGroups.fieldDuty, leaveGroups.remote),
    exemptEmployeeIds,
  });
  const hrPerformance = buildHrPerformance({
    pendingManualRequests: pendingManualRequests.length,
    pendingLeaveRequests: pendingLeaveRequests.length,
    monthManualRequests,
    monthLeaveRequests,
    activeEmployeeCount: activeEmployees.length,
  });
  const exceptions = buildExceptions({
    workforceStatus,
    departmentPerformance,
    deviceHealth,
    syncFailures,
    hrPerformance,
  });

  return {
    generatedAt,
    date: selectedDate,
    month: selectedMonth,
    workforceStatus,
    workforceDistribution: buildWorkforceDistribution({
      present: Math.max(presentEmployeeIds.size - lateEmployeeIds.size, 0),
      leave: Math.max(leaveGroups.all.size - leaveGroups.officialDuty.size - leaveGroups.fieldDuty.size - leaveGroups.remote.size, 0),
      absent: absentEmployeeIds.length,
      late: lateEmployeeIds.size,
      officialDuty: leaveGroups.officialDuty.size + leaveGroups.fieldDuty.size,
      total: activeEmployees.length,
    }),
    departmentAttendanceRanking: departmentPerformance
      .slice()
      .sort((left, right) => right.attendanceRate - left.attendanceRate)
      .slice(0, 8)
      .map(({ department, attendanceRate, present, totalEmployees }) => ({
        department,
        attendanceRate,
        present,
        totalEmployees,
      })),
    compoundStatus,
    liveAttendanceTimeline: buildTimeline(dayPunches),
    leaveSummary,
    hrPerformance,
    departmentPerformance,
    monthlyAttendanceTrend: buildMonthlyTrend({
      punches: trendPunches,
      employeeCount: activeEmployees.length,
      selectedMonth,
    }),
    attendanceExceptions: exceptions.attendance,
    deviceHealth,
    executiveAlerts: exceptions.executive,
  };
}

function normalizeDateParam(date?: string) {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date().toISOString().slice(0, 10);
}

function normalizeMonthParam(month: string | undefined, date: string) {
  if (month && /^\d{4}-\d{2}$/.test(month)) return month;
  return date.slice(0, 7);
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

function getSixMonthRange(month: string) {
  const [year, zeroBasedMonth] = month.split('-').map(Number);
  return {
    start: new Date(year, zeroBasedMonth - 6, 1, 0, 0, 0, 0),
    end: new Date(year, zeroBasedMonth, 0, 23, 59, 59, 999),
  };
}

function groupPunchesByEmployee(punches: any[]) {
  const grouped = new Map<string, Punch[]>();

  for (const punch of punches) {
    if (!punch.employeeId) continue;
    grouped.set(punch.employeeId, [...(grouped.get(punch.employeeId) ?? []), punch]);
  }

  return grouped;
}

function groupApprovedLeave(approvedLeaves: any[], activeEmployeeIds: Set<string>) {
  const groups = {
    all: new Set<string>(),
    officialDuty: new Set<string>(),
    fieldDuty: new Set<string>(),
    remote: new Set<string>(),
  };

  for (const request of approvedLeaves) {
    if (!activeEmployeeIds.has(request.employeeId)) continue;
    const category = categorizeLeaveType(request.leaveType);
    if (category === 'REMOTE') groups.remote.add(request.employeeId);
    else if (category === 'FIELD_DUTY') groups.fieldDuty.add(request.employeeId);
    else if (category === 'OFFICIAL_DUTY' || category === 'TRAINING') groups.officialDuty.add(request.employeeId);
    else groups.all.add(request.employeeId);
  }

  return groups;
}

function categorizeLeaveType(leaveType: any) {
  const text = `${leaveType?.code ?? ''} ${leaveType?.nameEn ?? ''} ${leaveType?.nameAm ?? ''}`.toLowerCase();
  if (text.includes('remote') || text.includes('work from home')) return 'REMOTE';
  if (text.includes('field')) return 'FIELD_DUTY';
  if (text.includes('official') || text.includes('assignment') || text.includes('duty')) return 'OFFICIAL_DUTY';
  if (text.includes('training')) return 'TRAINING';
  return 'LEAVE';
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
    const lateAfter = getLateAfterTime(scheduleByEmployee.get(employeeId), dayOfWeek, date);
    if (firstPunch.punchTime > lateAfter) {
      lateEmployeeIds.add(employeeId);
    }
  }

  return lateEmployeeIds;
}

function getLateAfterTime(assignment: any, dayOfWeek: string, date: string) {
  const day = assignment?.workSchedule?.days?.find((item: any) => item.dayOfWeek === dayOfWeek && item.isActive && !item.isOffDay);
  const shift = day?.shift;
  const segments = [...(shift?.segments ?? [])].sort((left: any, right: any) => {
    const sortOrder = Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0);
    return sortOrder || String(left.startTime).localeCompare(String(right.startTime));
  });
  const startTime = segments[0]?.startTime ?? DEFAULT_SHIFT_START;
  const graceMinutes = Number(shift?.gracePeriodMinutes ?? 0) + Number(shift?.lateAfterMinutes ?? 0);
  const lateAfter = new Date(`${date}T${startTime}`);
  lateAfter.setMinutes(lateAfter.getMinutes() + graceMinutes);
  return lateAfter;
}

function getDayOfWeek(date: string) {
  return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][new Date(`${date}T00:00:00`).getDay()];
}

function buildDepartmentPerformance(input: {
  employees: any[];
  presentEmployeeIds: Set<string>;
  leaveEmployeeIds: Set<string>;
  dutyEmployeeIds: Set<string>;
  lateEmployeeIds: Set<string>;
  absentEmployeeIds: Set<string>;
  exemptEmployeeIds: Set<string>;
  pendingRequests: Array<{ employeeId: string }>;
}) {
  const grouped = new Map<string, any[]>();
  for (const employee of input.employees) {
    const key = employee.departmentId ?? 'unassigned';
    grouped.set(key, [...(grouped.get(key) ?? []), employee]);
  }

  const pendingByDepartment = new Map<string, number>();
  for (const request of input.pendingRequests) {
    const employee = input.employees.find((item) => item.id === request.employeeId);
    if (!employee?.departmentId) continue;
    pendingByDepartment.set(employee.departmentId, (pendingByDepartment.get(employee.departmentId) ?? 0) + 1);
  }

  return [...grouped.entries()]
    .map(([departmentId, departmentEmployees]) => {
      const eligible = departmentEmployees.filter((employee) => !input.exemptEmployeeIds.has(employee.id));
      const present = departmentEmployees.filter((employee) => input.presentEmployeeIds.has(employee.id)).length;
      const leave = departmentEmployees.filter((employee) => input.leaveEmployeeIds.has(employee.id)).length;
      const duty = departmentEmployees.filter((employee) => input.dutyEmployeeIds.has(employee.id)).length;
      const late = departmentEmployees.filter((employee) => input.lateEmployeeIds.has(employee.id)).length;
      const absent = departmentEmployees.filter((employee) => input.absentEmployeeIds.has(employee.id)).length;
      const attendanceRate = percentage(present + leave + duty, eligible.length);
      const leaveRate = percentage(leave + duty, departmentEmployees.length);

      return {
        departmentId: departmentId === 'unassigned' ? null : departmentId,
        department: departmentEmployees[0]?.department?.nameEn ?? departmentEmployees[0]?.sourceDepartmentName ?? 'Unassigned',
        totalEmployees: departmentEmployees.length,
        present,
        absent,
        lateEmployees: late,
        pendingApprovals: pendingByDepartment.get(departmentId) ?? 0,
        leaveRate,
        attendanceRate,
        trend: attendanceRate >= LOW_ATTENDANCE_THRESHOLD ? 'UP' : 'DOWN',
      };
    })
    .sort((left, right) => right.attendanceRate - left.attendanceRate);
}

function buildDeviceHealth(devices: any[]) {
  return {
    total: devices.length,
    online: devices.filter((device) => device.healthStatus === 'ONLINE').length,
    offline: devices.filter((device) => device.healthStatus === 'OFFLINE').length,
    error: devices.filter((device) => device.healthStatus === 'ERROR').length,
    unknown: devices.filter((device) => device.healthStatus === 'UNKNOWN').length,
  };
}

function buildLeaveSummary(approvedLeaves: any[]) {
  const grouped = new Map<string, { label: string; count: number }>();

  for (const request of approvedLeaves) {
    const key = request.leaveType?.code ?? request.leaveTypeId;
    const label = request.leaveType?.nameEn ?? request.leaveType?.code ?? 'Leave';
    grouped.set(key, { label, count: (grouped.get(key)?.count ?? 0) + 1 });
  }

  return [...grouped.entries()]
    .map(([id, value]) => ({ id, label: value.label, count: value.count }))
    .sort((left, right) => right.count - left.count);
}

function buildCompoundStatus(input: {
  employees: any[];
  punchesByEmployee: Map<string, Punch[]>;
  leaveEmployeeIds: Set<string>;
  exemptEmployeeIds: Set<string>;
}) {
  let currentlyInside = 0;
  let checkedOut = 0;

  for (const punches of input.punchesByEmployee.values()) {
    const latestPunch = punches[punches.length - 1];
    if (!latestPunch) continue;
    if (latestPunch.punchType === 'OUT' || latestPunch.punchType === 'BREAK_OUT') checkedOut += 1;
    else currentlyInside += 1;
  }

  const notYetArrived = input.employees.filter((employee) => (
    !input.punchesByEmployee.has(employee.id)
    && !input.leaveEmployeeIds.has(employee.id)
    && !input.exemptEmployeeIds.has(employee.id)
  )).length;

  return { currentlyInside, checkedOut, notYetArrived };
}

function buildHrPerformance(input: {
  pendingManualRequests: number;
  pendingLeaveRequests: number;
  monthManualRequests: any[];
  monthLeaveRequests: any[];
  activeEmployeeCount: number;
}) {
  const resolvedRequests = [...input.monthManualRequests, ...input.monthLeaveRequests]
    .filter((request) => request.status === 'APPROVED' || request.status === 'REJECTED');
  const averageApprovalTimeHours = average(
    resolvedRequests
      .map((request) => {
        const resolvedAt = request.approvedAt ?? request.rejectedAt;
        if (!resolvedAt || !request.createdAt) return null;
        return (new Date(resolvedAt).getTime() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60);
      })
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0),
  );
  const correctionsReturned = input.monthManualRequests.filter((request) => request.status === 'REJECTED').length;
  const totalPending = input.pendingManualRequests + input.pendingLeaveRequests;

  return {
    pendingHrApproval: input.pendingManualRequests,
    pendingLeaveApproval: input.pendingLeaveRequests,
    averageApprovalTimeHours: round1(averageApprovalTimeHours),
    correctionsReturned,
    payrollReadyPercent: percentage(Math.max(input.activeEmployeeCount - totalPending, 0), input.activeEmployeeCount),
  };
}

function buildTimeline(punches: any[]) {
  const buckets = new Map<string, number>();

  for (let hour = TIMELINE_START_HOUR; hour <= TIMELINE_END_HOUR; hour += 1) {
    buckets.set(`${String(hour).padStart(2, '0')}:00`, 0);
    buckets.set(`${String(hour).padStart(2, '0')}:30`, 0);
  }

  for (const punch of punches) {
    const date = new Date(punch.punchTime);
    const hour = date.getHours();
    if (hour < TIMELINE_START_HOUR || hour > TIMELINE_END_HOUR) continue;
    const label = `${String(hour).padStart(2, '0')}:${date.getMinutes() < 30 ? '00' : '30'}`;
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([time, count]) => ({ time, count }));
}

function buildMonthlyTrend(input: { punches: any[]; employeeCount: number; selectedMonth: string }) {
  const months = getTrendMonthLabels(input.selectedMonth);
  const presentByMonth = new Map(months.map((month) => [month.key, new Set<string>()]));

  for (const punch of input.punches) {
    if (!punch.employeeId) continue;
    const key = new Date(punch.punchTime).toISOString().slice(0, 7);
    presentByMonth.get(key)?.add(punch.employeeId);
  }

  return months.map((month) => {
    const present = presentByMonth.get(month.key)?.size ?? 0;
    return {
      month: month.label,
      present,
      attendanceRate: percentage(present, input.employeeCount),
    };
  });
}

function getTrendMonthLabels(selectedMonth: string) {
  const [year, zeroBasedMonth] = selectedMonth.split('-').map(Number);
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(year, zeroBasedMonth - 6 + index, 1);
    return {
      key: date.toISOString().slice(0, 7),
      label: date.toLocaleString('en', { month: 'short' }),
    };
  });
}

function buildWorkforceDistribution(input: {
  present: number;
  leave: number;
  absent: number;
  late: number;
  officialDuty: number;
  total: number;
}) {
  return [
    createDistributionSegment('present', 'Present', input.present, input.total),
    createDistributionSegment('leave', 'Leave', input.leave, input.total),
    createDistributionSegment('absent', 'Absent', input.absent, input.total),
    createDistributionSegment('late', 'Late', input.late, input.total),
    createDistributionSegment('officialDuty', 'Official duty', input.officialDuty, input.total),
  ];
}

function createDistributionSegment(id: string, label: string, count: number, total: number) {
  return {
    id,
    label,
    count,
    percentage: percentage(count, total),
  };
}

function buildExceptions(input: {
  workforceStatus: any;
  departmentPerformance: any[];
  deviceHealth: ReturnType<typeof buildDeviceHealth>;
  syncFailures: number;
  hrPerformance: ReturnType<typeof buildHrPerformance>;
}) {
  const attendance: Array<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; count: number; description: string }> = [];
  const executive: Array<{ id: string; severity: 'critical' | 'warning' | 'info'; title: string; description: string }> = [];
  const lowDepartments = input.departmentPerformance.filter((department) => department.attendanceRate < LOW_ATTENDANCE_THRESHOLD);

  if (input.workforceStatus.lateArrivals >= 5) {
    attendance.push({
      id: 'late-arrivals',
      severity: 'warning',
      title: 'Employees with late arrivals',
      count: input.workforceStatus.lateArrivals,
      description: 'Review departments with recurring late arrivals.',
    });
  }
  if (input.workforceStatus.absentToday > 0) {
    attendance.push({
      id: 'absent-employees',
      severity: 'warning',
      title: 'Employees absent today',
      count: input.workforceStatus.absentToday,
      description: 'Biometric-exempt employees and approved leave are excluded.',
    });
  }
  if (lowDepartments.length > 0) {
    attendance.push({
      id: 'low-attendance-departments',
      severity: 'critical',
      title: 'Departments below attendance threshold',
      count: lowDepartments.length,
      description: `${lowDepartments[0].department} is below ${LOW_ATTENDANCE_THRESHOLD}%.`,
    });
    executive.push({
      id: 'low-department-attendance',
      severity: 'critical',
      title: `${lowDepartments[0].department} attendance below ${LOW_ATTENDANCE_THRESHOLD}%`,
      description: 'Department attendance needs executive attention.',
    });
  }
  if (input.deviceHealth.offline + input.deviceHealth.error > 0) {
    executive.push({
      id: 'device-health',
      severity: 'critical',
      title: `${input.deviceHealth.offline + input.deviceHealth.error} biometric device issue(s)`,
      description: 'Device health may affect attendance capture.',
    });
  }
  if (input.syncFailures > 0) {
    executive.push({
      id: 'sync-failures',
      severity: 'warning',
      title: `${input.syncFailures} synchronization issue(s)`,
      description: 'Recent sync batches include failed or partial runs.',
    });
  }
  if (input.hrPerformance.pendingHrApproval > 0) {
    executive.push({
      id: 'pending-hr-approvals',
      severity: 'warning',
      title: `${input.hrPerformance.pendingHrApproval} attendance correction(s) waiting`,
      description: 'Pending HR approvals can block payroll readiness.',
    });
  }
  if (input.hrPerformance.pendingLeaveApproval > 0) {
    executive.push({
      id: 'pending-leave-approvals',
      severity: 'info',
      title: `${input.hrPerformance.pendingLeaveApproval} leave approval(s) pending`,
      description: 'Supervisor leave decisions are still open.',
    });
  }
  if (input.hrPerformance.payrollReadyPercent < 98) {
    executive.push({
      id: 'payroll-readiness',
      severity: 'warning',
      title: 'Payroll readiness below target',
      description: `${input.hrPerformance.payrollReadyPercent}% of records are currently clear.`,
    });
  }

  return { attendance, executive };
}

function unionSets<T>(...sets: Set<T>[]) {
  return new Set(sets.flatMap((set) => [...set]));
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
