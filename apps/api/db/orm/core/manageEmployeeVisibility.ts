import { eq, inArray, sql } from 'drizzle-orm';
import { db } from '../../db';
import { employees, hrDepartmentAssignments } from '../../schema';

type DbClient = typeof db | any;
const HR_ROLE_NAMES = new Set(['human_resource']);
const HR_PERMISSION_RESOURCES = new Set([
  'employees',
  'permanent-employees',
  'hr-dashboard',
  'hr-attendance-approvals',
  'leave-balances',
  'leave-transfer',
  'leave-fiscal-years',
  'leave-types',
]);

export type EmployeeVisibilityScope =
  | { type: 'unrestricted' }
  | { type: 'hr' }
  | { type: 'hr-departments'; departmentIds: string[] }
  | { type: 'employee-ids'; employeeIds: string[] }
  | { type: 'self'; userId: string };

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

  const hasHrAccess = roles.some((role) => HR_ROLE_NAMES.has(role))
    || permissions.some(isHrCapabilityPermission);

  if (hasHrAccess) {
    const assignedDepartmentIds = await getActiveHrDepartmentScopeIds(input.userId);
    return assignedDepartmentIds.length > 0
      ? { type: 'hr-departments', departmentIds: assignedDepartmentIds }
      : { type: 'hr' };
  }

  return { type: 'self', userId: input.userId };
}

export function isHrCapabilityPermission(permission: string) {
  const normalized = permission.trim().toLowerCase();
  const resource = normalized.split(':')[0];
  return normalized.startsWith('hr-') || HR_PERMISSION_RESOURCES.has(resource);
}

export function scopedEmployeeWhere(scope: EmployeeVisibilityScope) {
  if (scope.type === 'self') return eq(employees.userId, scope.userId);
  if (scope.type === 'employee-ids') {
    return scope.employeeIds.length > 0
      ? inArray(employees.id, scope.employeeIds)
      : sql`false`;
  }
  if (scope.type === 'hr-departments') {
    return scope.departmentIds.length > 0
      ? inArray(employees.departmentId, scope.departmentIds)
      : sql`false`;
  }
  return undefined;
}

export async function assertCanAccessEmployee(employeeId: string, scope: EmployeeVisibilityScope, tx: DbClient = db) {
  if (scope.type === 'unrestricted' || scope.type === 'hr') return;

  const employee = await tx.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: { id: true, userId: true, departmentId: true },
  });

  if (!employee) throw new Error('Employee not found');
  if (scope.type === 'self' && employee.userId === scope.userId) return;
  if (scope.type === 'hr-departments' && scope.departmentIds.includes(employee.departmentId)) return;
  if (scope.type === 'employee-ids' && scope.employeeIds.includes(employee.id)) return;

  throw new Error('Employee not found');
}

export function isDepartmentVisibleInScope(departmentId: string | null | undefined, scope?: EmployeeVisibilityScope) {
  if (!scope || scope.type === 'unrestricted' || scope.type === 'hr') return true;
  if (scope.type === 'hr-departments') return Boolean(departmentId && scope.departmentIds.includes(departmentId));
  return false;
}

export function isEmployeeVisibleInScope(
  employee: { id?: string | null; userId?: string | null; departmentId?: string | null } | null | undefined,
  scope?: EmployeeVisibilityScope,
) {
  if (!scope || scope.type === 'unrestricted' || scope.type === 'hr') return true;
  if (!employee) return false;
  if (scope.type === 'self') return employee.userId === scope.userId;
  if (scope.type === 'employee-ids') return Boolean(employee.id && scope.employeeIds.includes(employee.id));
  return isDepartmentVisibleInScope(employee.departmentId, scope);
}

export async function getActiveHrDepartmentScopeIds(userId: string, tx: DbClient = db) {
  const assignments = await tx.query.hrDepartmentAssignments.findMany({
    where: andActiveHrDepartmentAssignment(userId),
    columns: { departmentId: true },
  });

  const rootIds: string[] = [...new Set(assignments.map((assignment: { departmentId: string }) => assignment.departmentId))] as string[];
  if (rootIds.length === 0) return [];

  const allDepartments = await tx.query.departments.findMany({
    columns: { id: true, parentDepartmentId: true },
  });

  return expandDepartmentDescendants(rootIds, allDepartments);
}

function andActiveHrDepartmentAssignment(userId: string) {
  return sql`${hrDepartmentAssignments.userId} = ${userId} AND ${hrDepartmentAssignments.isActive} = true`;
}

function expandDepartmentDescendants(
  rootIds: string[],
  allDepartments: Array<{ id: string; parentDepartmentId: string | null }>,
) {
  const childrenByParent = new Map<string, string[]>();
  for (const department of allDepartments) {
    if (!department.parentDepartmentId) continue;
    const children = childrenByParent.get(department.parentDepartmentId) ?? [];
    children.push(department.id);
    childrenByParent.set(department.parentDepartmentId, children);
  }

  const visible = new Set(rootIds);
  const queue = [...rootIds];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const childId of childrenByParent.get(current) ?? []) {
      if (visible.has(childId)) continue;
      visible.add(childId);
      queue.push(childId);
    }
  }

  return [...visible];
}
