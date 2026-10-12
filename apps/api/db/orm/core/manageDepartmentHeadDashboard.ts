import { and, eq, inArray } from 'drizzle-orm';
import { PENDING_CORRECTION_STATUSES } from '../../../lib/attendance/correction-status';
import { addisToday } from '../../../lib/attendance/schedule-evaluator';
import { attendanceRate, countStatuses, punctualityRate } from '../../../lib/dashboard/executive-metrics';
import { db } from '../../db';
import { employees, leaveBalances, leaveFiscalYears, leaveRequests, manualPunchRequests } from '../../schema';
import { countMissingRecords, hasMissingCheckout, loadAttendanceDays } from './attendanceDays';
import { getVisibleEmployeeIdsForSupervisorActor } from './manageSupervisorDelegations';

/** Detail lists show this many rows; widget counts are always complete. */
const DETAIL_LIMIT = 20;
const SUPERVISOR_ROLE_NAMES = ['supervisor', 'admin', 'super_admin', 'superadmin'];

export type DepartmentHeadDashboardSummaryParams = {
  userId: string;
  roles?: string[] | null;
  date?: string;
};

export async function getDepartmentHeadDashboardSummary(params: DepartmentHeadDashboardSummaryParams) {
  const generatedAt = new Date();
  const today = addisToday(generatedAt);
  const selectedDate = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) && params.date <= today ? params.date : today;
  const roles = (params.roles ?? []).map((role) => role.toLowerCase());
  const hasSupervisorRole = roles.some((role) => SUPERVISOR_ROLE_NAMES.includes(role));

  const supervisor = await db.query.employees.findFirst({
    where: eq(employees.userId, params.userId),
    with: { department: true, position: true },
  });
  if (!supervisor) throw new Error('Department head dashboard requires a linked employee profile');

  // Direct reports on the selected date (including any taken over through a delegation).
  const reportIds = await getVisibleEmployeeIdsForSupervisorActor(params.userId, params.roles, db, selectedDate);
  if (!hasSupervisorRole && reportIds.length === 0) throw new Error('Department head dashboard is available only to supervisors');

  const [context, reports, pendingLeave, pendingCorrections, currentAnnualLeaveBalance] = await Promise.all([
    loadAttendanceDays({ from: selectedDate, to: selectedDate, employeeIds: reportIds, now: generatedAt }),
    reportIds.length
      ? db.query.employees.findMany({
        where: inArray(employees.id, reportIds),
        with: { department: true, position: true },
        orderBy: (table, { asc }) => [asc(table.firstNameEn), asc(table.lastNameEn)],
      })
      : Promise.resolve([]),
    reportIds.length
      ? db.query.leaveRequests.findMany({
        where: and(inArray(leaveRequests.employeeId, reportIds), eq(leaveRequests.status, 'PENDING')),
        with: { employee: { with: { department: true, position: true } }, leaveType: true },
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      })
      : Promise.resolve([]),
    reportIds.length
      ? db.query.manualPunchRequests.findMany({
        where: and(inArray(manualPunchRequests.employeeId, reportIds), inArray(manualPunchRequests.status, PENDING_CORRECTION_STATUSES)),
        with: { employee: { with: { department: true, position: true } } },
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      })
      : Promise.resolve([]),
    supervisor.employmentType === 'CONTRACT' ? getCurrentAnnualLeaveBalance(supervisor.id) : Promise.resolve(null),
  ]);

  const reportById = new Map(reports.map((employee) => [employee.id, employee]));
  const staff = reports.filter((employee) => {
    const row = context.employeeById.get(employee.id);
    return row ? context.isCounted(row, selectedDate) : false;
  });
  const reportIdSet = new Set(reportIds);
  const days = context.days.filter((day) => day.date === selectedDate && reportIdSet.has(day.record.employeeId));
  const counts = countStatuses(days);
  const { missingRecords, missingToday } = countMissingRecords({
    from: selectedDate,
    to: selectedDate,
    today,
    employees: context.employees.filter((employee) => reportIdSet.has(employee.id)),
    isCounted: context.isCounted,
    effectiveDepartment: context.effectiveDepartment,
    include: () => true,
    days,
  });

  const employeesWith = (status: string) => days
    .filter((day) => day.status === status)
    .map((day) => reportById.get(day.record.employeeId))
    .filter((employee): employee is NonNullable<typeof employee> => Boolean(employee));
  // Daily records the supervisor still has to approve for this date.
  const pendingAttendance = days
    .filter((day) => day.record.status === 'PENDING_SUPERVISOR' || day.record.status === 'RETURNED')
    .map((day) => ({
      id: day.record.id,
      employee: reportById.get(day.record.employeeId) ?? null,
      attendanceDate: day.date,
      status: day.record.status,
      attendanceStatus: day.status,
      checkInAt: day.record.checkInAt,
    }));
  const missingCheckout = days.filter((day) => hasMissingCheckout(day, generatedAt, today)).length;

  return {
    generatedAt,
    date: selectedDate,
    isLive: selectedDate === today,
    department: supervisor.department ?? null,
    supervisor,
    currentAnnualLeaveBalance,
    attendanceSummary: {
      headcount: staff.length,
      present: counts.ON_TIME + counts.LATE,
      onTime: counts.ON_TIME,
      late: counts.LATE,
      absent: counts.ABSENT,
      notYetArrived: counts.NOT_YET_ARRIVED,
      onLeave: counts.LEAVE,
      biometricExempt: counts.EXEMPT,
      restDay: counts.REST,
      noSchedule: counts.NO_SCHEDULE,
      missingCheckout,
      attendanceRate: attendanceRate(counts),
      punctualityRate: punctualityRate(counts),
    },
    dataQuality: { missingRecords, missingToday, noScheduleEmployees: counts.NO_SCHEDULE },
    widgets: {
      todaysStaff: createWidget('todays-staff', "Today's Staff", staff.length, '/contract-employees'),
      present: createWidget('present', 'Present', counts.ON_TIME + counts.LATE, '/attendance-punches'),
      absent: createWidget('absent', 'Absent', counts.ABSENT, '/attendance-punches'),
      leave: createWidget('leave', 'Leave', counts.LEAVE, '/leave-request-approvals'),
      late: createWidget('late', 'Late', counts.LATE, '/attendance-punches'),
      pendingAttendance: createWidget('pending-attendance', 'Pending Attendance', pendingAttendance.length, '/attendance-punches'),
      pendingLeave: createWidget('pending-leave', 'Pending Leave', pendingLeave.length, '/leave-request-approvals'),
      pendingCorrections: createWidget('pending-corrections', 'Pending Corrections', pendingCorrections.length, '/attendance-correction-approvals'),
    },
    details: {
      todaysStaff: staff,
      presentEmployees: [...employeesWith('ON_TIME'), ...employeesWith('LATE')],
      absentEmployees: employeesWith('ABSENT'),
      notYetArrivedEmployees: employeesWith('NOT_YET_ARRIVED'),
      employeesOnLeave: days
        .filter((day) => day.status === 'LEAVE')
        .map((day) => ({ employee: reportById.get(day.record.employeeId) ?? null, leaveType: day.leave?.typeLabel ?? null }))
        .filter((item) => item.employee),
      lateEmployees: employeesWith('LATE'),
      pendingAttendance: pendingAttendance.slice(0, DETAIL_LIMIT),
      pendingLeave: pendingLeave.slice(0, DETAIL_LIMIT),
      pendingCorrections: pendingCorrections.slice(0, DETAIL_LIMIT),
    },
  };
}

async function getCurrentAnnualLeaveBalance(employeeId: string) {
  const activeFiscalYear = await db.query.leaveFiscalYears.findFirst({
    where: eq(leaveFiscalYears.isActive, true),
    columns: { id: true },
  });
  if (!activeFiscalYear) return null;

  return db.query.leaveBalances.findFirst({
    where: and(eq(leaveBalances.employeeId, employeeId), eq(leaveBalances.fiscalYearId, activeFiscalYear.id)),
    with: { employee: { with: { department: true, position: true } }, fiscalYear: true },
  });
}

function createWidget(id: string, label: string, count: number, href: string) {
  return { id, label, count, href };
}
