import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendancePunches,
  biometricExemptions,
  employeeSupervisors,
  employeeWorkSchedules,
  employees,
  leaveBalances,
  leaveFiscalYears,
  leaveRequests,
  manualPunchRequests,
} from '../../schema';
import { isEmployeeBiometricExempt } from '../../../lib/biometric-exemptions';

const DEFAULT_SHIFT_START = '08:30:00';

export type DepartmentHeadDashboardSummaryParams = {
  userId: string;
  roles?: string[] | null;
  date?: string;
};

type Punch = typeof attendancePunches.$inferSelect;

const SUPERVISOR_ROLE_NAMES = ['supervisor', 'admin', 'super_admin', 'superadmin'];

export async function getDepartmentHeadDashboardSummary(params: DepartmentHeadDashboardSummaryParams) {
  const selectedDate = normalizeDateParam(params.date);
  const generatedAt = new Date();
  const dayRange = getDayRange(selectedDate);
  const roles = (params.roles ?? []).map((role) => role.toLowerCase());
  const hasSupervisorRole = roles.some((role) => SUPERVISOR_ROLE_NAMES.includes(role));

  const supervisor = await db.query.employees.findFirst({
    where: eq(employees.userId, params.userId),
    with: { department: true, position: true },
  });

  if (!supervisor) {
    throw new Error('Department head dashboard requires a linked employee profile');
  }

  const directReports = await db.query.employeeSupervisors.findMany({
    where: and(
      eq(employeeSupervisors.supervisorId, supervisor.id),
      lte(employeeSupervisors.effectiveFrom, selectedDate),
      or(isNull(employeeSupervisors.effectiveTo), gte(employeeSupervisors.effectiveTo, selectedDate)),
    ),
    columns: { employeeId: true },
  });

  if (!hasSupervisorRole && directReports.length === 0) {
    throw new Error('Department head dashboard is available only to supervisors');
  }

  const departmentEmployees = await db.query.employees.findMany({
    where: and(
      eq(employees.isActive, true),
      eq(employees.departmentId, supervisor.departmentId),
    ),
    with: { department: true, position: true },
    orderBy: (table, { asc }) => [asc(table.firstNameEn), asc(table.lastNameEn)],
  });

  const departmentEmployeeIds = departmentEmployees.map((employee) => employee.id);

  if (departmentEmployeeIds.length === 0) {
    return createEmptySummary({ generatedAt, selectedDate, supervisor });
  }

  const [
    dayPunches,
    approvedLeaves,
    pendingLeaveRequests,
    pendingCorrections,
    pendingAttendancePunches,
    activeExemptions,
    workScheduleAssignments,
    currentAnnualLeaveBalance,
  ] = await Promise.all([
    db.query.attendancePunches.findMany({
      where: and(
        inArray(attendancePunches.employeeId, departmentEmployeeIds),
        gte(attendancePunches.punchTime, dayRange.start),
        lte(attendancePunches.punchTime, dayRange.end),
      ),
      with: { employee: { with: { department: true, position: true } }, device: true },
      orderBy: (table, { asc }) => [asc(table.punchTime)],
    }),
    db.query.leaveRequests.findMany({
      where: and(
        inArray(leaveRequests.employeeId, departmentEmployeeIds),
        eq(leaveRequests.status, 'APPROVED'),
        lte(leaveRequests.startDate, selectedDate),
        gte(leaveRequests.endDate, selectedDate),
      ),
      with: { employee: { with: { department: true, position: true } }, leaveType: true },
    }),
    db.query.leaveRequests.findMany({
      where: and(
        inArray(leaveRequests.employeeId, departmentEmployeeIds),
        eq(leaveRequests.status, 'PENDING'),
      ),
      with: { employee: { with: { department: true, position: true } }, leaveType: true },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit: 20,
    }),
    db.query.manualPunchRequests.findMany({
      where: and(
        inArray(manualPunchRequests.employeeId, departmentEmployeeIds),
        inArray(manualPunchRequests.status, ['PENDING_HR_REVIEW', 'HR_REVIEWED', 'PENDING']),
      ),
      with: { employee: { with: { department: true, position: true } } },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit: 20,
    }),
    db.query.attendancePunches.findMany({
      where: and(
        inArray(attendancePunches.employeeId, departmentEmployeeIds),
        eq(attendancePunches.isProcessed, false),
        gte(attendancePunches.punchTime, dayRange.start),
        lte(attendancePunches.punchTime, dayRange.end),
      ),
      with: { employee: { with: { department: true, position: true } }, device: true },
      orderBy: (table, { asc }) => [asc(table.punchTime)],
      limit: 20,
    }),
    db.query.biometricExemptions.findMany({
      where: eq(biometricExemptions.isActive, true),
    }),
    db.query.employeeWorkSchedules.findMany({
      where: and(
        inArray(employeeWorkSchedules.employeeId, departmentEmployeeIds),
        eq(employeeWorkSchedules.isActive, true),
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
      orderBy: (table, { desc }) => [desc(table.effectiveFrom), desc(table.createdAt)],
    }),
    getCurrentAnnualLeaveBalance(supervisor.id),
  ]);

  const punchesByEmployee = groupPunchesByEmployee(dayPunches);
  const presentEmployeeIds = new Set([...punchesByEmployee.keys()]);
  const leaveEmployeeIds = new Set(approvedLeaves.map((request) => request.employeeId));
  const coveredLeaveEmployeeIds = new Set(
    approvedLeaves
      .filter((request) => !isUnpaidLeaveType(request.leaveType))
      .map((request) => request.employeeId),
  );
  const exemptEmployeeIds = new Set(
    departmentEmployees
      .filter((employee) => isEmployeeBiometricExempt(employee, activeExemptions))
      .map((employee) => employee.id),
  );
  const scheduleByEmployee = getScheduleByEmployee(workScheduleAssignments, selectedDate);
  const lateEmployeeIds = getLateEmployeeIds(punchesByEmployee, scheduleByEmployee, selectedDate);
  const absentEmployees = departmentEmployees.filter((employee) => (
    !presentEmployeeIds.has(employee.id)
    && !coveredLeaveEmployeeIds.has(employee.id)
    && !exemptEmployeeIds.has(employee.id)
  ));

  return {
    generatedAt,
    date: selectedDate,
    department: supervisor.department ?? null,
    supervisor,
    currentAnnualLeaveBalance,
    widgets: {
      todaysStaff: createWidget('todays-staff', "Today's Staff", departmentEmployees.length, '/employees'),
      present: createWidget('present', 'Present', presentEmployeeIds.size, '/attendance-punches'),
      absent: createWidget('absent', 'Absent', absentEmployees.length, '/attendance-punches'),
      leave: createWidget('leave', 'Leave', leaveEmployeeIds.size, '/leave-request-approvals'),
      late: createWidget('late', 'Late', lateEmployeeIds.size, '/attendance-punches'),
      pendingAttendance: createWidget('pending-attendance', 'Pending Attendance', pendingAttendancePunches.length, '/attendance-punches'),
      pendingLeave: createWidget('pending-leave', 'Pending Leave', pendingLeaveRequests.length, '/leave-request-approvals'),
      pendingCorrections: createWidget('pending-corrections', 'Pending Corrections', pendingCorrections.length, '/attendance-correction-approvals'),
    },
    details: {
      todaysStaff: departmentEmployees,
      presentEmployees: departmentEmployees.filter((employee) => presentEmployeeIds.has(employee.id)),
      absentEmployees,
      employeesOnLeave: approvedLeaves,
      lateEmployees: departmentEmployees.filter((employee) => lateEmployeeIds.has(employee.id)),
      pendingAttendance: pendingAttendancePunches,
      pendingLeave: pendingLeaveRequests,
      pendingCorrections,
    },
  };
}

function isUnpaidLeaveType(leaveType: any) {
  return String(leaveType?.code ?? '').trim().toUpperCase() === 'UNPAID';
}

function createEmptySummary(input: { generatedAt: Date; selectedDate: string; supervisor: any }) {
  return {
    generatedAt: input.generatedAt,
    date: input.selectedDate,
    department: input.supervisor.department ?? null,
    supervisor: input.supervisor,
    currentAnnualLeaveBalance: null,
    widgets: {
      todaysStaff: createWidget('todays-staff', "Today's Staff", 0, '/employees'),
      present: createWidget('present', 'Present', 0, '/attendance-punches'),
      absent: createWidget('absent', 'Absent', 0, '/attendance-punches'),
      leave: createWidget('leave', 'Leave', 0, '/leave-request-approvals'),
      late: createWidget('late', 'Late', 0, '/attendance-punches'),
      pendingAttendance: createWidget('pending-attendance', 'Pending Attendance', 0, '/attendance-punches'),
      pendingLeave: createWidget('pending-leave', 'Pending Leave', 0, '/leave-request-approvals'),
      pendingCorrections: createWidget('pending-corrections', 'Pending Corrections', 0, '/attendance-correction-approvals'),
    },
    details: {
      todaysStaff: [],
      presentEmployees: [],
      absentEmployees: [],
      employeesOnLeave: [],
      lateEmployees: [],
      pendingAttendance: [],
      pendingLeave: [],
      pendingCorrections: [],
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
    where: and(
      eq(leaveBalances.employeeId, employeeId),
      eq(leaveBalances.fiscalYearId, activeFiscalYear.id),
    ),
    with: {
      employee: { with: { department: true, position: true } },
      fiscalYear: true,
    },
  });
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

function createWidget(id: string, label: string, count: number, href: string) {
  return { id, label, count, href };
}
