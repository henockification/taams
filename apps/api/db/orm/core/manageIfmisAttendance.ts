import { and, eq, gte, inArray, isNull, lt, lte, or } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendanceDailyRecords,
  employeeWorkSchedules,
  employees,
  ifmisExportBatches,
  ifmisExportItems,
} from '../../schema';
import { buildIfmisAttendancePreview, getGregorianMonthRange, type IfmisAttendanceRow } from '../../../lib/ifmis/attendance';
import { pushIfmisAttendanceRows } from '../../../lib/ifmis/oracle';
import { writeAuditEvent } from '../../../lib/audit';

export async function getIfmisAttendancePreview(payMonth: number, payYear: number) {
  const source = await loadSource(payMonth, payYear);
  const preview = buildIfmisAttendancePreview(source, payMonth, payYear);
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

async function loadSource(payMonth: number, payYear: number) {
  const { start, end } = getGregorianMonthRange(payMonth, payYear);
  const employeeRows = await db.query.employees.findMany({
    where: eq(employees.isActive, true),
    orderBy: (table, { asc }) => [asc(table.firstNameEn), asc(table.lastNameEn)],
  });
  const employeeIds = employeeRows.map((employee) => employee.id);
  if (employeeIds.length === 0) return { employees: [], attendanceRecords: [], scheduleAssignments: [] };

  const [attendanceRecords, scheduleAssignments] = await Promise.all([
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
  ]);
  return { employees: employeeRows, attendanceRecords, scheduleAssignments };
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
