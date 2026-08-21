import { and, eq, gte, lte, ne } from 'drizzle-orm';
import { db } from '../../db';
import { holidays } from '../../schema';
import type {
  CreateHolidayInput,
  UpdateHolidayInput,
} from '../../../types/core.types';

type DbClient = typeof db | any;

export async function getHolidays() {
  return db.query.holidays.findMany({
    orderBy: (table, { desc, asc }) => [desc(table.isActive), asc(table.startDate), asc(table.nameEn)],
  });
}

export async function getHolidayById(id: string, tx: DbClient = db) {
  return tx.query.holidays.findFirst({
    where: eq(holidays.id, id),
  });
}

export async function createHoliday(input: CreateHolidayInput, tx: DbClient = db) {
  assertHolidayDateRange(input.startDate, input.endDate);
  const durationDays = normalizeDurationDays(input.durationDays);

  if (input.isActive !== false) {
    await assertNoActiveHolidayOverlap(input.startDate, input.endDate, undefined, tx);
  }

  const now = new Date();
  const [created] = await tx
    .insert(holidays)
    .values({
      nameEn: input.nameEn.trim(),
      nameAm: input.nameAm?.trim() || null,
      type: input.type,
      durationDays,
      startDate: input.startDate,
      endDate: input.endDate,
      description: input.description?.trim() || null,
      isActive: input.isActive ?? true,
      createdBy: input.createdBy ?? null,
      updatedBy: input.updatedBy ?? input.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    } as any)
    .returning();

  return getHolidayById(created.id, tx);
}

export async function updateHoliday(id: string, input: UpdateHolidayInput, tx: DbClient = db) {
  const existing = await getHolidayById(id, tx);
  if (!existing) throw new Error('Holiday/off day not found');

  const startDate = input.startDate ?? existing.startDate;
  const endDate = input.endDate ?? existing.endDate;
  const isActive = input.isActive ?? existing.isActive;
  const durationDays = input.durationDays === undefined ? undefined : normalizeDurationDays(input.durationDays);

  assertHolidayDateRange(startDate, endDate);

  if (isActive) {
    await assertNoActiveHolidayOverlap(startDate, endDate, id, tx);
  }

  await tx
    .update(holidays)
    .set(removeUndefined({
      nameEn: input.nameEn?.trim(),
      nameAm: input.nameAm === undefined ? undefined : input.nameAm?.trim() || null,
      type: input.type,
      durationDays,
      startDate: input.startDate,
      endDate: input.endDate,
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      isActive: input.isActive,
      updatedBy: input.updatedBy ?? input.createdBy ?? existing.updatedBy ?? existing.createdBy ?? null,
      updatedAt: new Date(),
    }) as any)
    .where(eq(holidays.id, id));

  return getHolidayById(id, tx);
}

export async function getActiveHolidayForDate(date: string, tx: DbClient = db) {
  return tx.query.holidays.findFirst({
    where: and(
      eq(holidays.isActive, true),
      lte(holidays.startDate, date),
      gte(holidays.endDate, date),
    ),
    orderBy: (table: typeof holidays, { asc }: any) => [asc(table.startDate), asc(table.nameEn)],
  });
}

async function assertNoActiveHolidayOverlap(startDate: string, endDate: string, excludeId?: string, tx: DbClient = db) {
  const conditions = [
    eq(holidays.isActive, true),
    lte(holidays.startDate, endDate),
    gte(holidays.endDate, startDate),
  ];

  if (excludeId) {
    conditions.push(ne(holidays.id, excludeId));
  }

  const existing = await tx.query.holidays.findFirst({
    where: and(...conditions),
  });

  if (existing) {
    throw new Error('An active holiday/off day already overlaps this date range');
  }
}

function assertHolidayDateRange(startDate: string, endDate: string) {
  if (startDate > endDate) {
    throw new Error('Holiday/off day start date must be before or equal to end date');
  }
}

function normalizeDurationDays(value: string | number | undefined | null) {
  const parsed = value === undefined || value === null || value === '' ? 1 : Number(value);

  if (parsed !== 0.5 && parsed !== 1) {
    throw new Error('Holiday/off day duration must be full day or half day');
  }

  return parsed.toFixed(2);
}

function removeUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
