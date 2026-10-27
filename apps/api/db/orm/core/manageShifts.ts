import { asc, eq } from 'drizzle-orm';
import { db } from '../../db';
import {
  shiftBreaks,
  shiftSegments,
  shifts,
} from '../../schema';
import type {
  CreateShiftBreakInput,
  CreateShiftInput,
  CreateShiftSegmentInput,
  UpdateShiftBreakInput,
  UpdateShiftInput,
  UpdateShiftSegmentInput,
} from '../../../types/core.types';
import { writeAuditEvent } from '../../../lib/audit';

type DbClient = typeof db | any;

const SHIFT_TIMING_FIELDS = ['gracePeriodMinutes', 'lateAfterMinutes', 'earlyOutBeforeMinutes', 'duplicatePunchWindowMinutes', 'isOvernight'] as const;
const SEGMENT_TIMING_FIELDS = ['shiftId', 'startTime', 'endTime', 'sortOrder', 'isActive', 'checkInOpensBeforeMinutes', 'lateAfterMinutes', 'checkOutClosesAfterMinutes'] as const;

/** True when a save changes a value attendance is calculated from (times compare as HH:MM). */
function timingChanged(before: Record<string, unknown> | undefined, after: Record<string, unknown>, fields: readonly string[]) {
  if (!before) return true;
  const normalize = (value: unknown) => (typeof value === 'string' && /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : value ?? null);
  return fields.some((field) => field in after && normalize(after[field]) !== normalize(before[field]));
}

/**
 * Days not yet approved are re-evaluated with the new rules in the background, so saving stays
 * fast even with many open days; approved days keep their result.
 */
function recalculateOpenAttendanceInBackground(shiftId: string) {
  import('./manageAttendanceApprovals')
    .then(({ recalculateOpenAttendanceForShift }) => recalculateOpenAttendanceForShift(shiftId))
    .catch((error) => console.error('Failed to recalculate attendance after a shift change', { shiftId, error }));
}

export async function createShift(input: CreateShiftInput) {
  const [shift] = await db
    .insert(shifts)
    .values(normalizeShiftInput(input) as any)
    .returning();

  await writeAuditEvent(db, {
    action: 'SHIFT_CREATED',
    resourceType: 'shift',
    resourceId: shift.id,
    resourceLabel: shift.nameEn,
  });
  return shift;
}

export async function getShifts() {
  return db.select().from(shifts).orderBy(asc(shifts.nameEn));
}

export async function getShiftById(id: string, tx: DbClient = db) {
  return tx.query.shifts.findFirst({
    where: eq(shifts.id, id),
  });
}

export async function updateShift(id: string, input: UpdateShiftInput) {
  await assertShiftExists(id);

  const updateData = normalizeShiftInput(input);

  if (Object.keys(updateData).length === 0) {
    return getShiftById(id);
  }

  const before = await getShiftById(id);
  const [shift] = await db
    .update(shifts)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(shifts.id, id))
    .returning();

  await writeAuditEvent(db, {
    action: 'SHIFT_UPDATED',
    resourceType: 'shift',
    resourceId: shift.id,
    resourceLabel: shift.nameEn,
  });
  if (timingChanged(before, updateData, SHIFT_TIMING_FIELDS)) recalculateOpenAttendanceInBackground(shift.id);
  return shift;
}

export async function createShiftSegment(input: CreateShiftSegmentInput) {
  await assertShiftExists(input.shiftId);

  const [shiftSegment] = await db
    .insert(shiftSegments)
    .values(normalizeShiftSegmentInput(input) as any)
    .returning();

  recalculateOpenAttendanceInBackground(shiftSegment.shiftId);
  return shiftSegment;
}

export async function getShiftSegments(shiftId: string) {
  await assertShiftExists(shiftId);

  return db.select().from(shiftSegments).where(eq(shiftSegments.shiftId, shiftId)).orderBy(asc(shiftSegments.sortOrder), asc(shiftSegments.startTime));
}

export async function getShiftSegmentById(id: string, tx: DbClient = db) {
  return tx.query.shiftSegments.findFirst({
    where: eq(shiftSegments.id, id),
  });
}

export async function updateShiftSegment(id: string, input: UpdateShiftSegmentInput) {
  await assertShiftSegmentExists(id);

  if (input.shiftId) {
    await assertShiftExists(input.shiftId);
  }

  const updateData = normalizeShiftSegmentInput(input);

  if (Object.keys(updateData).length === 0) {
    return getShiftSegmentById(id);
  }

  const before = await getShiftSegmentById(id);
  const [shiftSegment] = await db
    .update(shiftSegments)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(shiftSegments.id, id))
    .returning();

  if (timingChanged(before, updateData, SEGMENT_TIMING_FIELDS)) {
    recalculateOpenAttendanceInBackground(shiftSegment.shiftId);
    // A segment moved to another shift changes that shift's sessions too.
    if (before && before.shiftId !== shiftSegment.shiftId) recalculateOpenAttendanceInBackground(before.shiftId);
  }
  return shiftSegment;
}

export async function createShiftBreak(input: CreateShiftBreakInput) {
  await assertShiftExists(input.shiftId);

  const [shiftBreak] = await db
    .insert(shiftBreaks)
    .values(normalizeShiftBreakInput(input) as any)
    .returning();

  return shiftBreak;
}

export async function getShiftBreaks(shiftId: string) {
  await assertShiftExists(shiftId);

  return db.select().from(shiftBreaks).where(eq(shiftBreaks.shiftId, shiftId)).orderBy(asc(shiftBreaks.startTime));
}

export async function getShiftBreakById(id: string, tx: DbClient = db) {
  return tx.query.shiftBreaks.findFirst({
    where: eq(shiftBreaks.id, id),
  });
}

export async function updateShiftBreak(id: string, input: UpdateShiftBreakInput) {
  await assertShiftBreakExists(id);

  if (input.shiftId) {
    await assertShiftExists(input.shiftId);
  }

  const updateData = normalizeShiftBreakInput(input);

  if (Object.keys(updateData).length === 0) {
    return getShiftBreakById(id);
  }

  const [shiftBreak] = await db
    .update(shiftBreaks)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(shiftBreaks.id, id))
    .returning();

  return shiftBreak;
}

async function assertShiftExists(id: string, tx: DbClient = db) {
  const found = await tx.query.shifts.findFirst({
    where: eq(shifts.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Shift not found');
}

async function assertShiftBreakExists(id: string, tx: DbClient = db) {
  const found = await tx.query.shiftBreaks.findFirst({
    where: eq(shiftBreaks.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Shift break not found');
}

async function assertShiftSegmentExists(id: string, tx: DbClient = db) {
  const found = await tx.query.shiftSegments.findFirst({
    where: eq(shiftSegments.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Shift segment not found');
}

function normalizeShiftInput(input: Partial<CreateShiftInput>) {
  return removeUndefined({
    nameEn: input.nameEn,
    nameAm: input.nameAm,
    gracePeriodMinutes: input.gracePeriodMinutes,
    lateAfterMinutes: input.lateAfterMinutes,
    earlyOutBeforeMinutes: input.earlyOutBeforeMinutes,
    duplicatePunchWindowMinutes: input.duplicatePunchWindowMinutes,
    isOvernight: input.isOvernight,
    isActive: input.isActive,
  });
}

function normalizeShiftSegmentInput(input: Partial<CreateShiftSegmentInput>) {
  return removeUndefined({
    shiftId: input.shiftId,
    nameEn: input.nameEn,
    nameAm: input.nameAm,
    startTime: input.startTime,
    endTime: input.endTime,
    sortOrder: input.sortOrder,
    checkInOpensBeforeMinutes: input.checkInOpensBeforeMinutes,
    lateAfterMinutes: input.lateAfterMinutes,
    checkOutClosesAfterMinutes: input.checkOutClosesAfterMinutes,
    isActive: input.isActive,
  });
}

function normalizeShiftBreakInput(input: Partial<CreateShiftBreakInput>) {
  return removeUndefined({
    shiftId: input.shiftId,
    nameEn: input.nameEn,
    nameAm: input.nameAm,
    startTime: input.startTime,
    endTime: input.endTime,
    isPaid: input.isPaid,
    isActive: input.isActive,
  });
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
