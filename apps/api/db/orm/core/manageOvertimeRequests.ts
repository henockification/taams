import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendanceDailyRecords,
  employeeSupervisors,
  employees,
  overtimeRequests,
  user,
} from '../../schema';
import type {
  ChangeOvertimeRequestStatusInput,
  CreateOvertimeRequestInput,
} from '../../../types/core.types';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageEmployeeVisibility';

type DbClient = typeof db | any;
const SUPERVISOR_ROLE_NAMES = ['manager', 'department_manager', 'supervisor', 'department_head', 'admin', 'super_admin'];

export async function createOvertimeRequest(input: CreateOvertimeRequestInput, scope?: EmployeeVisibilityScope) {
  await assertEmployeeExists(input.employeeId);
  if (scope) await assertCanAccessEmployee(input.employeeId, scope);
  if (!input.requestedBy) throw new Error('requestedBy is required');
  await assertUserExists(input.requestedBy);

  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (!(startAt < endAt)) throw new Error('Overtime end time must be after start time');

  const requestedMinutes = Math.max(0, Math.floor((endAt.getTime() - startAt.getTime()) / 60_000));
  if (requestedMinutes <= 0) throw new Error('Overtime duration must be greater than zero');

  const overtimeDate = input.overtimeDate ?? startAt.toISOString().slice(0, 10);
  const attendanceDailyRecord = await findAttendanceDailyRecord(input.employeeId, overtimeDate);

  const [request] = await db
    .insert(overtimeRequests)
    .values({
      employeeId: input.employeeId,
      attendanceDailyRecordId: attendanceDailyRecord?.id ?? null,
      overtimeDate,
      startAt,
      endAt,
      requestedMinutes,
      reason: input.reason,
      requestedBy: input.requestedBy,
    } as any)
    .returning();

  return getOvertimeRequestById(request.id);
}

export async function getOvertimeRequests(input: {
  scope?: EmployeeVisibilityScope;
  userId?: string;
  roles?: string[] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string | null;
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

  if (!input.scope || input.scope.type === 'unrestricted' || input.scope.type === 'hr') return requests;

  const managedEmployeeIds = input.userId ? await getManagedEmployeeIdsForUser(input.userId, input.roles) : [];
  return requests.filter((request) => (
    request.employee?.userId === input.userId || managedEmployeeIds.includes(request.employeeId)
  ));
}

export async function changeOvertimeRequestStatus(
  id: string,
  input: ChangeOvertimeRequestStatusInput,
  context: { scope?: EmployeeVisibilityScope; reviewerUserId: string; roles?: string[] | null },
) {
  return db.transaction(async (tx) => {
    const request = await getOvertimeRequestById(id, tx);
    if (!request) throw new Error('Overtime request not found');
    if (request.status !== 'PENDING') throw new Error('Overtime request is already processed');

    await assertCanReviewOvertime(request.employeeId, context, tx);

    if (input.status === 'APPROVED') {
      const approvedMinutes = input.approvedMinutes ?? request.requestedMinutes;
      if (approvedMinutes <= 0) throw new Error('Approved overtime minutes must be greater than zero');
      if (approvedMinutes > request.requestedMinutes) throw new Error('Approved overtime cannot exceed requested overtime');

      const overtimeDays = input.overtimeDays ?? minutesToOvertimeDays(approvedMinutes);
      if (overtimeDays < 0) throw new Error('Overtime days must be non-negative');

      const approvedAt = input.approvedAt ? new Date(input.approvedAt) : new Date();
      const payrollNote = input.payrollNote?.trim() || `Approved overtime ${formatHours(approvedMinutes)} hour(s)`;

      await tx
        .update(overtimeRequests)
        .set({
          status: 'APPROVED',
          approvedBy: context.reviewerUserId,
          approvedAt,
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
        updatedAt: new Date(),
      })
      .where(eq(overtimeRequests.id, id));

    await syncApprovedOvertimeToDailyRecord(request.employeeId, request.overtimeDate, tx);
    return getOvertimeRequestById(id, tx);
  });
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

async function syncApprovedOvertimeToDailyRecord(employeeId: string, overtimeDate: string, tx: DbClient = db) {
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
  const note = minutes > 0
    ? `Approved overtime ${formatHours(minutes)} hour(s), ${formatDayValue(days)} overtime day(s)`
    : null;

  await tx
    .update(attendanceDailyRecords)
    .set({
      overtimeMinutes: minutes,
      overtimeHours: formatDayValue(hours),
      overtimeDays: formatDayValue(days),
      payrollNote: note ? sql`concat_ws('; ', nullif(${attendanceDailyRecords.payrollNote}, ''), ${note})` : attendanceDailyRecords.payrollNote,
      updatedAt: new Date(),
    })
    .where(and(
      eq(attendanceDailyRecords.employeeId, employeeId),
      eq(attendanceDailyRecords.attendanceDate, overtimeDate),
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

async function assertCanReviewOvertime(employeeId: string, context: { scope?: EmployeeVisibilityScope; reviewerUserId: string; roles?: string[] | null }, tx: DbClient) {
  if (!context.scope || context.scope.type === 'unrestricted' || context.scope.type === 'hr') return;

  const managedEmployeeIds = await getManagedEmployeeIdsForUser(context.reviewerUserId, context.roles, tx);
  if (managedEmployeeIds.includes(employeeId)) return;

  throw new Error('Only the direct supervisor or HR can review this overtime request');
}

async function getManagedEmployeeIdsForUser(userId: string, roles?: string[] | null, tx: DbClient = db) {
  const supervisor = await tx.query.employees.findFirst({
    where: eq(employees.userId, userId),
    columns: { id: true, departmentId: true },
  });
  if (!supervisor) return [];

  const managedIds = new Set<string>();
  const assignments = await tx.query.employeeSupervisors.findMany({
    where: and(
      eq(employeeSupervisors.supervisorId, supervisor.id),
      eq(employeeSupervisors.isPrimary, true),
    ),
    columns: { employeeId: true },
  });
  assignments.forEach((assignment: any) => managedIds.add(assignment.employeeId));

  const normalizedRoles = (roles ?? []).map((role) => role.toLowerCase());
  if (normalizedRoles.some((role) => SUPERVISOR_ROLE_NAMES.includes(role))) {
    const departmentEmployees = await tx.query.employees.findMany({
      where: and(
        eq(employees.departmentId, supervisor.departmentId),
        eq(employees.isActive, true),
      ),
      columns: { id: true },
    });
    departmentEmployees.forEach((employee: any) => {
      if (employee.id !== supervisor.id) managedIds.add(employee.id);
    });
  }

  return [...managedIds];
}

async function findAttendanceDailyRecord(employeeId: string, overtimeDate: string, tx: DbClient = db) {
  return tx.query.attendanceDailyRecords.findFirst({
    where: and(
      eq(attendanceDailyRecords.employeeId, employeeId),
      eq(attendanceDailyRecords.attendanceDate, overtimeDate),
    ),
    columns: { id: true },
  });
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
