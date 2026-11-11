import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import {
  employeeWorkSchedules,
  employees,
  shifts,
  workScheduleDays,
  workSchedules,
} from '../../schema';
import type {
  BulkCreateEmployeeWorkScheduleInput,
  CreateEmployeeWorkScheduleInput,
  CreateWorkScheduleDayInput,
  CreateWorkScheduleInput,
  UpdateEmployeeWorkScheduleInput,
  UpdateWorkScheduleDayInput,
  UpdateWorkScheduleInput,
} from '../../../types/core.types';
import { assertCanAccessEmployee, isEmployeeVisibleInScope, type EmployeeVisibilityScope } from './manageEmployeeVisibility';
import { writeAuditEvent } from '../../../lib/audit';
import { SOURCE_EMPLOYMENT_STATUS } from '../../../lib/employees/employment-status';

type DbClient = typeof db | any;

const dateOnly = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);

/**
 * Open (pending / returned) days are re-evaluated in the background after a schedule change, so
 * e.g. roster rest days calculated before the roster was assigned stop showing as absent.
 * Approved days keep their result.
 */
function recalculateEmployeesInBackground(employeeIds: string[], from: unknown, to?: unknown) {
  import('./manageAttendanceApprovals')
    .then(({ recalculateOpenAttendanceForEmployees }) => recalculateOpenAttendanceForEmployees(
      employeeIds,
      dateOnly(from),
      to ? dateOnly(to) : null,
    ))
    .catch((error) => console.error('Failed to recalculate attendance after a schedule assignment change', { employeeIds, error }));
}

function recalculateWorkScheduleInBackground(workScheduleId: string) {
  import('./manageAttendanceApprovals')
    .then(({ recalculateOpenAttendanceForWorkSchedule }) => recalculateOpenAttendanceForWorkSchedule(workScheduleId))
    .catch((error) => console.error('Failed to recalculate attendance after a work schedule change', { workScheduleId, error }));
}

export async function createWorkSchedule(input: CreateWorkScheduleInput) {
  const [workSchedule] = await db
    .insert(workSchedules)
    .values(normalizeWorkScheduleInput(input) as any)
    .returning();

  await writeAuditEvent(db, {
    action: 'WORK_SCHEDULE_CREATED',
    resourceType: 'work_schedule',
    resourceId: workSchedule.id,
    resourceLabel: workSchedule.nameEn,
  });
  return workSchedule;
}

export async function getWorkSchedules() {
  return db.select().from(workSchedules).orderBy(asc(workSchedules.nameEn));
}

export async function getWorkScheduleById(id: string, tx: DbClient = db) {
  const workSchedule = await tx.query.workSchedules.findFirst({
    where: eq(workSchedules.id, id),
    with: {
      days: {
        with: {
          shift: true,
        },
      },
    },
  });

  if (!workSchedule?.days) {
    return workSchedule;
  }

  return {
    ...workSchedule,
    days: [...workSchedule.days].sort((left, right) => left.dayOfWeek.localeCompare(right.dayOfWeek)),
  };
}

export async function updateWorkSchedule(id: string, input: UpdateWorkScheduleInput) {
  await assertWorkScheduleExists(id);

  const updateData = normalizeWorkScheduleInput(input);

  if (Object.keys(updateData).length === 0) {
    return getWorkScheduleById(id);
  }

  const [workSchedule] = await db
    .update(workSchedules)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(workSchedules.id, id))
    .returning();

  await writeAuditEvent(db, {
    action: 'WORK_SCHEDULE_UPDATED',
    resourceType: 'work_schedule',
    resourceId: workSchedule.id,
    resourceLabel: workSchedule.nameEn,
  });
  recalculateWorkScheduleInBackground(workSchedule.id);
  return workSchedule;
}

export async function createWorkScheduleDay(workScheduleId: string, input: CreateWorkScheduleDayInput) {
  await assertWorkScheduleExists(workScheduleId);

  if (input.shiftId) {
    await assertShiftExists(input.shiftId);
  }

  const [day] = await db
    .insert(workScheduleDays)
    .values(normalizeWorkScheduleDayInput({
      ...input,
      workScheduleId,
    }) as any)
    .returning();

  recalculateWorkScheduleInBackground(workScheduleId);
  return day;
}

export async function getWorkScheduleDays(workScheduleId: string) {
  await assertWorkScheduleExists(workScheduleId);

  const days = await db.query.workScheduleDays.findMany({
    where: eq(workScheduleDays.workScheduleId, workScheduleId),
    with: {
      shift: true,
    },
  });

  return days.sort((left, right) => left.dayOfWeek.localeCompare(right.dayOfWeek));
}

export async function getWorkScheduleDayById(id: string, tx: DbClient = db) {
  return tx.query.workScheduleDays.findFirst({
    where: eq(workScheduleDays.id, id),
    with: {
      shift: true,
    },
  });
}

export async function updateWorkScheduleDay(id: string, input: UpdateWorkScheduleDayInput) {
  await assertWorkScheduleDayExists(id);

  if (input.workScheduleId) {
    await assertWorkScheduleExists(input.workScheduleId);
  }
  if (input.shiftId) {
    await assertShiftExists(input.shiftId);
  }

  const updateData = normalizeWorkScheduleDayInput(input);

  if (Object.keys(updateData).length === 0) {
    return getWorkScheduleDayById(id);
  }

  const [day] = await db
    .update(workScheduleDays)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(workScheduleDays.id, id))
    .returning();

  recalculateWorkScheduleInBackground(day.workScheduleId);
  return day;
}

export async function createEmployeeWorkSchedule(input: CreateEmployeeWorkScheduleInput, options: { recalculate?: boolean } = {}) {
  await assertEmployeeExists(input.employeeId);
  await assertWorkScheduleExists(input.workScheduleId);

  const [employeeWorkSchedule] = await db
    .insert(employeeWorkSchedules)
    .values(normalizeEmployeeWorkScheduleInput(input) as any)
    .returning();

  if (options.recalculate !== false) {
    recalculateEmployeesInBackground([employeeWorkSchedule.employeeId], employeeWorkSchedule.effectiveFrom, employeeWorkSchedule.effectiveTo);
  }
  return getEmployeeWorkScheduleById(employeeWorkSchedule.id);
}

export async function createEmployeeWorkScheduleScoped(
  input: CreateEmployeeWorkScheduleInput,
  scope: EmployeeVisibilityScope,
  options: { recalculate?: boolean } = {},
) {
  await assertCanAccessEmployee(input.employeeId, scope);
  return createEmployeeWorkSchedule(input, options);
}

export async function bulkCreateEmployeeWorkSchedulesScoped(
  input: BulkCreateEmployeeWorkScheduleInput,
  scope: EmployeeVisibilityScope,
) {
  await assertWorkScheduleExists(input.workScheduleId);

  const employeeIds = [...new Set(input.employeeIds)];
  const created: Awaited<ReturnType<typeof createEmployeeWorkSchedule>>[] = [];
  const errors: Array<{ employeeId: string; message: string }> = [];

  for (const employeeId of employeeIds) {
    try {
      created.push(await createEmployeeWorkScheduleScoped({
        employeeId,
        workScheduleId: input.workScheduleId,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        isActive: input.isActive,
      }, scope, { recalculate: false }));
    } catch (error) {
      errors.push({
        employeeId,
        message: error instanceof Error ? error.message : 'Failed to assign employee work schedule',
      });
    }
  }

  // One recalculation for the whole batch rather than one per employee.
  recalculateEmployeesInBackground(created.map((assignment) => assignment!.employeeId), input.effectiveFrom, input.effectiveTo);

  return {
    created,
    failed: errors.length,
    errors,
  };
}

export async function updateEmployeeWorkSchedule(id: string, input: UpdateEmployeeWorkScheduleInput) {
  await assertEmployeeWorkScheduleExists(id);

  if (input.employeeId) {
    await assertEmployeeExists(input.employeeId);
  }
  if (input.workScheduleId) {
    await assertWorkScheduleExists(input.workScheduleId);
  }

  const updateData = normalizeEmployeeWorkScheduleInput(input);

  if (Object.keys(updateData).length === 0) {
    return getEmployeeWorkScheduleById(id);
  }

  const [before] = await db.select().from(employeeWorkSchedules).where(eq(employeeWorkSchedules.id, id));
  const [employeeWorkSchedule] = await db
    .update(employeeWorkSchedules)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(employeeWorkSchedules.id, id))
    .returning();

  // Cover both the old and the new period (e.g. a moved roster start date shifts every rest day).
  const froms = [before?.effectiveFrom, employeeWorkSchedule.effectiveFrom].filter(Boolean).map(dateOnly).sort();
  const tos = [before?.effectiveTo, employeeWorkSchedule.effectiveTo];
  const to = tos.some((value) => !value) ? null : tos.map(dateOnly).sort().at(-1);
  recalculateEmployeesInBackground(
    [before?.employeeId, employeeWorkSchedule.employeeId].filter(Boolean) as string[],
    froms[0],
    to,
  );
  return getEmployeeWorkScheduleById(employeeWorkSchedule.id);
}

export async function updateEmployeeWorkScheduleScoped(id: string, input: UpdateEmployeeWorkScheduleInput, scope: EmployeeVisibilityScope) {
  const existing = await getEmployeeWorkScheduleById(id);
  if (!existing) throw new Error('Employee work schedule assignment not found');
  await assertCanAccessEmployee(existing.employeeId, scope);
  if (input.employeeId) await assertCanAccessEmployee(input.employeeId, scope);
  return updateEmployeeWorkSchedule(id, input);
}

export async function deleteEmployeeWorkSchedule(id: string) {
  await assertEmployeeWorkScheduleExists(id);

  const [employeeWorkSchedule] = await db
    .delete(employeeWorkSchedules)
    .where(eq(employeeWorkSchedules.id, id))
    .returning();

  recalculateEmployeesInBackground([employeeWorkSchedule.employeeId], employeeWorkSchedule.effectiveFrom, employeeWorkSchedule.effectiveTo);
  return employeeWorkSchedule;
}

export async function deleteEmployeeWorkScheduleScoped(id: string, scope: EmployeeVisibilityScope) {
  const existing = await getEmployeeWorkScheduleById(id);
  if (!existing) throw new Error('Employee work schedule assignment not found');
  await assertCanAccessEmployee(existing.employeeId, scope);
  return deleteEmployeeWorkSchedule(id);
}

export async function getEmployeeWorkSchedules(employeeId: string) {
  await assertEmployeeExists(employeeId);

  const schedules = await db.query.employeeWorkSchedules.findMany({
    where: eq(employeeWorkSchedules.employeeId, employeeId),
    with: {
      employee: true,
      workSchedule: true,
    },
  });

  return schedules.sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
}

export async function getEmployeeWorkSchedulesScoped(employeeId: string, scope: EmployeeVisibilityScope) {
  await assertCanAccessEmployee(employeeId, scope);
  return getEmployeeWorkSchedules(employeeId);
}

export async function getAllEmployeeWorkSchedules(workingOnly = false) {
  const schedules = await db.query.employeeWorkSchedules.findMany({
    where: workingOnly ? inArray(employeeWorkSchedules.employeeId,
      db.select({ id: employees.id }).from(employees)
        .where(eq(employees.sourceEmploymentStatus, SOURCE_EMPLOYMENT_STATUS.WORKING))) : undefined,
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      workSchedule: true,
    },
  });

  return schedules.sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
}

export async function getAllEmployeeWorkSchedulesScoped(scope: EmployeeVisibilityScope) {
  const schedules = await getAllEmployeeWorkSchedules(true);
  return schedules.filter((schedule) => isEmployeeVisibleInScope(schedule.employee, scope));
}

export async function getEmployeeWorkScheduleById(id: string, tx: DbClient = db) {
  return tx.query.employeeWorkSchedules.findFirst({
    where: eq(employeeWorkSchedules.id, id),
    with: {
      employee: { with: { department: true, position: true } },
      workSchedule: true,
    },
  });
}

async function assertWorkScheduleExists(id: string, tx: DbClient = db) {
  const found = await tx.query.workSchedules.findFirst({
    where: eq(workSchedules.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Work schedule not found');
}

async function assertWorkScheduleDayExists(id: string, tx: DbClient = db) {
  const found = await tx.query.workScheduleDays.findFirst({
    where: eq(workScheduleDays.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Work schedule day not found');
}

async function assertShiftExists(id: string, tx: DbClient = db) {
  const found = await tx.query.shifts.findFirst({
    where: eq(shifts.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Shift not found');
}

async function assertEmployeeExists(id: string, tx: DbClient = db) {
  const found = await tx.query.employees.findFirst({
    where: eq(employees.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Employee not found');
}

async function assertEmployeeWorkScheduleExists(id: string, tx: DbClient = db) {
  const found = await tx.query.employeeWorkSchedules.findFirst({
    where: eq(employeeWorkSchedules.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Employee work schedule assignment not found');
}

function normalizeWorkScheduleInput(input: Partial<CreateWorkScheduleInput>) {
  return removeUndefined({
    nameEn: input.nameEn,
    nameAm: input.nameAm,
    description: input.description,
    scheduleType: input.scheduleType,
    rosterOnDays: input.rosterOnDays,
    rosterOffDays: input.rosterOffDays,
    isDefault: input.isDefault,
    isActive: input.isActive,
  });
}

function normalizeWorkScheduleDayInput(input: Partial<CreateWorkScheduleDayInput> & { workScheduleId?: string }) {
  return removeUndefined({
    workScheduleId: input.workScheduleId,
    dayOfWeek: input.dayOfWeek,
    shiftId: input.shiftId,
    isOffDay: input.isOffDay,
    isActive: input.isActive,
  });
}

function normalizeEmployeeWorkScheduleInput(input: Partial<CreateEmployeeWorkScheduleInput>) {
  return removeUndefined({
    employeeId: input.employeeId,
    workScheduleId: input.workScheduleId,
    effectiveFrom: input.effectiveFrom,
    effectiveTo: input.effectiveTo,
    isActive: input.isActive,
  });
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
