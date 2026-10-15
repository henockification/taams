import { and, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendanceDailyRecords,
  biometricExemptions,
  employeeWorkSchedules,
  employees,
  ifmisAbsenceAdjustments,
  ifmisExportBatches,
  ifmisExportItems,
  leaveRequests,
} from '../../schema';
import {
  buildIfmisAttendancePreview,
  getGregorianMonthRange,
  type IfmisAbsenceAdjustment,
  type IfmisAttendanceRow,
} from '../../../lib/ifmis/attendance';
import { isEmployeeBiometricExempt } from '../../../lib/biometric-exemptions';
import { getLeaveDaysForDate, isUnpaidLeaveType } from './manageAttendanceApprovals';
import { pushIfmisAttendanceRows } from '../../../lib/ifmis/oracle';
import { writeAuditEvent } from '../../../lib/audit';
import { isPermanentLeaveVerified } from './manageIsmisLeave';

export async function getIfmisAttendancePreview(payMonth: number, payYear: number) {
  const source = await loadSource(payMonth, payYear);
  const preview = buildIfmisAttendancePreview(source, payMonth, payYear);
  const { start, end } = getGregorianMonthRange(payMonth, payYear);
  if (exportsPermanentEmployees(source, preview) && !(await isPermanentLeaveVerified(start, end))) {
    preview.issues.push({ code: 'LEAVE_NOT_VERIFIED', employeeId: '', employeeName: 'Permanent employees', date: null, message: 'Complete the ISMIS permanent-employee leave verification for this payroll period' });
    preview.ready = false;
  }
  const batches = await db.query.ifmisExportBatches.findMany({
    where: and(eq(ifmisExportBatches.payMonth, payMonth), eq(ifmisExportBatches.payYear, payYear)),
    orderBy: (table, { desc }) => [desc(table.createdAt)],
    limit: 10,
  });
  return { ...preview, batches: batches.map(formatBatch) };
}

export async function pushIfmisAttendance(payMonth: number, payYear: number, pushedBy: string) {
  const source = await loadSource(payMonth, payYear);
  const preview = buildIfmisAttendancePreview(source, payMonth, payYear);
  const period = getGregorianMonthRange(payMonth, payYear);
  if (exportsPermanentEmployees(source, preview) && !(await isPermanentLeaveVerified(period.start, period.end))) {
    preview.issues.push({ code: 'LEAVE_NOT_VERIFIED', employeeId: '', employeeName: 'Permanent employees', date: null, message: 'Complete the ISMIS permanent-employee leave verification for this payroll period' });
    preview.ready = false;
  }
  if (!preview.ready) throw new IfmisExportError('The payroll month is not ready for IFMIS', 'NOT_READY', preview.issues);

  let batchId: string | null = null;
  try {
    const batch = await createProcessingBatch(payMonth, payYear, pushedBy, preview.rows);
    batchId = batch.id;
    await pushIfmisAttendanceRows(preview.rows);
    const completedAt = new Date();
    const [completed] = await db.update(ifmisExportBatches).set({
      status: 'SUCCEEDED',
      completedAt,
      errorMessage: null,
      updatedAt: completedAt,
    }).where(eq(ifmisExportBatches.id, batch.id)).returning();
    await writeAuditEvent(db, {
      action: 'IFMIS_PUSHED',
      resourceType: 'ifmis_export_batch',
      resourceId: completed.id,
      resourceLabel: `IFMIS ${payMonth}/${payYear}`,
      metadata: { payMonth, payYear, status: completed.status, rowCount: preview.rows.length },
    });
    return formatBatch(completed);
  } catch (error) {
    if (batchId) {
      const completedAt = new Date();
      await db.update(ifmisExportBatches).set({
        status: 'FAILED',
        completedAt,
        errorMessage: sanitizeIntegrationError(error),
        updatedAt: completedAt,
      }).where(eq(ifmisExportBatches.id, batchId));
    }
    if (error instanceof IfmisExportError) throw error;
    if (isUniqueViolation(error)) throw new IfmisExportError('This payroll month is already exported or currently processing', 'ALREADY_EXPORTED');
    throw new IfmisExportError('IFMIS could not accept the attendance batch. No rows were committed.', 'ORACLE_FAILED');
  }
}

/** Leave verification only matters for permanent employees actually being exported. */
function exportsPermanentEmployees(
  source: Awaited<ReturnType<typeof loadSource>>,
  preview: ReturnType<typeof buildIfmisAttendancePreview>,
) {
  const exportedIds = new Set(preview.rows.map((row) => row.employeeId));
  return source.employees.some((employee: any) => exportedIds.has(employee.id) && employee.employmentType === 'PERMANENT');
}

async function loadSource(payMonth: number, payYear: number) {
  const { start, end } = getGregorianMonthRange(payMonth, payYear);
  const employeeRows = await db.query.employees.findMany({
    where: eq(employees.isActive, true),
    orderBy: (table, { asc }) => [asc(table.firstNameEn), asc(table.lastNameEn)],
  });
  const employeeIds = employeeRows.map((employee) => employee.id);
  if (employeeIds.length === 0) return { employees: [], attendanceRecords: [], scheduleAssignments: [] };

  const [attendanceRecords, scheduleAssignments, exemptions, unpaidLeaves, adjustments] = await Promise.all([
    db.query.attendanceDailyRecords.findMany({
      where: and(
        inArray(attendanceDailyRecords.employeeId, employeeIds),
        gte(attendanceDailyRecords.attendanceDate, start),
        lte(attendanceDailyRecords.attendanceDate, end),
      ),
    }),
    db.query.employeeWorkSchedules.findMany({
      where: and(
        inArray(employeeWorkSchedules.employeeId, employeeIds),
        eq(employeeWorkSchedules.isActive, true),
        lte(employeeWorkSchedules.effectiveFrom, end),
        or(isNull(employeeWorkSchedules.effectiveTo), gte(employeeWorkSchedules.effectiveTo, start)),
      ),
      with: {
        workSchedule: {
          with: {
            days: { with: { shift: { with: { segments: true } } } },
          },
        },
      },
      orderBy: (table, { desc }) => [desc(table.effectiveFrom)],
    }),
    db.query.biometricExemptions.findMany({ where: eq(biometricExemptions.isActive, true) }),
    db.query.leaveRequests.findMany({
      where: and(
        inArray(leaveRequests.employeeId, employeeIds),
        eq(leaveRequests.status, 'AUTHORIZED'),
        lte(leaveRequests.startDate, end),
        gte(leaveRequests.endDate, start),
      ),
      with: { leaveType: true, annualLeaveDates: true },
    }),
    db.query.ifmisAbsenceAdjustments.findMany({
      where: and(eq(ifmisAbsenceAdjustments.payMonth, payMonth), eq(ifmisAbsenceAdjustments.payYear, payYear)),
    }),
  ]);

  // Unpaid leave day values, used for biometric-exempt days (which have no daily record).
  const unpaidLeaveDays = new Map<string, number>();
  for (const leave of unpaidLeaves as any[]) {
    if (!isUnpaidLeaveType(leave.leaveType)) continue;
    for (const date of datesBetween(maxDate(String(leave.startDate), start), minDate(String(leave.endDate), end))) {
      const key = `${leave.employeeId}:${date}`;
      unpaidLeaveDays.set(key, Math.min(1, (unpaidLeaveDays.get(key) ?? 0) + getLeaveDaysForDate(leave, date)));
    }
  }
  const absenceAdjustments = new Map<string, IfmisAbsenceAdjustment>(
    adjustments.map((adjustment) => [adjustment.employeeId, { absentDays: Number(adjustment.absentDays), note: adjustment.note ?? null }]),
  );

  return {
    employees: employeeRows,
    attendanceRecords,
    scheduleAssignments,
    biometricExemptions: exemptions,
    unpaidLeaveDays,
    absenceAdjustments,
  };
}

/**
 * Sets (or with absentDays null, clears) finance's absent-days override for a
 * biometric-exempt employee in a pay month that has not been exported yet.
 */
export async function setIfmisAbsenceAdjustment(input: {
  employeeId: string;
  payMonth: number;
  payYear: number;
  absentDays: number | null;
  note?: string | null;
  updatedBy: string;
}) {
  const { start, end } = getGregorianMonthRange(input.payMonth, input.payYear);
  const exported = await db.query.ifmisExportBatches.findFirst({
    where: and(
      eq(ifmisExportBatches.payMonth, input.payMonth),
      eq(ifmisExportBatches.payYear, input.payYear),
      inArray(ifmisExportBatches.status, ['SUCCEEDED', 'PROCESSING']),
    ),
    columns: { id: true },
  });
  if (exported) throw new IfmisAdjustmentError('This payroll month is already exported or being exported');

  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, input.employeeId),
    columns: { id: true, positionId: true, firstNameEn: true, middleNameEn: true, lastNameEn: true, departmentId: true },
  });
  if (!employee) throw new IfmisAdjustmentError('Employee not found');
  const exemptions = await db.query.biometricExemptions.findMany({ where: eq(biometricExemptions.isActive, true) });
  if (!datesBetween(start, end).some((date) => isEmployeeBiometricExempt(employee, exemptions, date))) {
    throw new IfmisAdjustmentError('Absent days can only be adjusted for biometric-exempt employees');
  }
  if (input.absentDays !== null && (input.absentDays < 0 || input.absentDays > daysInMonth(start, end))) {
    throw new IfmisAdjustmentError('Absent days must be between 0 and the number of days in the month');
  }

  const label = [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
  await db.transaction(async (tx) => {
    if (input.absentDays === null) {
      await tx.delete(ifmisAbsenceAdjustments).where(and(
        eq(ifmisAbsenceAdjustments.employeeId, input.employeeId),
        eq(ifmisAbsenceAdjustments.payMonth, input.payMonth),
        eq(ifmisAbsenceAdjustments.payYear, input.payYear),
      ));
    } else {
      const now = new Date();
      await tx.insert(ifmisAbsenceAdjustments).values({
        employeeId: input.employeeId,
        payMonth: input.payMonth,
        payYear: input.payYear,
        absentDays: String(input.absentDays),
        note: input.note?.trim() || null,
        updatedBy: input.updatedBy,
      }).onConflictDoUpdate({
        target: [ifmisAbsenceAdjustments.employeeId, ifmisAbsenceAdjustments.payYear, ifmisAbsenceAdjustments.payMonth],
        set: { absentDays: String(input.absentDays), note: input.note?.trim() || null, updatedBy: input.updatedBy, updatedAt: now },
      });
    }
    await writeAuditEvent(tx, {
      action: input.absentDays === null ? 'IFMIS_ABSENCE_ADJUSTMENT_CLEARED' : 'IFMIS_ABSENCE_ADJUSTMENT_SET',
      resourceType: 'ifmis_absence_adjustment',
      resourceLabel: `${label} IFMIS ${input.payMonth}/${input.payYear}`,
      employeeId: employee.id,
      departmentId: employee.departmentId,
      metadata: { payMonth: input.payMonth, payYear: input.payYear, absentDays: input.absentDays, note: input.note ?? null },
    });
  });
}

export class IfmisAdjustmentError extends Error {}

function datesBetween(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function daysInMonth(start: string, end: string) {
  return datesBetween(start, end).length;
}

function minDate(left: string, right: string) {
  return left < right ? left : right;
}

function maxDate(left: string, right: string) {
  return left > right ? left : right;
}

async function createProcessingBatch(payMonth: number, payYear: number, pushedBy: string, rows: IfmisAttendanceRow[]) {
  return db.transaction(async (tx) => {
    const staleBefore = new Date(Date.now() - 30 * 60_000);
    await tx.update(ifmisExportBatches).set({
      status: 'FAILED',
      completedAt: new Date(),
      errorMessage: 'Previous export was interrupted',
      updatedAt: new Date(),
    }).where(and(
      eq(ifmisExportBatches.payMonth, payMonth),
      eq(ifmisExportBatches.payYear, payYear),
      eq(ifmisExportBatches.status, 'PROCESSING'),
      lt(ifmisExportBatches.startedAt, staleBefore),
    ));

    const [batch] = await tx.insert(ifmisExportBatches).values({
      payMonth,
      payYear,
      status: 'PROCESSING',
      recordCount: rows.length,
      pushedBy,
    }).returning();
    await tx.insert(ifmisExportItems).values(rows.map((row) => ({
      batchId: batch.id,
      employeeId: row.employeeId,
      payload: row,
    })));
    return batch;
  });
}

export class IfmisExportError extends Error {
  constructor(
    message: string,
    public readonly code: 'NOT_READY' | 'ALREADY_EXPORTED' | 'ORACLE_FAILED',
    public readonly issues: unknown[] = [],
  ) {
    super(message);
  }
}

function formatBatch(batch: any) {
  return {
    id: batch.id,
    payMonth: batch.payMonth,
    payYear: batch.payYear,
    status: batch.status,
    recordCount: batch.recordCount,
    pushedBy: batch.pushedBy,
    startedAt: dateValue(batch.startedAt),
    completedAt: dateValue(batch.completedAt),
    errorMessage: batch.errorMessage ?? null,
  };
}

function dateValue(value: unknown) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function sanitizeIntegrationError(error: unknown) {
  if (error instanceof IfmisExportError) return error.message.slice(0, 500);
  return 'Oracle export failed; no rows were committed';
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505');
}
