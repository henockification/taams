import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendanceDailyRecords,
  attendancePunches,
  employees,
  overtimeRequests,
  user,
} from '../../schema';
import type {
  ChangeOvertimeRequestStatusInput,
  CreateOvertimeRequestInput,
  OvertimeAttendanceCoverage,
  OvertimeAttendanceEvidence,
} from '../../../types/core.types';
import type { EmployeeVisibilityScope } from './manageEmployeeVisibility';
import {
  getVisibleEmployeeIdsForSupervisorActor,
  resolveSupervisorActionContext,
} from './manageSupervisorDelegations';

type DbClient = typeof db | any;
const HR_ROLE_NAMES = ['human_resource'];
const OVERTIME_NOTE_PREFIX = 'Approved overtime ';

export async function createOvertimeRequests(
  input: CreateOvertimeRequestInput,
  context: { scope?: EmployeeVisibilityScope; requestedBy: string; roles?: string[] | null },
) {
  if (!context.requestedBy) throw new Error('requestedBy is required');
  await assertUserExists(context.requestedBy);

  const employeeIds = uniqueIds(input.employeeIds?.length ? input.employeeIds : input.employeeId ? [input.employeeId] : []);
  if (employeeIds.length === 0) throw new Error('employeeIds is required');

  const { startAt, endAt, overtimeDate } = resolveOvertimeWindow(input.overtimeDate, input.startAt, input.endAt);
  const requestedMinutes = Math.max(0, Math.floor((endAt.getTime() - startAt.getTime()) / 60_000));
  if (requestedMinutes <= 0) throw new Error('Overtime duration must be greater than zero');

  const actorEmployee = await db.query.employees.findFirst({
    where: eq(employees.userId, context.requestedBy),
    columns: { id: true },
  });

  for (const employeeId of employeeIds) {
    await assertEmployeeExists(employeeId);
    if (actorEmployee?.id === employeeId) throw new Error('Cannot assign overtime to yourself');
    await resolveSupervisorActionContext({
      actorUserId: context.requestedBy,
      roles: context.roles,
      targetEmployeeId: employeeId,
    });
  }

  const inserted = await db.transaction(async (tx) => {
    const rows = [];
    for (const employeeId of employeeIds) {
      const actionContext = await resolveSupervisorActionContext({
        actorUserId: context.requestedBy,
        roles: context.roles,
        targetEmployeeId: employeeId,
        tx,
      });
      const attendanceDailyRecord = await findAttendanceDailyRecord(employeeId, overtimeDate, tx);
      const [request] = await tx
        .insert(overtimeRequests)
        .values({
          employeeId,
          attendanceDailyRecordId: attendanceDailyRecord?.id ?? null,
          overtimeDate,
          startAt,
          endAt,
          requestedMinutes,
          reason: input.reason,
          status: 'ASSIGNED',
          requestedBy: context.requestedBy,
          requestedSupervisorDelegationId: actionContext.supervisorDelegationId,
        } as any)
        .returning();
      rows.push(request);
    }
    return rows;
  });

  const created = await db.query.overtimeRequests.findMany({
    where: inArray(overtimeRequests.id, inserted.map((row) => row.id)),
    with: {
      employee: { with: { department: true, position: true } },
      attendanceDailyRecord: true,
    },
  });

  return attachAttendanceEvidence(created);
}

export async function getOvertimeRequests(input: {
  scope?: EmployeeVisibilityScope;
  userId?: string;
  roles?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string | null;
  mine?: boolean;
}) {
  const requests = await db.query.overtimeRequests.findMany({
    where: and(
      input.dateFrom ? gte(overtimeRequests.overtimeDate, input.dateFrom) : undefined,
      input.dateTo ? lte(overtimeRequests.overtimeDate, input.dateTo) : undefined,
      input.status ? eq(overtimeRequests.status, input.status) : undefined,
    ),
    with: {
      employee: { with: { department: true, position: true } },
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (input.mine) {
    return attachAttendanceEvidence(requests.filter((request) => request.employee?.userId === input.userId));
  }

  const roles = (input.roles ?? []).map((role) => role.toLowerCase());
  const isHrRole = roles.some((role) => HR_ROLE_NAMES.includes(role));
  const visible = !input.scope || input.scope.type === 'unrestricted' || isHrRole
    ? requests
    : await filterVisibleOvertimeRequests(requests, input.userId, input.roles);

  return attachAttendanceEvidence(visible);
}

export async function changeOvertimeRequestStatus(
  id: string,
  input: ChangeOvertimeRequestStatusInput,
  context: { scope?: EmployeeVisibilityScope; reviewerUserId: string; roles?: string[] | null },
) {
  const updated = await db.transaction(async (tx) => {
    const request = await getOvertimeRequestById(id, tx);
    if (!request) throw new Error('Overtime request not found');
    if (request.status !== 'ASSIGNED' && request.status !== 'PENDING') {
      throw new Error('Overtime assignment is already processed');
    }

    const actionContext = await resolveSupervisorActionContext({
      actorUserId: context.reviewerUserId,
      roles: context.roles,
      targetEmployeeId: request.employeeId,
      tx,
    });

    if (input.status === 'APPROVED') {
      const dailyRecord = await findAttendanceDailyRecord(request.employeeId, request.overtimeDate, tx);
      if (dailyRecord?.status === 'HR_APPROVED') {
        throw new Error('Cannot approve overtime for a payroll-ready attendance day; use the attendance adjustment workflow');
      }

      const approvedMinutes = input.approvedMinutes ?? request.requestedMinutes;
      if (approvedMinutes <= 0) throw new Error('Approved overtime minutes must be greater than zero');
      if (approvedMinutes > request.requestedMinutes) throw new Error('Approved overtime cannot exceed assigned overtime');

      const overtimeDays = input.overtimeDays ?? minutesToOvertimeDays(approvedMinutes);
      if (overtimeDays < 0) throw new Error('Overtime days must be non-negative');

      const approvedAt = input.approvedAt ? new Date(input.approvedAt) : new Date();
      const payrollNote = input.payrollNote?.trim() || overtimePayrollNote(approvedMinutes, overtimeDays);

      await tx
        .update(overtimeRequests)
        .set({
          status: 'APPROVED',
          approvedBy: context.reviewerUserId,
          approvedAt,
          supervisorDelegationId: actionContext.supervisorDelegationId,
          approvedMinutes,
          overtimeDays: formatDayValue(overtimeDays),
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          payrollNote,
          updatedAt: new Date(),
        })
        .where(eq(overtimeRequests.id, id));

      await syncApprovedOvertimeToDailyRecord(request.employeeId, request.overtimeDate, tx);
      return getOvertimeRequestById(id, tx);
    }

    const rejectedAt = input.rejectedAt ? new Date(input.rejectedAt) : new Date();
    await tx
      .update(overtimeRequests)
      .set({
        status: 'REJECTED',
        approvedBy: null,
        approvedAt: null,
        approvedMinutes: 0,
        overtimeDays: '0.00',
        rejectedBy: context.reviewerUserId,
        rejectedAt,
        rejectionReason: input.rejectionReason?.trim() || null,
        supervisorDelegationId: actionContext.supervisorDelegationId,
        updatedAt: new Date(),
      })
      .where(eq(overtimeRequests.id, id));

    await syncApprovedOvertimeToDailyRecord(request.employeeId, request.overtimeDate, tx);
    return getOvertimeRequestById(id, tx);
  });

  if (updated?.status === 'APPROVED') {
    const dailyRecord = await findAttendanceDailyRecord(updated.employeeId, updated.overtimeDate);
    if (!dailyRecord) {
      const { generateAttendanceDailyRecords } = await import('./manageAttendanceApprovals');
      await generateAttendanceDailyRecords(updated.overtimeDate);
    }
  }

  const [withEvidence] = await attachAttendanceEvidence(updated ? [updated] : []);
  return withEvidence ?? updated;
}

export async function getOvertimeRequestById(id: string, tx: DbClient = db) {
  return tx.query.overtimeRequests.findFirst({
    where: eq(overtimeRequests.id, id),
    with: {
      employee: { with: { department: true, position: true } },
      attendanceDailyRecord: true,
    },
  });
}

export async function syncApprovedOvertimeForDate(overtimeDate: string, tx: DbClient = db) {
  const rows = await tx
    .selectDistinct({ employeeId: overtimeRequests.employeeId })
    .from(overtimeRequests)
    .where(and(
      eq(overtimeRequests.overtimeDate, overtimeDate),
      eq(overtimeRequests.status, 'APPROVED'),
    ));

  for (const row of rows) {
    await syncApprovedOvertimeToDailyRecord(row.employeeId, overtimeDate, tx);
  }
}

export async function syncApprovedOvertimeToDailyRecord(employeeId: string, overtimeDate: string, tx: DbClient = db) {
  const dailyRecord = await findAttendanceDailyRecord(employeeId, overtimeDate, tx);
  if (!dailyRecord) return;
  if (dailyRecord.status === 'HR_APPROVED') return;

  const totals = await tx
    .select({
      minutes: sql<number>`coalesce(sum(${overtimeRequests.approvedMinutes}), 0)`,
      days: sql<string>`coalesce(sum(${overtimeRequests.overtimeDays}), 0)`,
    })
    .from(overtimeRequests)
    .where(and(
      eq(overtimeRequests.employeeId, employeeId),
      eq(overtimeRequests.overtimeDate, overtimeDate),
      eq(overtimeRequests.status, 'APPROVED'),
    ));

  const minutes = Number(totals[0]?.minutes ?? 0);
  const days = Number(totals[0]?.days ?? 0);
  const hours = minutes / 60;
  const note = minutes > 0 ? overtimePayrollNote(minutes, days) : null;

  await tx
    .update(attendanceDailyRecords)
    .set({
      overtimeMinutes: minutes,
      overtimeHours: formatDayValue(hours),
      overtimeDays: formatDayValue(days),
      payrollNote: mergePayrollNote(dailyRecord.payrollNote, note),
      updatedAt: new Date(),
    })
    .where(and(
      eq(attendanceDailyRecords.employeeId, employeeId),
      eq(attendanceDailyRecords.attendanceDate, overtimeDate),
    ));
}

async function attachAttendanceEvidence<T extends {
  employeeId: string;
  overtimeDate: string;
  startAt: Date | string;
  endAt: Date | string;
  requestedMinutes: number;
}>(requests: T[]): Promise<Array<T & { attendanceEvidence: OvertimeAttendanceEvidence }>> {
  if (requests.length === 0) return [];

  const employeeIds = uniqueIds(requests.map((request) => request.employeeId));
  const rangeStart = earliestDayStart(requests.map((request) => asDate(request.startAt)));
  const rangeEnd = latestDayEnd(requests.map((request) => asDate(request.endAt)));

  const punches = employeeIds.length === 0
    ? []
    : await db.query.attendancePunches.findMany({
      where: and(
        inArray(attendancePunches.employeeId, employeeIds),
        gte(attendancePunches.punchTime, rangeStart),
        lte(attendancePunches.punchTime, rangeEnd),
      ),
      columns: {
        id: true,
        employeeId: true,
        punchTime: true,
        punchType: true,
        source: true,
      },
      orderBy: (table, { asc }) => [asc(table.employeeId), asc(table.punchTime)],
    });

  const punchesByEmployee = new Map<string, typeof punches>();
  for (const punch of punches) {
    if (!punch.employeeId) continue;
    punchesByEmployee.set(punch.employeeId, [...(punchesByEmployee.get(punch.employeeId) ?? []), punch]);
  }

  const today = new Date().toISOString().slice(0, 10);
  return requests.map((request) => ({
    ...request,
    attendanceEvidence: computeAttendanceEvidence(request, punchesByEmployee.get(request.employeeId) ?? [], today),
  }));
}

function computeAttendanceEvidence(
  request: { overtimeDate: string; startAt: Date | string; endAt: Date | string; requestedMinutes: number },
  punches: Array<{ id: string; punchTime: Date | string; punchType: string; source: string }>,
  today: string,
): OvertimeAttendanceEvidence {
  const startAt = asDate(request.startAt);
  const endAt = asDate(request.endAt);
  const windowStart = startOfDay(startAt);
  const windowEnd = endOfDay(endAt);
  const relevantPunches = punches.filter((punch) => {
    const punchTime = asDate(punch.punchTime);
    return punchTime >= windowStart && punchTime <= windowEnd;
  });
  const firstPunch = relevantPunches[0] ?? null;
  const lastPunch = relevantPunches.length > 1 ? relevantPunches[relevantPunches.length - 1] : null;
  const overlapMinutes = firstPunch && lastPunch
    ? overlapMinutesBetween(startAt, endAt, asDate(firstPunch.punchTime), asDate(lastPunch.punchTime))
    : 0;

  let coverage: OvertimeAttendanceCoverage = 'NONE';
  if (request.overtimeDate > today) coverage = 'UPCOMING';
  else if (overlapMinutes >= request.requestedMinutes) coverage = 'COVERED';
  else if (overlapMinutes > 0) coverage = 'PARTIAL';

  return {
    coverage,
    assignedMinutes: request.requestedMinutes,
    overlapMinutes,
    checkInAt: firstPunch ? asDate(firstPunch.punchTime).toISOString() : null,
    checkOutAt: lastPunch ? asDate(lastPunch.punchTime).toISOString() : null,
    punches: relevantPunches.map((punch) => ({
      id: punch.id,
      punchTime: asDate(punch.punchTime).toISOString(),
      punchType: punch.punchType,
      source: punch.source,
    })),
  };
}

function overlapMinutesBetween(assignedStart: Date, assignedEnd: Date, presenceStart: Date, presenceEnd: Date) {
  const overlapStart = Math.max(assignedStart.getTime(), presenceStart.getTime());
  const overlapEnd = Math.min(assignedEnd.getTime(), presenceEnd.getTime());
  return Math.max(0, Math.floor((overlapEnd - overlapStart) / 60_000));
}

function resolveOvertimeWindow(overtimeDate: string | null | undefined, startAtInput: string, endAtInput: string) {
  const startAt = new Date(startAtInput);
  let endAt = new Date(endAtInput);
  if (!(startAt < endAt)) {
    endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
  }
  if (!(startAt < endAt)) throw new Error('Overtime end time must be after start time');
  return {
    startAt,
    endAt,
    overtimeDate: overtimeDate ?? startAt.toISOString().slice(0, 10),
  };
}

async function filterVisibleOvertimeRequests<T extends { employeeId: string; employee?: { userId?: string | null } | null }>(
  requests: T[],
  userId?: string,
  roles?: string[] | null,
) {
  const managedEmployeeIds = userId ? await getVisibleEmployeeIdsForSupervisorActor(userId, roles) : [];
  return requests.filter((request) => (
    request.employee?.userId === userId || managedEmployeeIds.includes(request.employeeId)
  ));
}

async function assertEmployeeExists(id: string, tx: DbClient = db) {
  const found = await tx.query.employees.findFirst({
    where: eq(employees.id, id),
    columns: { id: true },
  });
  if (!found) throw new Error('Employee not found');
}

async function assertUserExists(id: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, id),
    columns: { id: true },
  });
  if (!found) throw new Error('User not found');
}

async function findAttendanceDailyRecord(employeeId: string, overtimeDate: string, tx: DbClient = db) {
  return tx.query.attendanceDailyRecords.findFirst({
    where: and(
      eq(attendanceDailyRecords.employeeId, employeeId),
      eq(attendanceDailyRecords.attendanceDate, overtimeDate),
    ),
    columns: { id: true, status: true, payrollNote: true },
  });
}

function overtimePayrollNote(minutes: number, days: number) {
  return `${OVERTIME_NOTE_PREFIX}${formatHours(minutes)} hour(s), ${formatDayValue(days)} overtime day(s)`;
}

function mergePayrollNote(existing: string | null | undefined, note: string | null) {
  if (!note) return existing ?? null;
  if (!existing?.trim()) return note;
  if (existing.includes(note) || existing.includes(OVERTIME_NOTE_PREFIX)) {
    return existing.includes(OVERTIME_NOTE_PREFIX) && !existing.includes(note)
      ? `${existing.replace(/Approved overtime [^;]+/, note)}`
      : existing;
  }
  return `${existing}; ${note}`;
}

function minutesToOvertimeDays(minutes: number) {
  return Math.round((minutes / 480) * 100) / 100;
}

function formatHours(minutes: number) {
  return String(Math.round((minutes / 60) * 100) / 100);
}

function formatDayValue(value: number) {
  return value.toFixed(2);
}

function uniqueIds(ids: Array<string | null | undefined>) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function startOfDay(value: Date) {
  return new Date(`${toDateKey(value)}T00:00:00`);
}

function endOfDay(value: Date) {
  return new Date(`${toDateKey(value)}T23:59:59.999`);
}

function earliestDayStart(dates: Date[]) {
  return startOfDay(new Date(Math.min(...dates.map((date) => date.getTime()))));
}

function latestDayEnd(dates: Date[]) {
  return endOfDay(new Date(Math.max(...dates.map((date) => date.getTime()))));
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
