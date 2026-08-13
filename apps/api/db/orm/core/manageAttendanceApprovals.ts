import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendanceDailyRecordAdjustments,
  attendanceDailyRecords,
  attendancePunches,
  biometricExemptions,
  employeeSupervisors,
  employees,
  leaveRequests,
  leaveTypes,
} from '../../schema';
import { isEmployeeBiometricExempt } from '../../../lib/biometric-exemptions';
import type { AttendanceDailyRecordStatus } from '../../../types/core.types';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageHrUnits';

type DbClient = typeof db | any;

type ApprovalScope = {
  userId: string;
  date?: string | null;
  scope?: EmployeeVisibilityScope;
};

export async function generateAttendanceDailyRecords(date?: string | null) {
  const attendanceDate = normalizeDateParam(date);
  const dayRange = getDayRange(attendanceDate);

  const [activeEmployees, punches, approvedLeaves, activeExemptions] = await Promise.all([
    db.query.employees.findMany({
      where: eq(employees.isActive, true),
      columns: { id: true, positionId: true },
    }),
    db.query.attendancePunches.findMany({
      where: and(
        sql`${attendancePunches.employeeId} IS NOT NULL`,
        gte(attendancePunches.punchTime, dayRange.start),
        lte(attendancePunches.punchTime, dayRange.end),
      ),
      orderBy: (table, { asc }) => [asc(table.employeeId), asc(table.punchTime)],
    }),
    db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.status, 'APPROVED'),
        lte(leaveRequests.startDate, attendanceDate),
        gte(leaveRequests.endDate, attendanceDate),
      ),
      with: { leaveType: true },
    }),
    db.query.biometricExemptions.findMany({
      where: eq(biometricExemptions.isActive, true),
    }),
  ]);

  const punchesByEmployee = new Map<string, typeof punches>();
  const leaveDaysByEmployee = new Map<string, number>();
  const unpaidLeaveDaysByEmployee = new Map<string, number>();

  for (const punch of punches) {
    if (!punch.employeeId) continue;
    punchesByEmployee.set(punch.employeeId, [...(punchesByEmployee.get(punch.employeeId) ?? []), punch]);
  }

  for (const leave of approvedLeaves) {
    const leaveDays = getLeaveDaysForDate(leave);
    const target = isUnpaidLeaveType(leave.leaveType) ? unpaidLeaveDaysByEmployee : leaveDaysByEmployee;
    target.set(leave.employeeId, Math.min(1, (target.get(leave.employeeId) ?? 0) + leaveDays));
  }

  const records = [];

  for (const employee of activeEmployees) {
    const employeePunches = punchesByEmployee.get(employee.id) ?? [];
    const firstPunch = employeePunches[0] ?? null;
    const lastPunch = employeePunches[employeePunches.length - 1] ?? null;
    const checkOutAt = employeePunches.length > 1 ? lastPunch?.punchTime ?? null : null;
    const attendanceDays = getAttendanceDays(employeePunches.length);
    const leaveDays = leaveDaysByEmployee.get(employee.id) ?? 0;
    const unpaidLeaveDays = unpaidLeaveDaysByEmployee.get(employee.id) ?? 0;
    const isBiometricExempt = isEmployeeBiometricExempt(employee, activeExemptions);
    const payroll = resolvePayrollDays({ attendanceDays, leaveDays, unpaidLeaveDays, isBiometricExempt });

    const [record] = await db
      .insert(attendanceDailyRecords)
      .values({
        employeeId: employee.id,
        attendanceDate,
        firstPunchId: firstPunch?.id ?? null,
        lastPunchId: lastPunch?.id ?? null,
        checkInAt: firstPunch?.punchTime ?? null,
        checkOutAt,
        totalPunches: employeePunches.length,
        attendanceDays: formatDayValue(attendanceDays),
        leaveDays: formatDayValue(leaveDays),
        payableDays: formatDayValue(payroll.payableDays),
        absenceDays: formatDayValue(payroll.absenceDays),
        isBiometricExempt,
        payrollNote: payroll.note,
        status: 'PENDING_SUPERVISOR',
      } as any)
      .onConflictDoUpdate({
        target: [attendanceDailyRecords.employeeId, attendanceDailyRecords.attendanceDate],
        set: {
          firstPunchId: firstPunch?.id ?? null,
          lastPunchId: lastPunch?.id ?? null,
          checkInAt: firstPunch?.punchTime ?? null,
          checkOutAt,
          totalPunches: employeePunches.length,
          attendanceDays: formatDayValue(attendanceDays),
          leaveDays: formatDayValue(leaveDays),
          payableDays: formatDayValue(payroll.payableDays),
          absenceDays: formatDayValue(payroll.absenceDays),
          isBiometricExempt,
          payrollNote: payroll.note,
          updatedAt: new Date(),
        } as any,
        setWhere: ne(attendanceDailyRecords.status, 'HR_APPROVED'),
      })
      .returning();

    if (record) {
      records.push(await getAttendanceDailyRecordById(record.id));
    }
  }

  return records.filter(Boolean);
}

export async function getSupervisorAttendanceDailyRecords(input: ApprovalScope) {
  const attendanceDate = normalizeDateParam(input.date);
  await generateAttendanceDailyRecords(attendanceDate);

  if (input.scope?.type === 'unrestricted') {
    return db.query.attendanceDailyRecords.findMany({
      where: and(
        eq(attendanceDailyRecords.attendanceDate, attendanceDate),
        inArray(attendanceDailyRecords.status, [
          'PENDING_SUPERVISOR',
          'RETURNED',
          'SUPERVISOR_APPROVED',
        ]),
      ),
      with: recordRelations,
      orderBy: (table, { asc }) => [asc(table.attendanceDate), asc(table.checkInAt)],
    });
  }

  const directReportIds = await getDirectReportIds(input.userId, attendanceDate);

  if (directReportIds.length === 0) return [];

  return getAttendanceDailyRecordsByEmployeeIds(directReportIds, attendanceDate, [
    'PENDING_SUPERVISOR',
    'RETURNED',
    'SUPERVISOR_APPROVED',
  ]);
}

export async function getHrAttendanceDailyRecords(date?: string | null, scope?: EmployeeVisibilityScope) {
  const attendanceDate = normalizeDateParam(date);
  await generateAttendanceDailyRecords(attendanceDate);

  const records = await db.query.attendanceDailyRecords.findMany({
    where: and(
      eq(attendanceDailyRecords.attendanceDate, attendanceDate),
      eq(attendanceDailyRecords.status, 'SUPERVISOR_APPROVED'),
    ),
    with: recordRelations,
    orderBy: (table, { asc }) => [asc(table.attendanceDate), asc(table.checkInAt)],
  });

  if (!scope || scope.type === 'unrestricted') return records;
  if (scope.type === 'hr_units') {
    return records.filter((record) => record.employee?.hrUnitId && scope.hrUnitIds.includes(record.employee.hrUnitId));
  }
  return records.filter((record) => record.employee?.userId === scope.userId);
}

export async function supervisorApproveAttendanceDailyRecord(id: string, input: { userId: string; scope?: EmployeeVisibilityScope }) {
  return db.transaction(async (tx) => {
    const record = await getAttendanceDailyRecordById(id, tx);
    if (!record) throw new Error('Attendance daily record not found');

    if (input.scope?.type !== 'unrestricted') {
      await assertCanSuperviseEmployee(input.userId, record.employeeId, record.attendanceDate, tx);
    }

    if (record.status !== 'PENDING_SUPERVISOR' && record.status !== 'RETURNED') {
      throw new Error('Only pending or returned attendance records can be supervisor approved');
    }

    const approvedAt = new Date();
    await tx
      .update(attendanceDailyRecords)
      .set({
        status: 'SUPERVISOR_APPROVED',
        supervisorApprovedBy: input.userId,
        supervisorApprovedAt: approvedAt,
        hrApprovedBy: null,
        hrApprovedAt: null,
        returnedBy: null,
        returnedAt: null,
        returnReason: null,
        payrollReadyAt: null,
        updatedAt: approvedAt,
      } as any)
      .where(eq(attendanceDailyRecords.id, id));

    return getAttendanceDailyRecordById(id, tx);
  });
}

export async function updateSupervisorAttendanceDailyRecordPayroll(
  id: string,
  input: {
    userId: string;
    attendanceDays?: string | number;
    leaveDays?: string | number;
    payableDays?: string | number;
    payrollNote?: string | null;
    scope?: EmployeeVisibilityScope;
  },
) {
  return db.transaction(async (tx) => {
    const record = await getAttendanceDailyRecordById(id, tx);
    if (!record) throw new Error('Attendance daily record not found');

    if (input.scope?.type !== 'unrestricted') {
      await assertCanSuperviseEmployee(input.userId, record.employeeId, record.attendanceDate, tx);
    }

    if (record.status === 'HR_APPROVED') {
      throw new Error('Payroll-ready attendance records cannot be edited');
    }

    const attendanceDays = input.attendanceDays === undefined ? Number(record.attendanceDays) : parseDayInput(input.attendanceDays, 'attendanceDays');
    const leaveDays = input.leaveDays === undefined ? Number(record.leaveDays) : parseDayInput(input.leaveDays, 'leaveDays');
    const payableDays = input.payableDays === undefined ? Number(record.payableDays) : parseDayInput(input.payableDays, 'payableDays');
    const absenceDays = roundDayValue(Math.max(0, 1 - payableDays));
    const payrollNote = input.payrollNote === undefined ? record.payrollNote ?? null : input.payrollNote?.trim() || null;
    const updatedAt = new Date();

    await tx
      .insert(attendanceDailyRecordAdjustments)
      .values({
        attendanceDailyRecordId: id,
        adjustedBy: input.userId,
        previousAttendanceDays: record.attendanceDays,
        newAttendanceDays: formatDayValue(attendanceDays),
        previousLeaveDays: record.leaveDays,
        newLeaveDays: formatDayValue(leaveDays),
        previousPayableDays: record.payableDays,
        newPayableDays: formatDayValue(payableDays),
        previousAbsenceDays: record.absenceDays,
        newAbsenceDays: formatDayValue(absenceDays),
        previousPayrollNote: record.payrollNote ?? null,
        newPayrollNote: payrollNote,
        reason: payrollNote,
      } as any);

    await tx
      .update(attendanceDailyRecords)
      .set({
        attendanceDays: formatDayValue(attendanceDays),
        leaveDays: formatDayValue(leaveDays),
        payableDays: formatDayValue(payableDays),
        absenceDays: formatDayValue(absenceDays),
        payrollNote,
        updatedAt,
      } as any)
      .where(eq(attendanceDailyRecords.id, id));

    return getAttendanceDailyRecordById(id, tx);
  });
}

export async function hrApproveAttendanceDailyRecord(id: string, input: { userId: string; scope?: EmployeeVisibilityScope }) {
  const record = await getAttendanceDailyRecordById(id);
  if (!record) throw new Error('Attendance daily record not found');
  if (input.scope) await assertCanAccessEmployee(record.employeeId, input.scope);
  if (record.status !== 'SUPERVISOR_APPROVED') {
    throw new Error('Only supervisor-approved attendance records can be HR approved');
  }

  const approvedAt = new Date();
  await db
    .update(attendanceDailyRecords)
    .set({
      status: 'HR_APPROVED',
      hrApprovedBy: input.userId,
      hrApprovedAt: approvedAt,
      payrollReadyAt: approvedAt,
      returnedBy: null,
      returnedAt: null,
      returnReason: null,
      updatedAt: approvedAt,
    } as any)
    .where(eq(attendanceDailyRecords.id, id));

  return getAttendanceDailyRecordById(id);
}

export async function returnAttendanceDailyRecord(id: string, input: { userId: string; reason: string; canHrReturn?: boolean; scope?: EmployeeVisibilityScope }) {
  const record = await getAttendanceDailyRecordById(id);
  if (!record) throw new Error('Attendance daily record not found');

  if (record.status === 'HR_APPROVED') {
    throw new Error('Payroll-ready attendance records cannot be returned');
  }

  const directReportIds = await getDirectReportIds(input.userId, record.attendanceDate);
  const isSupervisorReturn = directReportIds.includes(record.employeeId);

  if (!isSupervisorReturn && !input.canHrReturn) {
    throw new Error('You do not have permission to return this attendance record');
  }

  if (!isSupervisorReturn && input.scope) {
    await assertCanAccessEmployee(record.employeeId, input.scope);
  }

  if (!isSupervisorReturn && record.status !== 'SUPERVISOR_APPROVED') {
    throw new Error('Only supervisor-approved attendance records can be returned by HR');
  }

  const returnedAt = new Date();
  await db
    .update(attendanceDailyRecords)
    .set({
      status: 'RETURNED',
      returnedBy: input.userId,
      returnedAt,
      returnReason: input.reason,
      hrApprovedBy: null,
      hrApprovedAt: null,
      payrollReadyAt: null,
      updatedAt: returnedAt,
    } as any)
    .where(eq(attendanceDailyRecords.id, id));

  return getAttendanceDailyRecordById(id);
}

async function getAttendanceDailyRecordsByEmployeeIds(
  employeeIds: string[],
  attendanceDate: string,
  statuses: AttendanceDailyRecordStatus[],
) {
  return db.query.attendanceDailyRecords.findMany({
    where: and(
      inArray(attendanceDailyRecords.employeeId, employeeIds),
      eq(attendanceDailyRecords.attendanceDate, attendanceDate),
      inArray(attendanceDailyRecords.status, statuses),
    ),
    with: recordRelations,
    orderBy: (table, { asc }) => [asc(table.attendanceDate), asc(table.checkInAt)],
  });
}

async function getAttendanceDailyRecordById(id: string, tx: DbClient = db) {
  return tx.query.attendanceDailyRecords.findFirst({
    where: eq(attendanceDailyRecords.id, id),
    with: recordRelations,
  });
}

async function getDirectReportIds(userId: string, attendanceDate: string, tx: DbClient = db) {
  const supervisor = await tx.query.employees.findFirst({
    where: eq(employees.userId, userId),
    columns: { id: true },
  });

  if (!supervisor) return [];

  const reports = await tx.query.employeeSupervisors.findMany({
    where: and(
      eq(employeeSupervisors.supervisorId, supervisor.id),
      lte(employeeSupervisors.effectiveFrom, attendanceDate),
      or(isNull(employeeSupervisors.effectiveTo), gte(employeeSupervisors.effectiveTo, attendanceDate)),
    ),
    columns: { employeeId: true },
  });

  return reports.map((report: { employeeId: string }) => report.employeeId);
}

async function assertCanSuperviseEmployee(userId: string, employeeId: string, attendanceDate: string, tx: DbClient = db) {
  const directReportIds = await getDirectReportIds(userId, attendanceDate, tx);

  if (!directReportIds.includes(employeeId)) {
    throw new Error('You can only approve attendance for employees you supervise');
  }
}

function normalizeDateParam(date?: string | null) {
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
  return new Date().toISOString().slice(0, 10);
}

function getDayRange(date: string) {
  return {
    start: new Date(`${date}T00:00:00`),
    end: new Date(`${date}T23:59:59.999`),
  };
}

function getAttendanceDays(totalPunches: number) {
  if (totalPunches <= 0) return 0;
  if (totalPunches === 1) return 0.5;
  return 1;
}

function getLeaveDaysForDate(leave: { startDate: string; endDate: string; requestedDays: string }) {
  const durationDays = Math.max(1, daysInclusive(leave.startDate, leave.endDate));
  const requestedDays = Number(leave.requestedDays);

  if (!Number.isFinite(requestedDays) || requestedDays <= 0) return 0;

  return roundDayValue(Math.min(1, requestedDays / durationDays));
}

function resolvePayrollDays(input: { attendanceDays: number; leaveDays: number; unpaidLeaveDays: number; isBiometricExempt: boolean }) {
  const coveredByAttendanceOrLeave = Math.min(1, input.attendanceDays + input.leaveDays);
  const payableDays = input.isBiometricExempt ? Math.max(coveredByAttendanceOrLeave, 1) : coveredByAttendanceOrLeave;
  const absenceDays = Math.max(0, 1 - payableDays);
  const unpaidPayrollDays = Math.min(absenceDays, input.unpaidLeaveDays);
  const uncoveredAbsenceDays = Math.max(0, absenceDays - unpaidPayrollDays);
  const notes = [];

  if (input.attendanceDays === 0.5) notes.push('Half-day attendance from a single punch');
  if (input.leaveDays > 0) notes.push(`Approved leave ${formatDayValue(input.leaveDays)} day(s)`);
  if (unpaidPayrollDays > 0) notes.push(`Approved unpaid leave ${formatDayValue(unpaidPayrollDays)} day(s) for payroll`);
  if (input.isBiometricExempt) notes.push('Biometric exempt');
  if (uncoveredAbsenceDays > 0) notes.push(`Uncovered absence ${formatDayValue(uncoveredAbsenceDays)} day(s)`);

  return {
    payableDays: roundDayValue(payableDays),
    absenceDays: roundDayValue(absenceDays),
    note: notes.length ? notes.join('; ') : null,
  };
}

function isUnpaidLeaveType(leaveType: typeof leaveTypes.$inferSelect | null | undefined) {
  return String(leaveType?.code ?? '').trim().toUpperCase() === 'UNPAID';
}

function daysInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}

function roundDayValue(value: number) {
  return Math.round(value * 100) / 100;
}

function formatDayValue(value: number) {
  return roundDayValue(value).toFixed(2);
}

function parseDayInput(value: string | number, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`${fieldName} must be between 0 and 1`);
  }

  return roundDayValue(parsed);
}

const recordRelations = {
  employee: { with: { department: true, hrUnit: true, position: true } },
  firstPunch: true,
  lastPunch: true,
} as const;
