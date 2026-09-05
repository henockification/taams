import { and, desc, eq, gte, lte, ne, or } from 'drizzle-orm';
import { db } from '../../db';
import { departments, employees, temporaryDepartmentAssignments } from '../../schema';
import type {
  CreateTemporaryDepartmentAssignmentInput,
  UpdateTemporaryDepartmentAssignmentInput,
} from '../../../types/core.types';
import type { EmployeeVisibilityScope } from './manageEmployeeVisibility';
import { getVisibleEmployeeIdsForSupervisorActor } from './manageSupervisorDelegations';
import { employeeAuditFields, formatEmployeeLabel, writeAuditEvent } from '../../../lib/audit';

type DbClient = typeof db | any;

type AssignmentContext = {
  userId: string;
  roles?: string[] | null;
  scope?: EmployeeVisibilityScope;
};

export async function getTemporaryDepartmentAssignments(context: AssignmentContext) {
  const assignments = await db.query.temporaryDepartmentAssignments.findMany({
    with: assignmentRelations,
    orderBy: (table, { desc }) => [desc(table.effectiveFrom), desc(table.createdAt)],
  });

  if (canManageAll(context.scope)) return assignments;

  const managedIds = await getVisibleEmployeeIdsForSupervisorActor(context.userId, context.roles);
  return assignments.filter((assignment) => managedIds.includes(assignment.employeeId) || assignment.createdBy === context.userId);
}

export async function createTemporaryDepartmentAssignment(input: CreateTemporaryDepartmentAssignmentInput, context: AssignmentContext) {
  const effectiveFrom = parseDate(input.effectiveFrom, 'effectiveFrom');
  const effectiveTo = parseDate(input.effectiveTo, 'effectiveTo');
  if (effectiveFrom > effectiveTo) throw new Error('Assignment start date must be on or before end date');

  return db.transaction(async (tx) => {
    const employee = await tx.query.employees.findFirst({
      where: eq(employees.id, input.employeeId),
      columns: { id: true, departmentId: true, isActive: true },
    });
    if (!employee) throw new Error('Employee not found');
    if (!employee.isActive) throw new Error('Employee must be active');

    const targetDepartment = await tx.query.departments.findFirst({
      where: eq(departments.id, input.targetDepartmentId),
      columns: { id: true, isActive: true },
    });
    if (!targetDepartment) throw new Error('Target department not found');
    if (!targetDepartment.isActive) throw new Error('Target department must be active');
    if (employee.departmentId === input.targetDepartmentId) {
      throw new Error('Temporary assignment target must be different from the home department');
    }

    await assertCanManageEmployeeAssignment(employee.id, effectiveFrom, context, tx);
    await assertNoOverlap(employee.id, effectiveFrom, effectiveTo, null, tx);

    const [createdRow] = await tx.insert(temporaryDepartmentAssignments).values({
      employeeId: employee.id,
      sourceDepartmentId: employee.departmentId,
      targetDepartmentId: input.targetDepartmentId,
      effectiveFrom,
      effectiveTo,
      reason: input.reason.trim(),
      createdBy: context.userId,
    } as any).returning();

    const created = await getTemporaryDepartmentAssignmentById(createdRow.id, tx);
    await writeAuditEvent(tx, {
      action: 'TEMPORARY_ASSIGNMENT_CREATED',
      resourceType: 'temporary_department_assignment',
      resourceId: createdRow.id,
      resourceLabel: `${formatEmployeeLabel(created?.employee)} temporary assignment`,
      ...employeeAuditFields(created?.employee ?? employee),
      departmentId: input.targetDepartmentId,
    });
    return created;
  });
}

export async function updateTemporaryDepartmentAssignment(
  id: string,
  input: UpdateTemporaryDepartmentAssignmentInput,
  context: AssignmentContext,
) {
  return db.transaction(async (tx) => {
    const existing = await getTemporaryDepartmentAssignmentById(id, tx);
    if (!existing) throw new Error('Temporary department assignment not found');
    if (!existing.isActive) throw new Error('Inactive assignments cannot be edited');

    const effectiveFrom = input.effectiveFrom ? parseDate(input.effectiveFrom, 'effectiveFrom') : existing.effectiveFrom;
    const effectiveTo = input.effectiveTo ? parseDate(input.effectiveTo, 'effectiveTo') : existing.effectiveTo;
    if (effectiveFrom > effectiveTo) throw new Error('Assignment start date must be on or before end date');

    const targetDepartmentId = input.targetDepartmentId ?? existing.targetDepartmentId;
    const targetDepartment = await tx.query.departments.findFirst({
      where: eq(departments.id, targetDepartmentId),
      columns: { id: true, isActive: true },
    });
    if (!targetDepartment) throw new Error('Target department not found');
    if (!targetDepartment.isActive) throw new Error('Target department must be active');
    if (existing.sourceDepartmentId === targetDepartmentId) {
      throw new Error('Temporary assignment target must be different from the home department');
    }

    await assertCanManageEmployeeAssignment(existing.employeeId, effectiveFrom, context, tx, existing.createdBy);
    await assertNoOverlap(existing.employeeId, effectiveFrom, effectiveTo, id, tx);

    await tx.update(temporaryDepartmentAssignments)
      .set({
        targetDepartmentId,
        effectiveFrom,
        effectiveTo,
        reason: input.reason === undefined ? existing.reason : input.reason.trim(),
        updatedAt: new Date(),
      } as any)
      .where(eq(temporaryDepartmentAssignments.id, id));

    const updated = await getTemporaryDepartmentAssignmentById(id, tx);
    await writeAuditEvent(tx, {
      action: 'TEMPORARY_ASSIGNMENT_UPDATED',
      resourceType: 'temporary_department_assignment',
      resourceId: id,
      resourceLabel: `${formatEmployeeLabel(existing.employee)} temporary assignment`,
      ...employeeAuditFields(existing.employee),
      departmentId: targetDepartmentId,
    });
    return updated;
  });
}

export async function deactivateTemporaryDepartmentAssignment(id: string, context: AssignmentContext) {
  return db.transaction(async (tx) => {
    const existing = await getTemporaryDepartmentAssignmentById(id, tx);
    if (!existing) throw new Error('Temporary department assignment not found');
    await assertCanManageEmployeeAssignment(existing.employeeId, existing.effectiveFrom, context, tx, existing.createdBy);

    await tx.update(temporaryDepartmentAssignments)
      .set({ isActive: false, updatedAt: new Date() } as any)
      .where(eq(temporaryDepartmentAssignments.id, id));

    const deactivated = await getTemporaryDepartmentAssignmentById(id, tx);
    await writeAuditEvent(tx, {
      action: 'TEMPORARY_ASSIGNMENT_DEACTIVATED',
      resourceType: 'temporary_department_assignment',
      resourceId: id,
      resourceLabel: `${formatEmployeeLabel(existing.employee)} temporary assignment`,
      ...employeeAuditFields(existing.employee),
    });
    return deactivated;
  });
}

export async function getActiveTemporaryDepartmentAssignments(referenceDate: string, tx: DbClient = db) {
  return tx.query.temporaryDepartmentAssignments.findMany({
    where: and(
      eq(temporaryDepartmentAssignments.isActive, true),
      lte(temporaryDepartmentAssignments.effectiveFrom, referenceDate),
      gte(temporaryDepartmentAssignments.effectiveTo, referenceDate),
    ),
    with: assignmentRelations,
  });
}

export async function getTemporaryDepartmentAssignmentById(id: string, tx: DbClient = db) {
  return tx.query.temporaryDepartmentAssignments.findFirst({
    where: eq(temporaryDepartmentAssignments.id, id),
    with: assignmentRelations,
  });
}

async function assertNoOverlap(employeeId: string, effectiveFrom: string, effectiveTo: string, excludeId: string | null, tx: DbClient) {
  const overlapping = await tx.query.temporaryDepartmentAssignments.findFirst({
    where: and(
      eq(temporaryDepartmentAssignments.employeeId, employeeId),
      eq(temporaryDepartmentAssignments.isActive, true),
      excludeId ? ne(temporaryDepartmentAssignments.id, excludeId) : undefined,
      lte(temporaryDepartmentAssignments.effectiveFrom, effectiveTo),
      gte(temporaryDepartmentAssignments.effectiveTo, effectiveFrom),
    ),
    columns: { id: true },
  });

  if (overlapping) throw new Error('Employee already has an active temporary department assignment in this date range');
}

async function assertCanManageEmployeeAssignment(
  employeeId: string,
  referenceDate: string,
  context: AssignmentContext,
  tx: DbClient,
  createdBy?: string | null,
) {
  if (canManageAll(context.scope)) return;
  if (createdBy && createdBy === context.userId) return;
  const managedIds = await getVisibleEmployeeIdsForSupervisorActor(context.userId, context.roles, tx, referenceDate);
  if (managedIds.includes(employeeId)) return;
  throw new Error('You do not have permission to manage temporary assignments for this employee');
}

function canManageAll(scope?: EmployeeVisibilityScope) {
  return scope?.type === 'unrestricted' || scope?.type === 'hr';
}

function parseDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must be a valid date`);
  return value;
}

const assignmentRelations = {
  employee: { with: { department: true, position: true } },
  sourceDepartment: true,
  targetDepartment: true,
  creator: true,
} as const;
