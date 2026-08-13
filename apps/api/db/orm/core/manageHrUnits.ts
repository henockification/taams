import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { employees, hrUnits, user, userHrUnits } from '../../schema';

type DbClient = typeof db | any;
const LEGACY_HR_ROLE_NAMES = new Set(['human_resource', 'hr', 'hr_manager', 'hr_clerk']);
const HR_PERMISSION_RESOURCES = new Set([
  'employees',
  'permanent-employees',
  'hr-dashboard',
  'hr-attendance-approvals',
  'manual-punch-requests',
  'leave-balances',
  'leave-transfer',
  'leave-fiscal-years',
  'leave-types',
  'leave-request-approvals',
  'biometric-exemptions',
  'attendance-punches',
  'work-schedules',
  'shifts',
  'schedule-assignments',
]);

export type CreateHrUnitInput = {
  nameEn: string;
  nameAm?: string | null;
  code?: string | null;
  isActive?: boolean;
};

export type UpdateHrUnitInput = Partial<CreateHrUnitInput>;

export type EmployeeVisibilityScope =
  | { type: 'unrestricted' }
  | { type: 'hr_units'; hrUnitIds: string[] }
  | { type: 'self'; userId: string };

export async function createHrUnit(input: CreateHrUnitInput) {
  const [hrUnit] = await db.insert(hrUnits).values(normalizeHrUnitInput(input) as any).returning();
  return hrUnit;
}

export async function getHrUnits() {
  return db.select().from(hrUnits).orderBy(asc(hrUnits.nameEn));
}

export async function updateHrUnit(id: string, input: UpdateHrUnitInput) {
  await assertHrUnitExists(id);
  const updateData = normalizeHrUnitInput(input);

  if (Object.keys(updateData).length === 0) {
    return getHrUnitById(id);
  }

  const [hrUnit] = await db
    .update(hrUnits)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(hrUnits.id, id))
    .returning();

  return hrUnit;
}

export async function getUserHrUnits(userId: string) {
  return db.query.userHrUnits.findMany({
    where: eq(userHrUnits.userId, userId),
    with: { hrUnit: true },
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });
}

export async function assignUserHrUnits(userId: string, hrUnitIds: string[]) {
  return db.transaction(async (tx) => {
    await assertUserExists(userId, tx);
    if (hrUnitIds.length > 0) {
      await assertHrUnitsExist(hrUnitIds, tx);
    }

    await tx.delete(userHrUnits).where(eq(userHrUnits.userId, userId));

    if (hrUnitIds.length > 0) {
      await tx.insert(userHrUnits).values(
        Array.from(new Set(hrUnitIds)).map((hrUnitId) => ({ userId, hrUnitId })),
      );
    }

    return getUserHrUnits(userId);
  });
}

export async function resolveEmployeeVisibilityScope(input: {
  userId: string;
  roles?: string[] | null;
  permissions?: string[] | null;
}): Promise<EmployeeVisibilityScope> {
  const roles = (input.roles ?? []).map((role) => role.toLowerCase());
  const permissions = input.permissions ?? [];

  if (roles.some((role) => role === 'super_admin' || role === 'superadmin' || role === 'admin' || role === 'executive')) {
    return { type: 'unrestricted' };
  }

  const hasHrAccess = roles.some((role) => LEGACY_HR_ROLE_NAMES.has(role))
    || permissions.some(isHrCapabilityPermission);

  if (hasHrAccess) {
    const memberships = await getUserHrUnits(input.userId);
    return {
      type: 'hr_units',
      hrUnitIds: memberships
        .map((membership) => membership.hrUnit?.id ?? membership.hrUnitId)
        .filter((id): id is string => Boolean(id)),
    };
  }

  return { type: 'self', userId: input.userId };
}

export function isHrCapabilityPermission(permission: string) {
  const normalized = permission.trim().toLowerCase();
  const resource = normalized.split(':')[0];
  return normalized.startsWith('hr-') || HR_PERMISSION_RESOURCES.has(resource);
}

export function scopedEmployeeWhere(scope: EmployeeVisibilityScope) {
  if (scope.type === 'unrestricted') return undefined;
  if (scope.type === 'self') return eq(employees.userId, scope.userId);
  if (scope.hrUnitIds.length === 0) return eq(employees.id, '00000000-0000-0000-0000-000000000000');
  return inArray(employees.hrUnitId, scope.hrUnitIds);
}

export async function assertCanAccessEmployee(employeeId: string, scope: EmployeeVisibilityScope, tx: DbClient = db) {
  if (scope.type === 'unrestricted') return;

  const employee = await tx.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: { id: true, userId: true, hrUnitId: true },
  });

  if (!employee) throw new Error('Employee not found');

  if (scope.type === 'self' && employee.userId === scope.userId) return;
  if (scope.type === 'hr_units' && employee.hrUnitId && scope.hrUnitIds.includes(employee.hrUnitId)) return;

  throw new Error('Employee not found');
}

export function assertCanUseHrUnit(hrUnitId: string | null | undefined, scope: EmployeeVisibilityScope) {
  if (scope.type === 'unrestricted') return;
  if (!hrUnitId) throw new Error('HR unit is required');
  if (scope.type === 'hr_units' && scope.hrUnitIds.includes(hrUnitId)) return;
  throw new Error('You do not have access to this HR unit');
}

export async function assertHrUnitExists(id: string, tx: DbClient = db) {
  const found = await tx.query.hrUnits.findFirst({
    where: eq(hrUnits.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('HR unit not found');
}

async function assertHrUnitsExist(ids: string[], tx: DbClient = db) {
  const uniqueIds = Array.from(new Set(ids));
  const found = await tx.select({ id: hrUnits.id }).from(hrUnits).where(inArray(hrUnits.id, uniqueIds));
  if (found.length !== uniqueIds.length) throw new Error('One or more HR units were not found');
}

async function getHrUnitById(id: string, tx: DbClient = db) {
  return tx.query.hrUnits.findFirst({ where: eq(hrUnits.id, id) });
}

async function assertUserExists(id: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('User not found');
}

function normalizeHrUnitInput(input: UpdateHrUnitInput) {
  return Object.fromEntries(
    Object.entries({
      nameEn: input.nameEn,
      nameAm: input.nameAm,
      code: input.code,
      isActive: input.isActive,
    }).filter(([, value]) => value !== undefined),
  );
}
