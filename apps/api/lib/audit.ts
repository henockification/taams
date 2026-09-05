import { AsyncLocalStorage } from 'async_hooks';
import { db } from '../db/db';
import { auditEvents } from '../db/schema';

type DbClient = typeof db | any;

export const AUDIT_ACTOR_TYPES = ['USER', 'SYSTEM', 'DEVICE'] as const;
export const AUDIT_OUTCOMES = ['SUCCESS', 'DENIED', 'FAILED'] as const;

export const AUDIT_ACTIONS = [
  'AUTH_SIGN_IN',
  'AUTH_SIGN_OUT',
  'AUTH_PASSWORD_RESET',
  'AUTH_SESSIONS_REVOKED',
  'PERMISSION_DENIED',
  'LEAVE_REQUEST_SUBMITTED',
  'LEAVE_REQUEST_UPDATED',
  'LEAVE_REQUEST_APPROVED',
  'LEAVE_REQUEST_REJECTED',
  'LEAVE_REQUEST_AUTHORIZED',
  'LEAVE_REQUEST_AUTHORIZATION_REJECTED',
  'LEAVE_INTERRUPTION_SUBMITTED',
  'LEAVE_INTERRUPTION_APPROVED',
  'LEAVE_INTERRUPTION_REJECTED',
  'LEAVE_INTERRUPTION_AUTHORIZED',
  'LEAVE_INTERRUPTION_AUTHORIZATION_REJECTED',
  'LEAVE_BALANCE_UPSERTED',
  'LEAVE_BALANCE_TRANSFERRED',
  'LEAVE_BALANCE_CONSUMED',
  'ATTENDANCE_DAILY_RECORDS_GENERATED',
  'ATTENDANCE_SUPERVISOR_APPROVED',
  'ATTENDANCE_HR_APPROVED',
  'ATTENDANCE_RETURNED',
  'ATTENDANCE_PAYROLL_ADJUSTED',
  'OVERTIME_ASSIGNED',
  'OVERTIME_APPROVED',
  'OVERTIME_REJECTED',
  'MANUAL_PUNCH_SUBMITTED',
  'MANUAL_PUNCH_HR_REVIEWED',
  'MANUAL_PUNCH_HR_REJECTED',
  'MANUAL_PUNCH_APPROVED',
  'MANUAL_PUNCH_REJECTED',
  'BIOMETRIC_EXEMPTION_SUBMITTED',
  'BIOMETRIC_EXEMPTION_APPROVED',
  'BIOMETRIC_EXEMPTION_REJECTED',
  'BIOMETRIC_EXEMPTION_UPDATED',
  'BIOMETRIC_EXEMPTION_DEACTIVATED',
  'SUPERVISOR_DELEGATION_CREATED',
  'SUPERVISOR_DELEGATION_REVOKED',
  'TEMPORARY_ASSIGNMENT_CREATED',
  'TEMPORARY_ASSIGNMENT_UPDATED',
  'TEMPORARY_ASSIGNMENT_DEACTIVATED',
  'IFMIS_PREVIEWED',
  'IFMIS_PUSHED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_ROLES_ASSIGNED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'ROLE_PERMISSIONS_ASSIGNED',
  'PERMISSION_CREATED',
  'PERMISSION_UPDATED',
  'EMPLOYEE_CREATED',
  'EMPLOYEE_UPDATED',
  'EMPLOYEE_IMPORTED',
  'EMPLOYEE_SUPERVISOR_ASSIGNED',
  'DEPARTMENT_CREATED',
  'DEPARTMENT_UPDATED',
  'POSITION_CREATED',
  'POSITION_UPDATED',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  AUTH_SIGN_IN: 'Signed in',
  AUTH_SIGN_OUT: 'Signed out',
  AUTH_PASSWORD_RESET: 'Reset password',
  AUTH_SESSIONS_REVOKED: 'Revoked sessions',
  PERMISSION_DENIED: 'Permission denied',
  LEAVE_REQUEST_SUBMITTED: 'Submitted leave request',
  LEAVE_REQUEST_UPDATED: 'Updated leave request',
  LEAVE_REQUEST_APPROVED: 'Approved leave request',
  LEAVE_REQUEST_REJECTED: 'Rejected leave request',
  LEAVE_REQUEST_AUTHORIZED: 'Authorized leave request',
  LEAVE_REQUEST_AUTHORIZATION_REJECTED: 'Rejected leave authorization',
  LEAVE_INTERRUPTION_SUBMITTED: 'Submitted leave interruption',
  LEAVE_INTERRUPTION_APPROVED: 'Approved leave interruption',
  LEAVE_INTERRUPTION_REJECTED: 'Rejected leave interruption',
  LEAVE_INTERRUPTION_AUTHORIZED: 'Authorized leave interruption',
  LEAVE_INTERRUPTION_AUTHORIZATION_REJECTED: 'Rejected leave interruption authorization',
  LEAVE_BALANCE_UPSERTED: 'Updated leave balance',
  LEAVE_BALANCE_TRANSFERRED: 'Transferred leave balance',
  LEAVE_BALANCE_CONSUMED: 'Consumed annual leave balance',
  ATTENDANCE_DAILY_RECORDS_GENERATED: 'Generated daily attendance',
  ATTENDANCE_SUPERVISOR_APPROVED: 'Supervisor-approved attendance',
  ATTENDANCE_HR_APPROVED: 'HR-approved attendance',
  ATTENDANCE_RETURNED: 'Returned attendance',
  ATTENDANCE_PAYROLL_ADJUSTED: 'Adjusted attendance payroll days',
  OVERTIME_ASSIGNED: 'Assigned overtime',
  OVERTIME_APPROVED: 'Approved overtime',
  OVERTIME_REJECTED: 'Rejected overtime',
  MANUAL_PUNCH_SUBMITTED: 'Submitted attendance correction',
  MANUAL_PUNCH_HR_REVIEWED: 'HR-reviewed attendance correction',
  MANUAL_PUNCH_HR_REJECTED: 'HR-rejected attendance correction',
  MANUAL_PUNCH_APPROVED: 'Approved attendance correction',
  MANUAL_PUNCH_REJECTED: 'Rejected attendance correction',
  BIOMETRIC_EXEMPTION_SUBMITTED: 'Submitted biometric exemption',
  BIOMETRIC_EXEMPTION_APPROVED: 'Approved biometric exemption',
  BIOMETRIC_EXEMPTION_REJECTED: 'Rejected biometric exemption',
  BIOMETRIC_EXEMPTION_UPDATED: 'Updated biometric exemption',
  BIOMETRIC_EXEMPTION_DEACTIVATED: 'Deactivated biometric exemption',
  SUPERVISOR_DELEGATION_CREATED: 'Created supervisor delegation',
  SUPERVISOR_DELEGATION_REVOKED: 'Revoked supervisor delegation',
  TEMPORARY_ASSIGNMENT_CREATED: 'Created temporary assignment',
  TEMPORARY_ASSIGNMENT_UPDATED: 'Updated temporary assignment',
  TEMPORARY_ASSIGNMENT_DEACTIVATED: 'Deactivated temporary assignment',
  IFMIS_PREVIEWED: 'Previewed IFMIS attendance',
  IFMIS_PUSHED: 'Pushed attendance to IFMIS',
  USER_CREATED: 'Created user',
  USER_UPDATED: 'Updated user',
  USER_ROLES_ASSIGNED: 'Assigned user roles',
  ROLE_CREATED: 'Created role',
  ROLE_UPDATED: 'Updated role',
  ROLE_PERMISSIONS_ASSIGNED: 'Assigned role permissions',
  PERMISSION_CREATED: 'Created permission',
  PERMISSION_UPDATED: 'Updated permission',
  EMPLOYEE_CREATED: 'Created employee',
  EMPLOYEE_UPDATED: 'Updated employee',
  EMPLOYEE_IMPORTED: 'Imported employees',
  EMPLOYEE_SUPERVISOR_ASSIGNED: 'Assigned employee supervisor',
  DEPARTMENT_CREATED: 'Created department',
  DEPARTMENT_UPDATED: 'Updated department',
  POSITION_CREATED: 'Created position',
  POSITION_UPDATED: 'Updated position',
};

export type AuditContext = {
  actorUserId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorType: AuditActorType;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  supervisorDelegationId?: string | null;
};

export type AuditChanges = Record<string, { from: unknown; to: unknown }>;

export type WriteAuditEventInput = {
  action: AuditAction;
  outcome?: AuditOutcome;
  resourceType: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  employeeId?: string | null;
  departmentId?: string | null;
  supervisorDelegationId?: string | null;
  changes?: AuditChanges | null;
  metadata?: Record<string, unknown> | null;
  actorUserId?: string | null;
  actorName?: string | null;
  actorEmail?: string | null;
  actorType?: AuditActorType;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

const storage = new AsyncLocalStorage<AuditContext>();

export function runWithAuditContext<T>(ctx: AuditContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getAuditContext(): AuditContext | undefined {
  return storage.getStore();
}

export async function writeAuditEvent(tx: DbClient, input: WriteAuditEventInput) {
  const ctx = getAuditContext();
  const actorType = input.actorType ?? ctx?.actorType ?? 'SYSTEM';
  const actorUserId = input.actorUserId ?? ctx?.actorUserId ?? null;

  await tx.insert(auditEvents).values({
    actorUserId,
    actorName: input.actorName ?? ctx?.actorName ?? (actorType === 'SYSTEM' ? 'System' : null),
    actorEmail: input.actorEmail ?? ctx?.actorEmail ?? null,
    actorType,
    action: input.action,
    outcome: input.outcome ?? 'SUCCESS',
    resourceType: input.resourceType,
    resourceId: input.resourceId ?? null,
    resourceLabel: input.resourceLabel ?? null,
    employeeId: input.employeeId ?? null,
    departmentId: input.departmentId ?? null,
    supervisorDelegationId: input.supervisorDelegationId ?? ctx?.supervisorDelegationId ?? null,
    ipAddress: input.ipAddress ?? ctx?.ipAddress ?? null,
    userAgent: input.userAgent ?? ctx?.userAgent ?? null,
    requestId: input.requestId ?? ctx?.requestId ?? null,
    changes: input.changes ?? null,
    metadata: input.metadata ?? null,
  });
}

export function formatEmployeeLabel(employee?: {
  employeeCode?: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
} | null) {
  if (!employee) return 'Unknown employee';
  const name = [employee.firstNameEn, employee.lastNameEn].filter(Boolean).join(' ').trim();
  if (employee.employeeCode && name) return `${name} (${employee.employeeCode})`;
  return name || employee.employeeCode || 'Unknown employee';
}

export function employeeAuditFields(employee?: {
  id?: string;
  departmentId?: string | null;
  employeeCode?: string | null;
  firstNameEn?: string | null;
  lastNameEn?: string | null;
} | null) {
  return {
    employeeId: employee?.id ?? null,
    departmentId: employee?.departmentId ?? null,
  };
}

export function diffChanges(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): AuditChanges | null {
  if (!before && !after) return null;
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  const changes: AuditChanges = {};
  for (const key of keys) {
    const fromValue = before?.[key] ?? null;
    const toValue = after?.[key] ?? null;
    if (JSON.stringify(fromValue) !== JSON.stringify(toValue)) {
      changes[key] = { from: fromValue, to: toValue };
    }
  }
  return Object.keys(changes).length ? changes : null;
}

export function summarizeChanges(changes: AuditChanges | null | undefined) {
  if (!changes) return '';
  return Object.entries(changes)
    .map(([field, value]) => `${field}: ${stringifyAuditValue(value.from)} → ${stringifyAuditValue(value.to)}`)
    .join('; ');
}

function stringifyAuditValue(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
