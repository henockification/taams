import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { addisToday } from '../../../lib/attendance/schedule-evaluator';
import { isEmployeeBiometricExempt } from '../../../lib/biometric-exemptions';
import { isIndefinitelyAbsent } from '../../../lib/employees/absence';
import { isWorkingEmployee } from '../../../lib/employees/employment-status';
import {
  categorizeLeaveType,
  classifyDay,
  datesBetween,
  type ClassifiedDay,
  type LeaveCover,
  type MetricRecord,
} from '../../../lib/dashboard/executive-metrics';
import { db } from '../../db';
import { attendanceDailyRecords, biometricExemptions, departments, employees, leaveRequests, temporaryDepartmentAssignments } from '../../schema';
import { expandDepartmentDescendants } from './manageEmployeeVisibility';

/**
 * Shared loader for every dashboard: attendance daily records classified one status
 * per employee-day (see lib/dashboard/executive-metrics), each attributed to the
 * department the employee worked in that day (temporary assignments included).
 */

export type AttendanceEmployee = {
  id: string;
  departmentId: string | null;
  sourceDepartmentName: string | null;
  sourceEmploymentStatus: string | null;
  employmentStatus: string | null;
  isActive: boolean;
  hireDate: string | null;
  absenceReason: string | null;
  positionId: string | null;
};

export type AttendanceDay = ClassifiedDay & {
  date: string;
  departmentId: string | null;
  record: MetricRecord & {
    id: string;
    earlyDepartureMinutes: number | null;
    lateReturnMinutes: number | null;
    earlyBreakMinutes: number | null;
    scheduledEndAt: Date | string | null;
  };
};

export type DepartmentNode = { id: string; nameEn: string; parentDepartmentId: string | null };

export async function loadAttendanceDays(input: { from: string; to: string; employeeIds?: string[] | null; now?: Date }) {
  const now = input.now ?? new Date();
  const today = addisToday(now);
  const employeeFilter = input.employeeIds;
  const noEmployees = Array.isArray(employeeFilter) && employeeFilter.length === 0;

  const [allDepartments, employeeRows, temporaryAssignments, records, approvedLeaves, activeExemptions] = await Promise.all([
    db.select({ id: departments.id, nameEn: departments.nameEn, parentDepartmentId: departments.parentDepartmentId }).from(departments),
    db.select({
      id: employees.id,
      departmentId: employees.departmentId,
      sourceDepartmentName: employees.sourceDepartmentName,
      sourceEmploymentStatus: employees.sourceEmploymentStatus,
      employmentStatus: employees.employmentStatus,
      isActive: employees.isActive,
      hireDate: employees.hireDate,
      absenceReason: employees.absenceReason,
      positionId: employees.positionId,
    }).from(employees) as Promise<AttendanceEmployee[]>,
    db.select({
      employeeId: temporaryDepartmentAssignments.employeeId,
      targetDepartmentId: temporaryDepartmentAssignments.targetDepartmentId,
      effectiveFrom: temporaryDepartmentAssignments.effectiveFrom,
      effectiveTo: temporaryDepartmentAssignments.effectiveTo,
    }).from(temporaryDepartmentAssignments).where(and(
      eq(temporaryDepartmentAssignments.isActive, true),
      lte(temporaryDepartmentAssignments.effectiveFrom, input.to),
      or(isNull(temporaryDepartmentAssignments.effectiveTo), gte(temporaryDepartmentAssignments.effectiveTo, input.from)),
    )),
    noEmployees ? Promise.resolve([]) : db.select({
      id: attendanceDailyRecords.id,
      employeeId: attendanceDailyRecords.employeeId,
      attendanceDate: attendanceDailyRecords.attendanceDate,
      status: attendanceDailyRecords.status,
      checkInAt: attendanceDailyRecords.checkInAt,
      checkOutAt: attendanceDailyRecords.checkOutAt,
      lateMinutes: attendanceDailyRecords.lateMinutes,
      earlyDepartureMinutes: attendanceDailyRecords.earlyDepartureMinutes,
      lateReturnMinutes: attendanceDailyRecords.lateReturnMinutes,
      earlyBreakMinutes: attendanceDailyRecords.earlyBreakMinutes,
      attendanceDays: attendanceDailyRecords.attendanceDays,
      leaveDays: attendanceDailyRecords.leaveDays,
      holidayDays: attendanceDailyRecords.holidayDays,
      isOffDay: attendanceDailyRecords.isOffDay,
      isBiometricExempt: attendanceDailyRecords.isBiometricExempt,
      scheduledStartAt: attendanceDailyRecords.scheduledStartAt,
      scheduledEndAt: attendanceDailyRecords.scheduledEndAt,
      sessionEvaluations: attendanceDailyRecords.sessionEvaluations,
      returnedAt: attendanceDailyRecords.returnedAt,
    }).from(attendanceDailyRecords).where(and(
      gte(attendanceDailyRecords.attendanceDate, input.from),
      lte(attendanceDailyRecords.attendanceDate, input.to),
      employeeFilter ? inArray(attendanceDailyRecords.employeeId, employeeFilter) : undefined,
    )),
    noEmployees ? Promise.resolve([]) : db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.status, 'AUTHORIZED'),
        lte(leaveRequests.startDate, input.to),
        gte(leaveRequests.endDate, input.from),
        employeeFilter ? inArray(leaveRequests.employeeId, employeeFilter) : undefined,
      ),
      columns: { employeeId: true, startDate: true, endDate: true, leaveTypeId: true },
      with: { leaveType: true, annualLeaveDates: true },
    }),
    db.query.biometricExemptions.findMany({ where: eq(biometricExemptions.isActive, true) }),
  ]);

  const departmentById = new Map(allDepartments.map((department) => [department.id, department]));
  const employeeById = new Map(employeeRows.map((employee) => [employee.id, employee]));
  const assignmentsByEmployee = groupBy(temporaryAssignments, (assignment) => assignment.employeeId);
  const effectiveDepartment = (employeeId: string, date: string) => {
    const assignment = (assignmentsByEmployee.get(employeeId) ?? [])
      .filter((item) => String(item.effectiveFrom) <= date && (!item.effectiveTo || String(item.effectiveTo) >= date))
      .sort((left, right) => String(right.effectiveFrom).localeCompare(String(left.effectiveFrom)))[0];
    return assignment?.targetDepartmentId ?? employeeById.get(employeeId)?.departmentId ?? null;
  };
  /** Should this employee have attendance on this date (working, hired, not away indefinitely)? */
  const isCounted = (employee: AttendanceEmployee, date: string) => (
    isWorkingEmployee(employee)
    && !isIndefinitelyAbsent(employee)
    && (!employee.hireDate || String(employee.hireDate) <= date)
  );

  const covers: LeaveCover[] = approvedLeaves.map((request: any) => ({
    employeeId: request.employeeId,
    startDate: String(request.startDate),
    endDate: String(request.endDate),
    category: categorizeLeaveType(request.leaveType),
    typeKey: request.leaveType?.code ?? request.leaveTypeId,
    typeLabel: request.leaveType?.nameEn ?? request.leaveType?.code ?? 'Leave',
    dates: String(request.leaveType?.code ?? '').toUpperCase() === 'ANNUAL' && request.annualLeaveDates?.length
      ? request.annualLeaveDates
        .filter((item: any) => item.status === 'APPROVED' && ['SCHEDULED', 'CONSUMED'].includes(item.utilizationStatus ?? 'SCHEDULED'))
        .map((item: any) => String(item.leaveDate).slice(0, 10))
      : null,
  }));
  const coversByEmployee = groupBy(covers, (cover) => cover.employeeId);

  const days: AttendanceDay[] = [];
  const isExemptOn = (employee: AttendanceEmployee, date: string) => isEmployeeBiometricExempt(employee, activeExemptions as any, date);
  const pushDay = (row: Omit<AttendanceDay['record'], 'departmentId'>, date: string) => {
    const departmentId = effectiveDepartment(row.employeeId, date);
    const record = { ...row, attendanceDate: date, departmentId } as AttendanceDay['record'];
    days.push({ ...classifyDay(record, coversByEmployee.get(row.employeeId) ?? [], now, today), record, date, departmentId });
  };

  for (const row of records) {
    const date = String(row.attendanceDate).slice(0, 10);
    if (date > today) continue;
    const employee = employeeById.get(row.employeeId);
    if (!employee || isIndefinitelyAbsent(employee)) continue;
    // Exempt days come from the exemption itself (below), not from older records.
    if (isExemptOn(employee, date)) continue;
    pushDay(row as any, date);
  }

  // Biometric-exempt employees get no daily records; count them as exempt on each day.
  const exemptCandidates = employeeRows.filter((employee) => (!employeeFilter || employeeFilter.includes(employee.id))
    && activeExemptions.some((exemption) => exemption.employeeId === employee.id || (exemption.positionId && exemption.positionId === employee.positionId)));
  const lastDate = input.to < today ? input.to : today;
  if (exemptCandidates.length && input.from <= lastDate) {
    for (const date of datesBetween(input.from, lastDate)) {
      for (const employee of exemptCandidates) {
        if (!isCounted(employee, date) || !isExemptOn(employee, date)) continue;
        pushDay({
          id: `exempt:${employee.id}:${date}`,
          employeeId: employee.id,
          attendanceDate: date,
          status: 'EXEMPT',
          checkInAt: null,
          checkOutAt: null,
          lateMinutes: null,
          earlyDepartureMinutes: null,
          lateReturnMinutes: null,
          earlyBreakMinutes: null,
          attendanceDays: 0,
          leaveDays: 0,
          holidayDays: 0,
          isOffDay: false,
          isBiometricExempt: true,
          scheduledStartAt: null,
          scheduledEndAt: null,
          sessionEvaluations: [],
          returnedAt: null,
        }, date);
      }
    }
  }

  return {
    now,
    today,
    departments: allDepartments as DepartmentNode[],
    departmentById,
    employees: employeeRows,
    employeeById,
    effectiveDepartment,
    isCounted,
    days,
  };
}

/**
 * Resolves a department filter: the chosen department plus its sub-departments, limited
 * to the departments the user may see (null allowed list = every department).
 */
export function resolveDepartmentScope(input: {
  departments: DepartmentNode[];
  departmentId?: string | null;
  allowedDepartmentIds?: string[] | null;
}) {
  const allowed = input.allowedDepartmentIds ? new Set(input.allowedDepartmentIds) : null;
  const selectedDepartment = input.departmentId
    ? input.departments.find((department) => department.id === input.departmentId) ?? null
    : null;
  if (input.departmentId && (!selectedDepartment || (allowed && !allowed.has(selectedDepartment.id)))) {
    throw new Error('Department not found');
  }
  let scopeIds: Set<string> | null = allowed;
  if (selectedDepartment) {
    const expanded = expandDepartmentDescendants([selectedDepartment.id], input.departments);
    scopeIds = new Set(allowed ? expanded.filter((id) => allowed.has(id)) : expanded);
  }
  const visibleDepartments = input.departments
    .filter((department) => !allowed || allowed.has(department.id))
    .map((department) => ({ id: department.id, name: department.nameEn, parentDepartmentId: department.parentDepartmentId }))
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    selectedDepartment,
    scopeIds,
    inScope: (departmentId: string | null) => !scopeIds || Boolean(departmentId && scopeIds.has(departmentId)),
    visibleDepartments,
  };
}

/** Employee-days in the range that should have an attendance record but were never generated. */
export function countMissingRecords(input: {
  from: string;
  to: string;
  today: string;
  employees: AttendanceEmployee[];
  isCounted: (employee: AttendanceEmployee, date: string) => boolean;
  effectiveDepartment: (employeeId: string, date: string) => string | null;
  include: (employee: AttendanceEmployee, departmentId: string | null) => boolean;
  days: Array<{ date: string; record: { employeeId: string } }>;
}) {
  const end = input.to < input.today ? input.to : input.today;
  const recordKeys = new Set(input.days.map((day) => `${day.record.employeeId}:${day.date}`));
  let missingRecords = 0;
  let missingToday = 0;
  if (input.from > end) return { missingRecords, missingToday };
  for (const date of datesBetween(input.from, end)) {
    for (const employee of input.employees) {
      if (!input.isCounted(employee, date) || !input.include(employee, input.effectiveDepartment(employee.id, date))) continue;
      if (recordKeys.has(`${employee.id}:${date}`)) continue;
      missingRecords += 1;
      if (date === input.today) missingToday += 1;
    }
  }
  return { missingRecords, missingToday };
}

/**
 * Present employees who checked in for a session but never checked out of it, once
 * that session's checkout window has closed.
 */
export function hasMissingCheckout(day: AttendanceDay, now: Date, today: string) {
  if (day.status !== 'ON_TIME' && day.status !== 'LATE') return false;
  const sessions = Array.isArray(day.record.sessionEvaluations)
    ? day.record.sessionEvaluations as Array<{ checkInAt?: string | null; checkOutAt?: string | null; completionAt?: string | null }>
    : [];
  if (sessions.length === 0) return Boolean(day.record.checkInAt && !day.record.checkOutAt && day.date < today);
  return sessions.some((session) => (
    session.checkInAt && !session.checkOutAt && session.completionAt && new Date(session.completionAt).getTime() <= now.getTime()
  ));
}

export function groupBy<T>(items: T[], key: (item: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const value = key(item);
    const list = grouped.get(value);
    if (list) list.push(item);
    else grouped.set(value, [item]);
  }
  return grouped;
}
