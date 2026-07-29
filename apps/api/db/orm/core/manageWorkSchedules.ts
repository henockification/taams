import { asc, eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  employeeWorkSchedules,
  employees,
  shifts,
  workScheduleDays,
  workSchedules,
} from '../../schema';
import type {
  CreateEmployeeWorkScheduleInput,
  CreateWorkScheduleDayInput,
  CreateWorkScheduleInput,
  UpdateEmployeeWorkScheduleInput,
  UpdateWorkScheduleDayInput,
  UpdateWorkScheduleInput,
} from '../../../types/core.types';

type DbClient = typeof db | any;

export async function createWorkSchedule(input: CreateWorkScheduleInput) {
  const [workSchedule] = await db
    .insert(workSchedules)
    .values(normalizeWorkScheduleInput(input) as any)
    .returning();

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

  return day;
}

export async function createEmployeeWorkSchedule(input: CreateEmployeeWorkScheduleInput) {
  await assertEmployeeExists(input.employeeId);
  await assertWorkScheduleExists(input.workScheduleId);

  const [employeeWorkSchedule] = await db
    .insert(employeeWorkSchedules)
    .values(normalizeEmployeeWorkScheduleInput(input) as any)
    .returning();

  return getEmployeeWorkScheduleById(employeeWorkSchedule.id);
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

  const [employeeWorkSchedule] = await db
    .update(employeeWorkSchedules)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(employeeWorkSchedules.id, id))
    .returning();

  return getEmployeeWorkScheduleById(employeeWorkSchedule.id);
}

export async function deleteEmployeeWorkSchedule(id: string) {
  await assertEmployeeWorkScheduleExists(id);

  const [employeeWorkSchedule] = await db
    .delete(employeeWorkSchedules)
    .where(eq(employeeWorkSchedules.id, id))
    .returning();

  return employeeWorkSchedule;
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

export async function getAllEmployeeWorkSchedules() {
  const schedules = await db.query.employeeWorkSchedules.findMany({
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

export async function getEmployeeWorkScheduleById(id: string, tx: DbClient = db) {
  return tx.query.employeeWorkSchedules.findFirst({
    where: eq(employeeWorkSchedules.id, id),
    with: {
      employee: true,
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
