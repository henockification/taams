import * as XLSX from 'xlsx';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { attendanceLeaveVerifications, employees, ismisLeaveDays, ismisLeaveImportBatches } from '../../schema';

const HEADERS = {
  id: 'መለያ ቁጥር', name: 'ሙሉ ስም', type: 'ዓይነት', start: 'ከ', end: 'እስከ', days: 'ቀናት',
};

export async function importIsmisLeaveWorkbook(buffer: Buffer, fileName: string, importedBy: string) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false, cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error('Workbook does not contain any worksheets');
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '', raw: false });
  if (!rows.length || !(HEADERS.id in rows[0])) throw new Error(`The workbook must contain the ${HEADERS.id} column`);

  const people = await db.query.employees.findMany({
    where: eq(employees.employmentType, 'PERMANENT'),
    columns: { id: true, employeeCode: true, payrollId: true, biometricId: true, sourceIdNo: true, sourceEmployeeCode: true },
  });
  const byId = new Map<string, typeof people[number]>();
  for (const person of people) {
    for (const value of [person.employeeCode, person.payrollId, person.biometricId, person.sourceIdNo, person.sourceEmployeeCode]) {
      if (value?.trim()) byId.set(normalizeId(value), person);
    }
  }

  const prepared: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    const sourceEmployeeId = normalizeId(read(row, HEADERS.id));
    const start = parseEthiopianDate(read(row, HEADERS.start));
    const end = parseEthiopianDate(read(row, HEADERS.end));
    if (!sourceEmployeeId || !start || !end || start > end) continue;
    const employee = byId.get(sourceEmployeeId);
    for (const attendanceDate of datesInclusive(start, end)) {
      prepared.push({
        sourceEmployeeId,
        employeeId: employee?.id ?? null,
        sourceName: read(row, HEADERS.name) || null,
        sourceLeaveType: read(row, HEADERS.type) || null,
        sourceStartDate: read(row, HEADERS.start),
        sourceEndDate: read(row, HEADERS.end),
        sourceLeaveDays: numericOrNull(read(row, HEADERS.days)),
        attendanceDate,
        matchStatus: employee ? 'MATCHED' : 'UNMATCHED',
        note: employee ? null : 'No permanent employee matched the ISMIS ID',
      });
    }
  }
  const matchedIds = new Set(prepared.filter((row) => row.matchStatus === 'MATCHED').map((row) => row.sourceEmployeeId));
  const unmatchedIds = new Set(prepared.filter((row) => row.matchStatus !== 'MATCHED').map((row) => row.sourceEmployeeId));

  return db.transaction(async (tx) => {
    const [batch] = await tx.insert(ismisLeaveImportBatches).values({
      sourceFileName: fileName,
      importedBy,
      rowCount: rows.length,
      matchedCount: matchedIds.size,
      unmatchedCount: unmatchedIds.size,
    }).returning();
    if (prepared.length) await tx.insert(ismisLeaveDays).values(prepared.map((row) => ({ ...row, batchId: batch.id })) as any).onConflictDoNothing();
    return { ...batch, dayCount: prepared.length, unmatchedEmployeeIds: [...unmatchedIds] };
  });
}

export async function completeIsmisLeaveVerification(batchId: string, dateFrom: string, dateTo: string, checkedBy: string) {
  return db.transaction(async (tx) => {
    const batch = await tx.query.ismisLeaveImportBatches.findFirst({ where: eq(ismisLeaveImportBatches.id, batchId) });
    if (!batch) throw new Error('ISMIS leave import batch not found');
    if (batch.unmatchedCount > 0) throw new Error('Resolve all unmatched permanent employee IDs before completing the leave check');
    await tx.update(ismisLeaveImportBatches).set({ status: 'COMPLETED', completedBy: checkedBy, completedAt: new Date() }).where(eq(ismisLeaveImportBatches.id, batchId));
    const [verification] = await tx.insert(attendanceLeaveVerifications).values({ dateFrom, dateTo, batchId, checkedBy }).returning();
    return verification;
  });
}

export async function getLatestIsmisLeaveImport() {
  return db.query.ismisLeaveImportBatches.findFirst({ orderBy: (table, { desc }) => [desc(table.createdAt)] });
}

export async function isPermanentLeaveVerified(dateFrom: string, dateTo: string) {
  const row = await db.query.attendanceLeaveVerifications.findFirst({
    where: and(lte(attendanceLeaveVerifications.dateFrom, dateFrom), gte(attendanceLeaveVerifications.dateTo, dateTo)),
  });
  return Boolean(row);
}

export async function getExternalLeaveDays(employeeId: string, attendanceDate: string) {
  const row = await db.query.ismisLeaveDays.findFirst({
    where: and(eq(ismisLeaveDays.employeeId, employeeId), eq(ismisLeaveDays.attendanceDate, attendanceDate), sql`EXISTS (SELECT 1 FROM "ismis_leave_import_batches" b WHERE b."id" = ${ismisLeaveDays.batchId} AND b."status" = 'COMPLETED')`),
  });
  return row ? 1 : 0;
}

export function parseEthiopianDate(value: string): string | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]); const month = Number(match[2]); const year = Number(match[3]);
  if (month < 1 || month > 13 || day < 1 || day > (month === 13 ? (((year + 1) % 4 === 0) ? 6 : 5) : 30)) return null;
  const ordinal = (y: number, m: number, d: number) => 365 * (y - 1) + Math.floor(y / 4) + 30 * (m - 1) + d - 1;
  const offset = ordinal(year, month, day) - ordinal(2015, 13, 6);
  const date = new Date(Date.UTC(2023, 8, 11, 12));
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function datesInclusive(start: string, end: string) { const result: string[] = []; const date = new Date(`${start}T12:00:00Z`); const last = new Date(`${end}T12:00:00Z`); while (date <= last) { result.push(date.toISOString().slice(0, 10)); date.setUTCDate(date.getUTCDate() + 1); } return result; }
function read(row: Record<string, unknown>, key: string) { return String(row[key] ?? '').trim(); }
function normalizeId(value: string) { return value.trim().replace(/^'+/, ''); }
function numericOrNull(value: string) { const number = Number(value.replace(/,/g, '')); return Number.isFinite(number) ? String(number) : null; }
