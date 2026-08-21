import { and, eq, gte, isNull, lte, ne, or } from 'drizzle-orm';
import { db } from '../../db';
import { biometricExemptions, employeeSupervisors, employees, positions, user } from '../../schema';
import type {
  BiometricExemptionTargetType,
  CreateBiometricExemptionInput,
  UpdateBiometricExemptionInput,
} from '../../../types/core.types';
import { resolveEmployeeBiometricExemptions } from '../../../lib/biometric-exemptions';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageEmployeeVisibility';

type DbClient = typeof db | any;
const SUPERVISOR_ROLE_NAMES = ['manager', 'department_manager', 'supervisor', 'department_head', 'admin', 'super_admin'];

export async function getBiometricExemptions(input: { scope?: EmployeeVisibilityScope; userId?: string; roles?: string[] | null } = {}) {
  const exemptions = await db.query.biometricExemptions.findMany({
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      position: true,
    },
    orderBy: (table, { desc }) => [desc(table.isActive), desc(table.createdAt)],
  });

  if (!input.scope || input.scope.type === 'unrestricted' || input.scope.type === 'hr') return exemptions;

  const managedEmployeeIds = input.userId ? await getManagedEmployeeIdsForUser(input.userId, input.roles) : [];
  return exemptions.filter((exemption) => (
    exemption.employee?.userId === input.userId || Boolean(exemption.employeeId && managedEmployeeIds.includes(exemption.employeeId))
  ));
}

export async function getBiometricExemptionById(id: string, tx: DbClient = db) {
  return tx.query.biometricExemptions.findFirst({
    where: eq(biometricExemptions.id, id),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      position: true,
    },
  });
}

export async function createBiometricExemption(input: CreateBiometricExemptionInput, tx: DbClient = db) {
  const { employeeId, positionId } = await normalizeTarget(input.targetType, input.targetId, tx);
  await assertNoActiveDuplicateExemption(input.targetType, input.targetId, undefined, tx);

  const [created] = await tx
    .insert(biometricExemptions)
    .values({
      employeeId,
      positionId,
      reason: input.reason.trim(),
      supportingEvidenceName: input.supportingEvidenceName ?? null,
      supportingEvidenceUrl: input.supportingEvidenceUrl ?? null,
      supportingEvidenceMimeType: input.supportingEvidenceMimeType ?? null,
      supportingEvidenceSize: input.supportingEvidenceSize ?? null,
      status: 'PENDING_SUPERVISOR',
      isActive: false,
      requestedBy: input.requestedBy ?? input.createdBy ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.updatedBy ?? input.createdBy ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .returning();

  return getBiometricExemptionById(created.id, tx);
}

export async function createBiometricExemptionScoped(input: CreateBiometricExemptionInput, scope: EmployeeVisibilityScope, tx: DbClient = db) {
  if (input.targetType !== 'EMPLOYEE') {
    if (scope.type !== 'unrestricted') throw new Error('Only unrestricted users can manage position biometric exemptions');
    return createBiometricExemption(input, tx);
  }
  await assertCanAccessEmployee(input.targetId, scope, tx);
  return createBiometricExemption(input, tx);
}

export async function updateBiometricExemption(
  id: string,
  input: UpdateBiometricExemptionInput,
  tx: DbClient = db,
) {
  const existing = await getBiometricExemptionById(id, tx);
  if (!existing) {
    throw new Error('Biometric exemption not found');
  }

  const targetType = input.targetType ?? existing.targetType;
  const targetId = input.targetId ?? (targetType === 'EMPLOYEE' ? existing.employeeId : existing.positionId);

  if (!targetId) {
    throw new Error('Biometric exemption target is required');
  }

  const { employeeId, positionId } = await normalizeTarget(targetType, targetId, tx);
  await assertNoActiveDuplicateExemption(targetType, targetId, id, tx);

  await tx
    .update(biometricExemptions)
    .set({
      employeeId,
      positionId,
      reason: input.reason?.trim() || existing.reason,
      supportingEvidenceName: input.supportingEvidenceName ?? existing.supportingEvidenceName ?? null,
      supportingEvidenceUrl: input.supportingEvidenceUrl ?? existing.supportingEvidenceUrl ?? null,
      supportingEvidenceMimeType: input.supportingEvidenceMimeType ?? existing.supportingEvidenceMimeType ?? null,
      supportingEvidenceSize: input.supportingEvidenceSize ?? existing.supportingEvidenceSize ?? null,
      isActive: existing.status === 'APPROVED' ? input.isActive ?? existing.isActive : false,
      updatedBy: input.updatedBy ?? input.createdBy ?? existing.updatedBy ?? existing.createdBy ?? null,
      updatedAt: new Date(),
    } as any)
    .where(eq(biometricExemptions.id, id));

  return getBiometricExemptionById(id, tx);
}

export async function updateBiometricExemptionScoped(
  id: string,
  input: UpdateBiometricExemptionInput,
  scope: EmployeeVisibilityScope,
  tx: DbClient = db,
) {
  const existing = await getBiometricExemptionById(id, tx);
  if (!existing) throw new Error('Biometric exemption not found');
  if (existing.employeeId) await assertCanAccessEmployee(existing.employeeId, scope, tx);
  if (!existing.employeeId && scope.type !== 'unrestricted') {
    throw new Error('Only unrestricted users can manage position biometric exemptions');
  }
  if (input.targetType === 'EMPLOYEE' && input.targetId) await assertCanAccessEmployee(input.targetId, scope, tx);
  if (input.targetType === 'POSITION' && scope.type !== 'unrestricted') {
    throw new Error('Only unrestricted users can manage position biometric exemptions');
  }
  return updateBiometricExemption(id, input, tx);
}

export async function deactivateBiometricExemption(id: string, updatedBy?: string | null, tx: DbClient = db) {
  await assertBiometricExemptionExists(id, tx);

  await tx
    .update(biometricExemptions)
    .set({
      isActive: false,
      status: 'INACTIVE',
      updatedBy: updatedBy ?? null,
      updatedAt: new Date(),
    })
    .where(eq(biometricExemptions.id, id));

  return getBiometricExemptionById(id, tx);
}

export async function changeBiometricExemptionStatus(
  id: string,
  input: {
    status: 'APPROVED' | 'REJECTED';
    reviewerUserId: string;
    rejectionReason?: string | null;
    roles?: string[] | null;
    scope?: EmployeeVisibilityScope;
  },
  tx: DbClient = db,
) {
  const existing = await getBiometricExemptionById(id, tx);
  if (!existing) throw new Error('Biometric exemption request not found');
  if (existing.status !== 'PENDING_SUPERVISOR') throw new Error('Biometric exemption request is already processed');
  await assertUserExists(input.reviewerUserId, tx);
  if (existing.employeeId) {
    await assertCanSupervisorReview(existing.employeeId, input, tx);
  } else if (input.scope?.type !== 'unrestricted') {
    throw new Error('Only unrestricted users can approve position biometric exemption requests');
  }

  if (input.status === 'APPROVED') {
    if (existing.employeeId) {
      await assertNoActiveDuplicateExemption('EMPLOYEE', existing.employeeId, id, tx);
    } else if (existing.positionId) {
      await assertNoActiveDuplicateExemption('POSITION', existing.positionId, id, tx);
    }
    await tx
      .update(biometricExemptions)
      .set({
        status: 'APPROVED',
        isActive: true,
        approvedBy: input.reviewerUserId,
        approvedAt: new Date(),
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        updatedBy: input.reviewerUserId,
        updatedAt: new Date(),
      })
      .where(eq(biometricExemptions.id, id));
  } else {
    await tx
      .update(biometricExemptions)
      .set({
        status: 'REJECTED',
        isActive: false,
        rejectedBy: input.reviewerUserId,
        rejectedAt: new Date(),
        rejectionReason: input.rejectionReason?.trim() || null,
        updatedBy: input.reviewerUserId,
        updatedAt: new Date(),
      })
      .where(eq(biometricExemptions.id, id));
  }

  return getBiometricExemptionById(id, tx);
}

export async function deactivateBiometricExemptionScoped(
  id: string,
  scope: EmployeeVisibilityScope,
  updatedBy?: string | null,
  tx: DbClient = db,
) {
  const existing = await getBiometricExemptionById(id, tx);
  if (!existing) throw new Error('Biometric exemption not found');
  if (existing.employeeId) await assertCanAccessEmployee(existing.employeeId, scope, tx);
  if (!existing.employeeId && scope.type !== 'unrestricted') {
    throw new Error('Only unrestricted users can manage position biometric exemptions');
  }
  return deactivateBiometricExemption(id, updatedBy, tx);
}

export async function getActiveBiometricExemptionsForEmployee(employeeId: string, tx: DbClient = db) {
  const employee = await assertEmployeeExists(employeeId, tx);
  const conditions = [eq(biometricExemptions.employeeId, employeeId)];

  if (employee.positionId) {
    conditions.push(eq(biometricExemptions.positionId, employee.positionId));
  }

  const exemptions = await tx.query.biometricExemptions.findMany({
    where: and(eq(biometricExemptions.isActive, true), or(...conditions)),
    columns: {
      employeeId: true,
      positionId: true,
      isActive: true,
    },
  });

  return resolveEmployeeBiometricExemptions(
    { id: employee.id, positionId: employee.positionId ?? null },
    exemptions,
  );
}

export async function getBiometricExemptionsForEmployee(employeeId: string, tx: DbClient = db) {
  const employee = await assertEmployeeExists(employeeId, tx);
  const conditions = [eq(biometricExemptions.employeeId, employeeId)];

  if (employee.positionId) {
    conditions.push(eq(biometricExemptions.positionId, employee.positionId));
  }

  return tx.query.biometricExemptions.findMany({
    where: and(eq(biometricExemptions.isActive, true), or(...conditions)),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      position: true,
    },
  });
}

export async function isEmployeeBiometricExempt(employeeId: string, tx: DbClient = db) {
  const employee = await assertEmployeeExists(employeeId, tx);
  const exemptions = await getBiometricExemptionsForEmployee(employee.id, tx);

  return resolveEmployeeBiometricExemptions(
    { id: employee.id, positionId: employee.positionId ?? null },
    exemptions.map((exemption: { employeeId: string | null; positionId: string | null; isActive: boolean }) => ({
      employeeId: exemption.employeeId,
      positionId: exemption.positionId,
      isActive: exemption.isActive,
    })),
  ).isExempt;
}

async function assertBiometricExemptionExists(id: string, tx: DbClient = db) {
  const exemption = await tx.query.biometricExemptions.findFirst({
    where: eq(biometricExemptions.id, id),
  });

  if (!exemption) {
    throw new Error('Biometric exemption not found');
  }

  return exemption;
}

async function assertEmployeeExists(id: string, tx: DbClient = db) {
  const employee = await tx.query.employees.findFirst({
    where: eq(employees.id, id),
  });

  if (!employee) {
    throw new Error('Employee not found');
  }

  return employee;
}

async function assertUserExists(id: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, id),
    columns: { id: true },
  });
  if (!found) throw new Error('User not found');
}

async function assertCanSupervisorReview(employeeId: string, context: { scope?: EmployeeVisibilityScope; reviewerUserId: string; roles?: string[] | null }, tx: DbClient) {
  if (context.scope?.type === 'unrestricted') return;
  const managedEmployeeIds = await getManagedEmployeeIdsForUser(context.reviewerUserId, context.roles, tx);
  if (managedEmployeeIds.includes(employeeId)) return;
  throw new Error('Only the assigned supervisor or department manager can approve this biometric exemption request');
}

async function getManagedEmployeeIdsForUser(userId: string, roles?: string[] | null, tx: DbClient = db) {
  const supervisor = await tx.query.employees.findFirst({
    where: eq(employees.userId, userId),
    columns: { id: true, departmentId: true },
  });
  if (!supervisor) return [];

  const managedIds = new Set<string>();
  const today = new Date().toISOString().slice(0, 10);
  const assignments = await tx.query.employeeSupervisors.findMany({
    where: and(
      eq(employeeSupervisors.supervisorId, supervisor.id),
      lte(employeeSupervisors.effectiveFrom, today),
      or(isNull(employeeSupervisors.effectiveTo), gte(employeeSupervisors.effectiveTo, today)),
    ),
    columns: { employeeId: true },
  });
  assignments.forEach((assignment: any) => managedIds.add(assignment.employeeId));

  const normalizedRoles = (roles ?? []).map((role) => role.toLowerCase());
  if (normalizedRoles.some((role) => SUPERVISOR_ROLE_NAMES.includes(role))) {
    const departmentEmployees = await tx.query.employees.findMany({
      where: and(eq(employees.departmentId, supervisor.departmentId), eq(employees.isActive, true)),
      columns: { id: true },
    });
    departmentEmployees.forEach((employee: any) => {
      if (employee.id !== supervisor.id) managedIds.add(employee.id);
    });
  }

  return [...managedIds];
}

async function assertPositionExists(id: string, tx: DbClient = db) {
  const position = await tx.query.positions.findFirst({
    where: eq(positions.id, id),
  });

  if (!position) {
    throw new Error('Position not found');
  }

  return position;
}

async function normalizeTarget(targetType: BiometricExemptionTargetType, targetId: string, tx: DbClient = db) {
  if (targetType === 'EMPLOYEE') {
    await assertEmployeeExists(targetId, tx);
    return { employeeId: targetId, positionId: null };
  }

  await assertPositionExists(targetId, tx);
  return { employeeId: null, positionId: targetId };
}

async function assertNoActiveDuplicateExemption(
  targetType: BiometricExemptionTargetType,
  targetId: string,
  exemptionId: string | undefined,
  tx: DbClient = db,
) {
  const targetColumn = targetType === 'EMPLOYEE' ? biometricExemptions.employeeId : biometricExemptions.positionId;
  const conditions = [eq(biometricExemptions.isActive, true), eq(targetColumn, targetId)];
  if (exemptionId) {
    conditions.push(ne(biometricExemptions.id, exemptionId));
  }

  const duplicate = await tx.query.biometricExemptions.findFirst({
    where: and(...conditions),
  });

  if (duplicate) {
    throw new Error(targetType === 'EMPLOYEE'
      ? 'An active biometric exemption already exists for this employee'
      : 'An active biometric exemption already exists for this position');
  }
}
