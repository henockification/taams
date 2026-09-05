import { and, asc, desc, eq, gt, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db';
import { employeeSupervisors, employees, supervisorDelegations, temporaryDepartmentAssignments, user } from '../../schema';
import { getUserRoleNames } from '../rbac/manageRbac';
import { effectivePrimaryEmployeeIds } from './leaveVisibility';
import { formatEmployeeLabel, writeAuditEvent } from '../../../lib/audit';

type DbClient = typeof db | any;

const SUPERVISOR_ROLE_NAMES = ['supervisor', 'admin', 'super_admin', 'superadmin'];

export type SupervisorDelegationActionContext = {
  supervisorDelegationId: string | null;
  effectiveSupervisorUserId: string | null;
  effectiveSupervisorEmployeeId: string | null;
};

export async function getSupervisorDelegationsForUser(userId: string, tx: DbClient = db) {
  return tx.query.supervisorDelegations.findMany({
    where: or(
      eq(supervisorDelegations.supervisorUserId, userId),
      eq(supervisorDelegations.delegateUserId, userId),
    ),
    with: delegationRelations,
    orderBy: (table: any, { desc }: any) => [desc(table.createdAt)],
  });
}

export async function getActiveDelegatedSupervisorCapabilities(userId: string, tx: DbClient = db) {
  const now = new Date();
  return tx.query.supervisorDelegations.findMany({
    where: and(
      eq(supervisorDelegations.delegateUserId, userId),
      isNull(supervisorDelegations.revokedAt),
      lte(supervisorDelegations.startsAt, now),
      gt(supervisorDelegations.endsAt, now),
    ),
    with: delegationRelations,
    orderBy: (table: any, { asc }: any) => [asc(table.endsAt)],
  });
}

export async function hasActiveSupervisorDelegation(userId: string, tx: DbClient = db) {
  const delegations = await getActiveDelegatedSupervisorCapabilities(userId, tx);
  return delegations.length > 0;
}

export async function createSupervisorDelegation(input: {
  supervisorUserId: string;
  delegateEmployeeId: string;
  startsAt: string | Date;
  endsAt: string | Date;
  createdBy: string;
}, tx: DbClient = db) {
  const startsAt = parseDateTime(input.startsAt, 'startsAt');
  const endsAt = parseDateTime(input.endsAt, 'endsAt');
  if (startsAt >= endsAt) throw new Error('Delegation start must be before end');
  if (endsAt <= new Date()) throw new Error('Delegation end must be in the future');

  const supervisor = await getEmployeeByUserId(input.supervisorUserId, tx);
  if (!supervisor) throw new Error('Supervisor user is not linked to an employee record');

  const delegate = await tx.query.employees.findFirst({
    where: eq(employees.id, input.delegateEmployeeId),
    with: { user: true },
  });
  if (!delegate?.userId || !delegate.user) throw new Error('Delegate must be an employee linked to a user');
  if (!delegate.isActive) throw new Error('Delegate employee must be active');
  if (delegate.userId === input.supervisorUserId || delegate.id === supervisor.id) {
    throw new Error('A supervisor cannot delegate to themselves');
  }

  return tx.transaction(async (innerTx: DbClient) => {
    const now = new Date();
    const revokedRows = await innerTx.update(supervisorDelegations)
      .set({
        revokedAt: now,
        revokedBy: input.createdBy,
        updatedAt: now,
      } as any)
      .where(and(
        eq(supervisorDelegations.supervisorUserId, input.supervisorUserId),
        isNull(supervisorDelegations.revokedAt),
        gt(supervisorDelegations.endsAt, now),
      ))
      .returning({ id: supervisorDelegations.id });

    const [created] = await innerTx.insert(supervisorDelegations).values({
      supervisorUserId: input.supervisorUserId,
      supervisorEmployeeId: supervisor.id,
      delegateUserId: delegate.userId,
      delegateEmployeeId: delegate.id,
      startsAt,
      endsAt,
      createdBy: input.createdBy,
    } as any).returning();

    const supervisorDelegation = await getSupervisorDelegationById(created.id, innerTx);
    const revokedDelegations = revokedRows.length
      ? await innerTx.query.supervisorDelegations.findMany({
        where: inArray(supervisorDelegations.id, revokedRows.map((row: { id: string }) => row.id)),
        with: delegationRelations,
      })
      : [];
    await writeAuditEvent(innerTx, {
      action: 'SUPERVISOR_DELEGATION_CREATED',
      resourceType: 'supervisor_delegation',
      resourceId: created.id,
      resourceLabel: `Delegation to ${formatEmployeeLabel(delegate)}`,
      employeeId: delegate.id,
      metadata: {
        supervisorUserId: input.supervisorUserId,
        delegateUserId: delegate.userId,
        revokedCount: revokedRows.length,
      },
    });
    return { supervisorDelegation, revokedDelegations };
  });
}

export async function revokeSupervisorDelegation(id: string, revokedBy: string, tx: DbClient = db) {
  const existing = await getSupervisorDelegationById(id, tx);
  if (!existing) throw new Error('Delegation not found');
  if (existing.supervisorUserId !== revokedBy) {
    const roles = await resolveUserRoles(revokedBy, tx);
    if (!roles.some((role) => ['super_admin', 'superadmin', 'admin'].includes(role))) {
      await writeAuditEvent(tx, {
        action: 'SUPERVISOR_DELEGATION_REVOKED',
        outcome: 'DENIED',
        resourceType: 'supervisor_delegation',
        resourceId: id,
        resourceLabel: 'Supervisor delegation',
      });
      throw new Error('Only the supervisor or an admin can revoke this delegation');
    }
  }

  if (existing.revokedAt) return { supervisorDelegation: existing, didRevoke: false };

  const now = new Date();
  const [updated] = await tx.update(supervisorDelegations)
    .set({ revokedAt: now, revokedBy, updatedAt: now } as any)
    .where(and(eq(supervisorDelegations.id, id), isNull(supervisorDelegations.revokedAt)))
    .returning();

  if (updated) {
    await writeAuditEvent(tx, {
      action: 'SUPERVISOR_DELEGATION_REVOKED',
      resourceType: 'supervisor_delegation',
      resourceId: id,
      resourceLabel: 'Supervisor delegation',
      employeeId: existing.delegateEmployeeId,
    });
  }

  return {
    supervisorDelegation: await getSupervisorDelegationById(updated?.id ?? id, tx),
    didRevoke: Boolean(updated),
  };
}

export async function getVisibleEmployeeIdsForSupervisorActor(
  actorUserId: string,
  roles?: string[] | null,
  tx: DbClient = db,
  referenceDate = today(),
) {
  const visibleIds = new Set(await getManagedEmployeeIdsForSupervisorUser(actorUserId, roles, tx, referenceDate));
  const delegations = await getActiveDelegatedSupervisorCapabilities(actorUserId, tx);

  for (const delegation of delegations) {
    const supervisorRoles = await resolveUserRoles(delegation.supervisorUserId, tx);
    const supervisorVisibleIds = await getManagedEmployeeIdsForSupervisorUser(
      delegation.supervisorUserId,
      supervisorRoles,
      tx,
      referenceDate,
    );
    supervisorVisibleIds.forEach((employeeId) => visibleIds.add(employeeId));
  }

  return [...visibleIds];
}

/**
 * Leave approvals deliberately use a narrower relationship than the general
 * supervisor visibility helpers: only currently-effective primary assignments
 * are eligible, plus those inherited through an active delegation.
 */
export async function getPrimaryLeaveApprovalEmployeeIds(
  actorUserId: string,
  tx: DbClient = db,
  referenceDate = today(),
): Promise<string[]> {
  const visibleIds = new Set<string>(await getPrimaryAssignedEmployeeIds(actorUserId, tx, referenceDate));
  const delegations = await getActiveDelegatedSupervisorCapabilities(actorUserId, tx);

  for (const delegation of delegations) {
    const delegatedIds = await getPrimaryAssignedEmployeeIds(delegation.supervisorUserId, tx, referenceDate);
    delegatedIds.forEach((employeeId) => visibleIds.add(employeeId));
  }

  return [...visibleIds];
}

export async function resolveLeaveApprovalActionContext(input: {
  actorUserId: string;
  targetEmployeeId: string;
  tx?: DbClient;
  referenceDate?: string;
}): Promise<SupervisorDelegationActionContext> {
  const tx = input.tx ?? db;
  const referenceDate = input.referenceDate ?? today();
  const directIds = await getPrimaryAssignedEmployeeIds(input.actorUserId, tx, referenceDate);

  if (directIds.includes(input.targetEmployeeId)) {
    return {
      supervisorDelegationId: null,
      effectiveSupervisorUserId: input.actorUserId,
      effectiveSupervisorEmployeeId: (await getEmployeeByUserId(input.actorUserId, tx))?.id ?? null,
    };
  }

  const delegations = await getActiveDelegatedSupervisorCapabilities(input.actorUserId, tx);
  for (const delegation of delegations) {
    const delegatedIds = await getPrimaryAssignedEmployeeIds(delegation.supervisorUserId, tx, referenceDate);
    if (delegatedIds.includes(input.targetEmployeeId)) {
      return {
        supervisorDelegationId: delegation.id,
        effectiveSupervisorUserId: delegation.supervisorUserId,
        effectiveSupervisorEmployeeId: delegation.supervisorEmployeeId,
      };
    }
  }

  throw new Error('Only the active primary supervisor or an active delegate can review this leave request');
}

async function getPrimaryAssignedEmployeeIds(userId: string, tx: DbClient, referenceDate: string): Promise<string[]> {
  const supervisor = await getEmployeeByUserId(userId, tx);
  if (!supervisor) return [];

  const assignments = await tx.query.employeeSupervisors.findMany({
    where: eq(employeeSupervisors.supervisorId, supervisor.id),
    columns: { employeeId: true, isPrimary: true, effectiveFrom: true, effectiveTo: true },
  });

  return effectivePrimaryEmployeeIds(assignments, referenceDate);
}

export async function resolveSupervisorActionContext(input: {
  actorUserId: string;
  roles?: string[] | null;
  targetEmployeeId: string;
  tx?: DbClient;
  referenceDate?: string;
}): Promise<SupervisorDelegationActionContext> {
  const tx = input.tx ?? db;
  const referenceDate = input.referenceDate ?? today();
  const directEmployeeIds = await getManagedEmployeeIdsForSupervisorUser(input.actorUserId, input.roles, tx, referenceDate);

  if (directEmployeeIds.includes(input.targetEmployeeId)) {
    return {
      supervisorDelegationId: null,
      effectiveSupervisorUserId: input.actorUserId,
      effectiveSupervisorEmployeeId: (await getEmployeeByUserId(input.actorUserId, tx))?.id ?? null,
    };
  }

  const actorEmployee = await getEmployeeByUserId(input.actorUserId, tx);
  if (actorEmployee?.id === input.targetEmployeeId) {
    throw new Error('Delegates cannot act on their own records');
  }

  const delegations = await getActiveDelegatedSupervisorCapabilities(input.actorUserId, tx);
  for (const delegation of delegations) {
    const supervisorRoles = await resolveUserRoles(delegation.supervisorUserId, tx);
    const supervisorVisibleIds = await getManagedEmployeeIdsForSupervisorUser(
      delegation.supervisorUserId,
      supervisorRoles,
      tx,
      referenceDate,
    );

    if (supervisorVisibleIds.includes(input.targetEmployeeId)) {
      return {
        supervisorDelegationId: delegation.id,
        effectiveSupervisorUserId: delegation.supervisorUserId,
        effectiveSupervisorEmployeeId: delegation.supervisorEmployeeId,
      };
    }
  }

  throw new Error('Only the assigned supervisor or an active delegate can perform this action');
}

export async function getManagedEmployeeIdsForSupervisorUser(
  userId: string,
  roles?: string[] | null,
  tx: DbClient = db,
  referenceDate = today(),
) {
  const supervisor = await getEmployeeByUserId(userId, tx);
  if (!supervisor) return [];

  const managedIds = new Set<string>();
  const temporaryAssignments = await getActiveTemporaryAssignmentRows(referenceDate, tx);
  const temporaryTargetDepartmentByEmployee = new Map<string, string>(
    temporaryAssignments.map((assignment: any) => [assignment.employeeId, assignment.targetDepartmentId]),
  );
  const assignments = await tx.query.employeeSupervisors.findMany({
    where: and(
      eq(employeeSupervisors.supervisorId, supervisor.id),
      lte(employeeSupervisors.effectiveFrom, referenceDate),
      or(isNull(employeeSupervisors.effectiveTo), gte(employeeSupervisors.effectiveTo, referenceDate)),
    ),
    columns: { employeeId: true },
  });
  const explicitlyAssignedIds = assignments.map((assignment: { employeeId: string }) => assignment.employeeId);
  const explicitlyAssignedEmployees = explicitlyAssignedIds.length > 0
    ? await tx.query.employees.findMany({
      where: inArray(employees.id, explicitlyAssignedIds),
      columns: { id: true, departmentId: true },
    })
    : [];
  explicitlyAssignedEmployees.forEach((employee: { id: string; departmentId: string }) => {
    if (getEffectiveDepartmentId(employee, temporaryTargetDepartmentByEmployee) === supervisor.departmentId) {
      managedIds.add(employee.id);
    }
  });

  const normalizedRoles = roles?.length ? roles.map((role) => role.toLowerCase()) : await resolveUserRoles(userId, tx);
  if (normalizedRoles.some((role) => SUPERVISOR_ROLE_NAMES.includes(role))) {
    const departmentEmployees = await tx.query.employees.findMany({
      where: and(
        eq(employees.isActive, true),
      ),
      columns: { id: true, departmentId: true },
    });
    departmentEmployees.forEach((employee: { id: string; departmentId: string }) => {
      if (employee.id !== supervisor.id && getEffectiveDepartmentId(employee, temporaryTargetDepartmentByEmployee) === supervisor.departmentId) {
        managedIds.add(employee.id);
      }
    });
  }

  return [...managedIds];
}

export async function getSupervisorDelegationById(id: string, tx: DbClient = db) {
  return tx.query.supervisorDelegations.findFirst({
    where: eq(supervisorDelegations.id, id),
    with: delegationRelations,
  });
}

async function getEmployeeByUserId(userId: string, tx: DbClient = db) {
  return tx.query.employees.findFirst({
    where: eq(employees.userId, userId),
    columns: { id: true, departmentId: true, userId: true, isActive: true },
  });
}

async function resolveUserRoles(userId: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { role: true },
  });
  const assignedRoles = tx === db ? await getUserRoleNames(userId) : [];
  return [...new Set([...(found?.role ?? []), ...assignedRoles].map((role) => role.toLowerCase()))];
}

function parseDateTime(value: string | Date, field: string) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} must be a valid date/time`);
  return date;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function getActiveTemporaryAssignmentRows(referenceDate: string, tx: DbClient) {
  return tx.query.temporaryDepartmentAssignments.findMany({
    where: and(
      eq(temporaryDepartmentAssignments.isActive, true),
      lte(temporaryDepartmentAssignments.effectiveFrom, referenceDate),
      gte(temporaryDepartmentAssignments.effectiveTo, referenceDate),
    ),
    columns: {
      employeeId: true,
      targetDepartmentId: true,
    },
  });
}

function getEffectiveDepartmentId(
  employee: { id: string; departmentId: string },
  temporaryTargetDepartmentByEmployee: Map<string, string>,
) {
  return temporaryTargetDepartmentByEmployee.get(employee.id) ?? employee.departmentId;
}

const delegationRelations = {
  supervisorUser: true,
  supervisorEmployee: { with: { department: true, position: true } },
  delegateUser: true,
  delegateEmployee: { with: { department: true, position: true } },
};
