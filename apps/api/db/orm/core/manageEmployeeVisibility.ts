import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { employees } from '../../schema';

type DbClient = typeof db | any;
const LEGACY_HR_ROLE_NAMES = new Set(['human_resource', 'hr', 'hr_manager', 'hr_clerk']);
const HR_PERMISSION_RESOURCES = new Set([
  'employees',
  'permanent-employees',
  'hr-dashboard',
  'hr-attendance-approvals',
  'manual-punch-requests',
  'overtime-requests',
  'leave-balances',
  'leave-transfer',
  'leave-fiscal-years',
  'leave-types',
  'leave-request-approvals',
  'biometric-exemptions',
  'attendance-punches',
  'work-schedules',
  'holidays',
  'shifts',
  'schedule-assignments',
]);

export type EmployeeVisibilityScope =
  | { type: 'unrestricted' }
  | { type: 'hr' }
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

  const hasHrAccess = roles.some((role) => LEGACY_HR_ROLE_NAMES.has(role))
    || permissions.some(isHrCapabilityPermission);

  return hasHrAccess ? { type: 'hr' } : { type: 'self', userId: input.userId };
}

export function isHrCapabilityPermission(permission: string) {
  const normalized = permission.trim().toLowerCase();
  const resource = normalized.split(':')[0];
  return normalized.startsWith('hr-') || HR_PERMISSION_RESOURCES.has(resource);
}

export function scopedEmployeeWhere(scope: EmployeeVisibilityScope) {
  if (scope.type === 'self') return eq(employees.userId, scope.userId);
  return undefined;
}

export async function assertCanAccessEmployee(employeeId: string, scope: EmployeeVisibilityScope, tx: DbClient = db) {
  if (scope.type === 'unrestricted' || scope.type === 'hr') return;

  const employee = await tx.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    columns: { id: true, userId: true },
  });

  if (!employee) throw new Error('Employee not found');
  if (employee.userId === scope.userId) return;

  throw new Error('Employee not found');
}
