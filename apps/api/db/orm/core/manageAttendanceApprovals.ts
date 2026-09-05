import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendanceDailyRecordAdjustments,
  attendanceDailyRecords,
  attendancePunches,
  biometricExemptions,
  departments,
  employees,
  holidays,
  leaveRequests,
  leaveTypes,
  temporaryDepartmentAssignments,
} from '../../schema';
import { isEmployeeBiometricExempt } from '../../../lib/biometric-exemptions';
import type { AttendanceDailyRecordStatus } from '../../../types/core.types';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageEmployeeVisibility';
import { reconcileAnnualLeaveConsumption } from './manageLeave';
import { syncApprovedOvertimeForDate } from './manageOvertimeRequests';
import {
  getVisibleEmployeeIdsForSupervisorActor,
  resolveSupervisorActionContext,
} from './manageSupervisorDelegations';

type DbClient = typeof db | any;

export type AttendanceApprovalBatchResult = {
  attendanceDailyRecords: any[];
  recordCount: number;
  employeeCount: number;
  dateFrom: string;
  dateTo: string;
};

type ApprovalScope = {
  userId: string;
  date?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  roles?: string[] | null;
  scope?: EmployeeVisibilityScope;
};

const MAX_AUTO_GENERATE_DAYS = 7;
const MAX_REFRESH_GENERATE_DAYS = 31;

export async function generateAttendanceDailyRecords(date?: string | null) {
  const attendanceDate = normalizeDateParam(date);
  if (attendanceDate < new Date().toISOString().slice(0, 10)) {
    await reconcileAnnualLeaveConsumption(attendanceDate);
  }
  const dayRange = getDayRange(attendanceDate);

  const [activeEmployees, punches, approvedLeaves, activeExemptions, activeHoliday] = await Promise.all([
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
        eq(leaveRequests.status, 'AUTHORIZED'),
        lte(leaveRequests.startDate, attendanceDate),
        gte(leaveRequests.endDate, attendanceDate),
      ),
      with: {
        leaveType: true,
        annualLeaveDates: true,
      },
    }),
    db.query.biometricExemptions.findMany({
      where: eq(biometricExemptions.isActive, true),
    }),
    db.query.holidays.findFirst({
      where: and(
        eq(holidays.isActive, true),
        lte(holidays.startDate, attendanceDate),
        gte(holidays.endDate, attendanceDate),
      ),
      orderBy: (table, { asc }) => [asc(table.startDate), asc(table.nameEn)],
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
    const leaveDays = getLeaveDaysForDate(leave, attendanceDate);
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
    const holidayDays = activeHoliday ? parseHolidayDays(activeHoliday.durationDays) : 0;
    const payroll = resolvePayrollDays({
      attendanceDays,
      leaveDays,
      unpaidLeaveDays,
      holidayDays,
      holidayName: activeHoliday?.nameEn ?? null,
      isBiometricExempt,
    });

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
        holidayId: activeHoliday?.id ?? null,
        holidayDays: formatDayValue(holidayDays),
        isHoliday: Boolean(activeHoliday),
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
          holidayId: activeHoliday?.id ?? null,
          holidayDays: formatDayValue(holidayDays),
          isHoliday: Boolean(activeHoliday),
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
      records.push(record);
    }
  }

  await syncApprovedOvertimeForDate(attendanceDate);

  return (await Promise.all(
    records.map((record) => getAttendanceDailyRecordById(record.id)),
  )).filter(Boolean);
}

export async function generateAttendanceDailyRecordsInRange(dateFrom?: string | null, dateTo?: string | null) {
  const range = resolveAttendanceDateRange({ dateFrom, dateTo });
  const days = listDatesInclusive(range.dateFrom, clipDateToToday(range.dateTo));
  if (days.length === 0) return generateAttendanceDailyRecords(clipDateToToday(range.dateTo));
  if (days.length > MAX_REFRESH_GENERATE_DAYS) {
    return generateAttendanceDailyRecords(days[days.length - 1]);
  }

  let generated: any[] = [];
  for (const day of days) {
    generated = await generateAttendanceDailyRecords(day);
  }
  return generated;
}

export async function getSupervisorAttendanceDailyRecords(input: ApprovalScope) {
  const range = resolveAttendanceDateRange(input);
  await maybeGenerateAttendanceDailyRecordsForRange(range);

  const referenceDate = clipDateToToday(range.dateTo);
  const dateFilter = attendanceDateFilter(range.dateFrom, range.dateTo);

  if (input.scope?.type === 'unrestricted') {
    const records = await db.query.attendanceDailyRecords.findMany({
      where: and(
        dateFilter,
        inArray(attendanceDailyRecords.status, [
          'PENDING_SUPERVISOR',
          'RETURNED',
          'SUPERVISOR_APPROVED',
        ]),
      ),
      with: recordRelations,
      orderBy: (table, { asc }) => [asc(table.attendanceDate), asc(table.checkInAt)],
    });
    return attachEffectiveDepartmentContext(records, referenceDate);
  }

  const directReportIds = await getVisibleEmployeeIdsForSupervisorActor(input.userId, input.roles, db, referenceDate);

  if (directReportIds.length === 0) return [];

  return getAttendanceDailyRecordsByEmployeeIds(directReportIds, range.dateFrom, range.dateTo, [
    'PENDING_SUPERVISOR',
    'RETURNED',
    'SUPERVISOR_APPROVED',
  ]);
}

export async function refreshAttendanceForAuthorizedLeave(request: any) {
  const records = await db.query.attendanceDailyRecords.findMany({
    where: and(
      eq(attendanceDailyRecords.employeeId, request.employeeId),
      gte(attendanceDailyRecords.attendanceDate, request.startDate),
      lte(attendanceDailyRecords.attendanceDate, request.endDate),
      ne(attendanceDailyRecords.status, 'HR_APPROVED'),
    ),
    columns: { attendanceDate: true },
  });
  for (const record of records) await generateAttendanceDailyRecords(record.attendanceDate);
}

export async function getHrAttendanceDailyRecords(
  date?: string | null,
  scope?: EmployeeVisibilityScope,
  rangeInput?: { dateFrom?: string | null; dateTo?: string | null },
) {
  const range = resolveAttendanceDateRange({ date, ...rangeInput });
  await maybeGenerateAttendanceDailyRecordsForRange(range);

  const records = await db.query.attendanceDailyRecords.findMany({
    where: and(
      attendanceDateFilter(range.dateFrom, range.dateTo),
      eq(attendanceDailyRecords.status, 'SUPERVISOR_APPROVED'),
    ),
    with: recordRelations,
    orderBy: (table, { asc }) => [asc(table.attendanceDate), asc(table.checkInAt)],
  });

  const enriched = await attachEffectiveDepartmentContext(records, clipDateToToday(range.dateTo));
  if (!scope || scope.type === 'unrestricted' || scope.type === 'hr') return enriched;
  return enriched.filter((record) => record.employee?.userId === scope.userId);
}

export async function supervisorApproveAttendanceDailyRecord(id: string, input: { userId: string; roles?: string[] | null; scope?: EmployeeVisibilityScope }) {
  const result = await supervisorApproveAttendanceDailyRecords([id], input);
  return result.attendanceDailyRecords[0];
}

export async function supervisorApproveAttendanceDailyRecords(
  ids: string[],
  input: { userId: string; roles?: string[] | null; scope?: EmployeeVisibilityScope },
): Promise<AttendanceApprovalBatchResult> {
  const recordIds = uniqueRecordIds(ids);
  return db.transaction(async (tx) => {
    const records = await getAttendanceDailyRecordsByIds(recordIds, tx);
    if (records.length !== recordIds.length) throw new Error('Attendance daily record not found');
    const approvalContexts = [];
    for (const record of records) {
      if (record.status !== 'PENDING_SUPERVISOR' && record.status !== 'RETURNED') {
        throw new Error('Only pending or returned attendance records can be supervisor approved');
      }
      approvalContexts.push(input.scope?.type === 'unrestricted'
        ? { supervisorDelegationId: null }
        : await resolveSupervisorActionContext({
          actorUserId: input.userId,
          roles: input.roles,
          targetEmployeeId: record.employeeId,
          referenceDate: record.attendanceDate,
          tx,
        }));
    }

    const approvedAt = new Date();
    for (let index = 0; index < records.length; index += 1) {
      const [updated] = await tx.update(attendanceDailyRecords).set({
        status: 'SUPERVISOR_APPROVED',
        supervisorApprovedBy: input.userId,
        supervisorApprovedAt: approvedAt,
        supervisorDelegationId: approvalContexts[index].supervisorDelegationId,
        hrApprovedBy: null,
        hrApprovedAt: null,
        returnedBy: null,
        returnedAt: null,
        returnReason: null,
        payrollReadyAt: null,
        updatedAt: approvedAt,
      } as any).where(and(
        eq(attendanceDailyRecords.id, records[index].id),
        inArray(attendanceDailyRecords.status, ['PENDING_SUPERVISOR', 'RETURNED']),
      )).returning({ id: attendanceDailyRecords.id });
      if (!updated) throw new Error('Attendance record was already processed');
    }

    const updatedRecords = await getAttendanceDailyRecordsByIds(recordIds, tx);
    return buildAttendanceApprovalBatch(updatedRecords);
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
    roles?: string[] | null;
  },
) {
  return db.transaction(async (tx) => {
    const record = await getAttendanceDailyRecordById(id, tx);
    if (!record) throw new Error('Attendance daily record not found');

    const actionContext = input.scope?.type === 'unrestricted'
      ? { supervisorDelegationId: null }
      : await resolveSupervisorActionContext({
        actorUserId: input.userId,
        roles: input.roles,
        targetEmployeeId: record.employeeId,
        referenceDate: record.attendanceDate,
        tx,
      });

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
        supervisorDelegationId: actionContext.supervisorDelegationId,
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
  const result = await hrApproveAttendanceDailyRecords([id], input);
  return result.attendanceDailyRecords[0];
}

export async function hrApproveAttendanceDailyRecords(
  ids: string[],
  input: { userId: string; scope?: EmployeeVisibilityScope },
): Promise<AttendanceApprovalBatchResult> {
  const recordIds = uniqueRecordIds(ids);
  return db.transaction(async (tx) => {
    const records = await getAttendanceDailyRecordsByIds(recordIds, tx);
    if (records.length !== recordIds.length) throw new Error('Attendance daily record not found');
    for (const record of records) {
      if (input.scope) await assertCanAccessEmployee(record.employeeId, input.scope, tx);
      if (record.status !== 'SUPERVISOR_APPROVED') {
        throw new Error('Only supervisor-approved attendance records can be HR approved');
      }
    }

    const approvedAt = new Date();
    const updated = await tx.update(attendanceDailyRecords).set({
      status: 'HR_APPROVED',
      hrApprovedBy: input.userId,
      hrApprovedAt: approvedAt,
      payrollReadyAt: approvedAt,
      returnedBy: null,
      returnedAt: null,
      returnReason: null,
      updatedAt: approvedAt,
    } as any).where(and(
      inArray(attendanceDailyRecords.id, recordIds),
      eq(attendanceDailyRecords.status, 'SUPERVISOR_APPROVED'),
    )).returning({ id: attendanceDailyRecords.id });
    if (updated.length !== recordIds.length) throw new Error('One or more attendance records were already processed');

    const updatedRecords = await getAttendanceDailyRecordsByIds(recordIds, tx);
    return buildAttendanceApprovalBatch(updatedRecords);
  });
}

export async function returnAttendanceDailyRecord(id: string, input: { userId: string; roles?: string[] | null; reason: string; canHrReturn?: boolean; scope?: EmployeeVisibilityScope }) {
  const record = await getAttendanceDailyRecordById(id);
  if (!record) throw new Error('Attendance daily record not found');

  if (record.status === 'HR_APPROVED') {
    throw new Error('Payroll-ready attendance records cannot be returned');
  }

  const directReportIds = await getVisibleEmployeeIdsForSupervisorActor(input.userId, input.roles, db, record.attendanceDate);
  const isSupervisorReturn = directReportIds.includes(record.employeeId);
  const supervisorActionContext = isSupervisorReturn
    ? await resolveSupervisorActionContext({
      actorUserId: input.userId,
      roles: input.roles,
      targetEmployeeId: record.employeeId,
      referenceDate: record.attendanceDate,
    })
    : { supervisorDelegationId: null };

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
      supervisorDelegationId: supervisorActionContext.supervisorDelegationId,
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
  dateFrom: string,
  dateTo: string,
  statuses: AttendanceDailyRecordStatus[],
) {
  const records = await db.query.attendanceDailyRecords.findMany({
    where: and(
      inArray(attendanceDailyRecords.employeeId, employeeIds),
      attendanceDateFilter(dateFrom, dateTo),
      inArray(attendanceDailyRecords.status, statuses),
    ),
    with: recordRelations,
    orderBy: (table, { asc }) => [asc(table.attendanceDate), asc(table.checkInAt)],
  });
  return attachEffectiveDepartmentContext(records, clipDateToToday(dateTo));
}

async function getAttendanceDailyRecordById(id: string, tx: DbClient = db) {
  const record = await tx.query.attendanceDailyRecords.findFirst({
    where: eq(attendanceDailyRecords.id, id),
    with: recordRelations,
  });
  if (!record) return record;
  return (await attachEffectiveDepartmentContext([record], record.attendanceDate, tx))[0] ?? record;
}

async function getAttendanceDailyRecordsByIds(ids: string[], tx: DbClient = db) {
  if (ids.length === 0) return [];
  const records = await tx.query.attendanceDailyRecords.findMany({
    where: inArray(attendanceDailyRecords.id, ids),
    with: recordRelations,
  });
  const enriched = await attachEffectiveDepartmentContext(records, undefined, tx);
  const recordById = new Map(enriched.map((record: any) => [record.id, record]));
  return ids.map((id) => recordById.get(id)).filter(Boolean);
}

function uniqueRecordIds(ids: string[]) {
  const recordIds = [...new Set(ids.filter(Boolean))];
  if (recordIds.length === 0) throw new Error('At least one attendance daily record is required');
  if (recordIds.length > 5000) throw new Error('A maximum of 5000 attendance daily records can be approved at once');
  return recordIds;
}

export function buildAttendanceApprovalBatch(records: any[]): AttendanceApprovalBatchResult {
  if (records.length === 0) throw new Error('At least one attendance daily record is required');
  const dates = records.map((record) => formatDateValue(record.attendanceDate)).sort();
  return {
    attendanceDailyRecords: records,
    recordCount: records.length,
    employeeCount: new Set(records.map((record) => record.employeeId)).size,
    dateFrom: dates[0],
    dateTo: dates[dates.length - 1],
  };
}

async function attachEffectiveDepartmentContext(records: any[], attendanceDate?: string, tx: DbClient = db) {
  if (records.length === 0) return records;
  const employeeIds = [...new Set(records.map((record) => record.employeeId).filter(Boolean))];
  const recordDates = records.map((record) => record.attendanceDate).filter(Boolean) as string[];
  const dateFrom = recordDates.length > 0
    ? recordDates.reduce((min, date) => (date < min ? date : min))
    : attendanceDate;
  const dateTo = recordDates.length > 0
    ? recordDates.reduce((max, date) => (date > max ? date : max))
    : attendanceDate;
  const activeAssignments = employeeIds.length > 0 && dateFrom && dateTo
    ? await tx.query.temporaryDepartmentAssignments.findMany({
      where: and(
        inArray(temporaryDepartmentAssignments.employeeId, employeeIds),
        eq(temporaryDepartmentAssignments.isActive, true),
        lte(temporaryDepartmentAssignments.effectiveFrom, dateTo),
        gte(temporaryDepartmentAssignments.effectiveTo, dateFrom),
      ),
      with: {
        employee: { with: { department: true, position: true } },
        sourceDepartment: true,
        targetDepartment: true,
        creator: true,
      },
    })
    : [];
  const assignmentsByEmployee = new Map<string, any[]>();
  for (const assignment of activeAssignments as any[]) {
    const current = assignmentsByEmployee.get(assignment.employeeId) ?? [];
    current.push(assignment);
    assignmentsByEmployee.set(assignment.employeeId, current);
  }
  const assignmentForRecord = (record: any) => {
    const matches = (assignmentsByEmployee.get(record.employeeId) ?? []).filter((assignment) => (
      assignment.effectiveFrom <= record.attendanceDate
      && assignment.effectiveTo >= record.attendanceDate
    ));
    if (matches.length === 0) return null;
    return [...matches].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];
  };
  const effectiveDepartmentIds = [...new Set(records.map((record) => {
    const assignment = assignmentForRecord(record);
    return assignment?.targetDepartmentId ?? record.employee?.departmentId ?? null;
  }).filter(Boolean))] as string[];
  const effectiveDepartments = effectiveDepartmentIds.length > 0
    ? await tx.query.departments.findMany({
      where: inArray(departments.id, effectiveDepartmentIds),
    })
    : [];
  const departmentById = new Map(effectiveDepartments.map((department: any) => [department.id, department]));

  return records.map((record) => {
    const assignment = assignmentForRecord(record);
    const effectiveDepartmentId = assignment?.targetDepartmentId ?? record.employee?.departmentId ?? null;
    return {
      ...record,
      temporaryDepartmentAssignment: assignment,
      effectiveDepartment: effectiveDepartmentId ? departmentById.get(effectiveDepartmentId) ?? record.employee?.department ?? null : null,
    };
  });
}

function isYmd(value?: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function normalizeDateParam(date?: string | null) {
  if (isYmd(date)) return date;
  return new Date().toISOString().slice(0, 10);
}

function resolveAttendanceDateRange(input: { date?: string | null; dateFrom?: string | null; dateTo?: string | null }) {
  const fallback = normalizeDateParam(input.date);
  const dateFrom = isYmd(input.dateFrom) ? input.dateFrom : fallback;
  const dateTo = isYmd(input.dateTo) ? input.dateTo : (isYmd(input.dateFrom) ? input.dateFrom : fallback);
  return dateFrom <= dateTo ? { dateFrom, dateTo } : { dateFrom: dateTo, dateTo: dateFrom };
}

function clipDateToToday(date: string) {
  const today = new Date().toISOString().slice(0, 10);
  return date < today ? date : today;
}

function listDatesInclusive(dateFrom: string, dateTo: string) {
  if (dateFrom > dateTo) return [];
  const dates: string[] = [];
  const cursor = new Date(`${dateFrom}T00:00:00`);
  const end = new Date(`${dateTo}T00:00:00`);
  while (cursor <= end) {
    const year = cursor.getFullYear();
    const month = String(cursor.getMonth() + 1).padStart(2, '0');
    const day = String(cursor.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function attendanceDateFilter(dateFrom: string, dateTo: string) {
  if (dateFrom === dateTo) return eq(attendanceDailyRecords.attendanceDate, dateFrom);
  return and(
    gte(attendanceDailyRecords.attendanceDate, dateFrom),
    lte(attendanceDailyRecords.attendanceDate, dateTo),
  );
}

async function maybeGenerateAttendanceDailyRecordsForRange(range: { dateFrom: string; dateTo: string }) {
  const days = listDatesInclusive(range.dateFrom, clipDateToToday(range.dateTo));
  if (days.length === 0 || days.length > MAX_AUTO_GENERATE_DAYS) return;
  for (const day of days) {
    await generateAttendanceDailyRecords(day);
  }
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

function getLeaveDaysForDate(leave: { startDate: string; endDate: string; requestedDays: string; leaveType?: any; annualLeaveDates?: any[] }, attendanceDate: string) {
  if (isAnnualLeaveType(leave.leaveType) && leave.annualLeaveDates?.length) {
    const approvedDate = leave.annualLeaveDates.find((date) => (
      formatDateValue(date.leaveDate) === attendanceDate
      && date.status === 'APPROVED'
      && ['SCHEDULED', 'CONSUMED'].includes(date.utilizationStatus ?? 'SCHEDULED')
    ));
    const approvedDays = Number(approvedDate?.approvedDayValue ?? 0);
    return Number.isFinite(approvedDays) ? roundDayValue(Math.min(1, approvedDays)) : 0;
  }

  const durationDays = Math.max(1, daysInclusive(leave.startDate, leave.endDate));
  const requestedDays = Number(leave.requestedDays);

  if (!Number.isFinite(requestedDays) || requestedDays <= 0) return 0;

  return roundDayValue(Math.min(1, requestedDays / durationDays));
}

function resolvePayrollDays(input: {
  attendanceDays: number;
  leaveDays: number;
  unpaidLeaveDays: number;
  holidayDays: number;
  holidayName?: string | null;
  isBiometricExempt: boolean;
}) {
  const coveredByAttendanceOrLeave = Math.min(1, input.attendanceDays + input.leaveDays);
  const coveredByAttendanceLeaveOrHoliday = Math.min(1, coveredByAttendanceOrLeave + input.holidayDays);
  const coveredByHoliday = input.holidayDays > 0;
  const payableDays = input.isBiometricExempt ? Math.max(coveredByAttendanceLeaveOrHoliday, 1) : coveredByAttendanceLeaveOrHoliday;
  const absenceDays = Math.max(0, 1 - payableDays);
  const unpaidPayrollDays = Math.min(absenceDays, input.unpaidLeaveDays);
  const uncoveredAbsenceDays = Math.max(0, absenceDays - unpaidPayrollDays);
  const notes = [];

  if (input.attendanceDays === 0.5) notes.push('Half-day attendance from a single punch');
  if (input.leaveDays > 0) notes.push(`Approved leave ${formatDayValue(input.leaveDays)} day(s)`);
  if (coveredByHoliday) notes.push(`Holiday/off day ${formatDayValue(input.holidayDays)} day(s): ${input.holidayName ?? 'Institution off day'}`);
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

function isAnnualLeaveType(leaveType: typeof leaveTypes.$inferSelect | null | undefined) {
  return String(leaveType?.code ?? '').trim().toUpperCase() === 'ANNUAL';
}

function formatDateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
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

function parseHolidayDays(value: string | number | null | undefined) {
  const parsed = Number(value ?? 1);
  return parsed === 0.5 ? 0.5 : 1;
}

const recordRelations = {
  employee: { with: { department: true, position: true } },
  firstPunch: true,
  lastPunch: true,
  holiday: true,
} as const;
