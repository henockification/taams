import { and, eq, gte, lte, or, isNull } from 'drizzle-orm';
import { db } from '../../db';
import { employeeSupervisors, employees, manualPunchRequests, user } from '../../schema';
import type {
  ChangeManualPunchRequestStatusInput,
  CreateManualPunchRequestInput,
} from '../../../types/core.types';
import { createAttendancePunch } from './manageBiometricDevices';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageEmployeeVisibility';

type DbClient = typeof db | any;
const SUPERVISOR_ROLE_NAMES = ['supervisor', 'admin', 'super_admin', 'superadmin'];
const HR_ROLE_NAMES = ['human_resource'];

export async function createManualPunchRequest(input: CreateManualPunchRequestInput, scope?: EmployeeVisibilityScope) {
  if (!input.requestedBy) {
    throw new Error('requestedBy is required');
  }

  await assertUserExists(input.requestedBy);

  const actorEmployee = await db.query.employees.findFirst({
    where: eq(employees.userId, input.requestedBy),
    columns: { id: true },
  });
  if (!actorEmployee) throw new Error('No employee profile is linked to this user');

  const employeeId = actorEmployee.id;
  await assertEmployeeExists(employeeId);
  if (scope) await assertCanAccessEmployee(employeeId, scope);

  const [request] = await db
    .insert(manualPunchRequests)
    .values({
      employeeId,
      requestedPunchTime: new Date(input.requestedPunchTime),
      requestedPunchType: input.requestedPunchType,
      reason: input.reason,
      supportingDocumentName: input.supportingDocumentName ?? null,
      supportingDocumentUrl: input.supportingDocumentUrl ?? null,
      supportingDocumentMimeType: input.supportingDocumentMimeType ?? null,
      supportingDocumentSize: input.supportingDocumentSize ?? null,
      requestedBy: input.requestedBy,
    } as any)
    .returning();

  return getManualPunchRequestById(request.id);
}

export async function getManualPunchRequests(input: {
  scope?: EmployeeVisibilityScope;
  userId?: string;
  roles?: string[] | null;
  mine?: boolean;
} = {}) {
  const requests = await db.query.manualPunchRequests.findMany({
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (input.mine) {
    return requests.filter((request) => request.employee?.userId === input.userId);
  }

  const roles = (input.roles ?? []).map((role) => role.toLowerCase());
  const isHrRole = roles.some((role) => HR_ROLE_NAMES.includes(role));
  if (!input.scope || input.scope.type === 'unrestricted' || isHrRole) return requests;

  const managedEmployeeIds = input.userId ? await getManagedEmployeeIdsForUser(input.userId, input.roles) : [];
  return requests.filter((request) => managedEmployeeIds.includes(request.employeeId));
}

export async function changeManualPunchRequestStatus(
  id: string,
  input: ChangeManualPunchRequestStatusInput,
  context: { scope?: EmployeeVisibilityScope; reviewerUserId?: string; roles?: string[] | null } = {},
) {
  const result = await db.transaction(async (tx) => {
    const request = await getManualPunchRequestById(id, tx);

    if (!request) {
      throw new Error('Manual punch request not found');
    }
    if (isProcessedStatus(request.status)) {
      throw new Error('Manual punch request is already processed');
    }

    if (input.status === 'HR_REVIEWED' || input.status === 'HR_REJECTED') {
      if (context.scope?.type !== 'hr' && context.scope?.type !== 'unrestricted') {
        throw new Error('Only HR can review attendance correction requests');
      }

      const hrReviewedBy = context.reviewerUserId ?? input.hrReviewedBy;
      if (!hrReviewedBy) throw new Error('HR reviewer is required');
      await assertUserExists(hrReviewedBy, tx);

      const hrReviewedAt = input.hrReviewedAt ? new Date(input.hrReviewedAt) : new Date();

      await tx
        .update(manualPunchRequests)
        .set({
          status: input.status,
          hrReviewedBy,
          hrReviewedAt,
          hrReviewNote: input.hrReviewNote?.trim() || null,
          rejectedBy: input.status === 'HR_REJECTED' ? hrReviewedBy : null,
          rejectedAt: input.status === 'HR_REJECTED' ? hrReviewedAt : null,
          rejectionReason: input.status === 'HR_REJECTED' ? input.rejectionReason ?? null : null,
          updatedAt: new Date(),
        })
        .where(eq(manualPunchRequests.id, id));

      return {
        manualPunchRequest: await getManualPunchRequestById(id, tx),
        attendancePunch: null,
      };
    }

    if (input.status === 'SUPERVISOR_APPROVED' || input.status === 'APPROVED') {
      if (!canSupervisorDecide(request.status)) {
        throw new Error('This correction request cannot be approved');
      }

      await assertCanSupervisorReview(request.employeeId, context, tx);
      if (request.employee?.userId === context.reviewerUserId) {
        throw new Error('Cannot approve your own attendance correction');
      }
      const approvedBy = context.reviewerUserId ?? input.approvedBy;
      if (!approvedBy) throw new Error('Approved by is required when approving a correction request');
      await assertUserExists(approvedBy, tx);

      const approvedAt = input.approvedAt ? new Date(input.approvedAt) : new Date();
      const employee = await tx.query.employees.findFirst({
        where: eq(employees.id, request.employeeId),
        columns: {
          id: true,
          biometricId: true,
        },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      if (!employee.biometricId) {
        throw new Error('Employee biometric ID is required to approve manual punch requests');
      }

      const attendancePunch = await createAttendancePunch({
        employeeId: employee.id,
        biometricId: employee.biometricId,
        punchTime: request.requestedPunchTime,
        punchType: request.requestedPunchType,
        source: 'MANUAL',
        isManual: true,
        manualReason: request.reason,
        approvedBy,
        approvedAt: approvedAt.toISOString(),
      }, tx);

      await tx
        .update(manualPunchRequests)
        .set({
          status: 'SUPERVISOR_APPROVED',
          approvedBy,
          approvedAt,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(manualPunchRequests.id, id));

      return {
        manualPunchRequest: await getManualPunchRequestById(id, tx),
        attendancePunch,
      };
    }

    if (input.status === 'SUPERVISOR_REJECTED' || input.status === 'REJECTED') {
      if (!canSupervisorDecide(request.status)) {
        throw new Error('This correction request cannot be rejected');
      }

      await assertCanSupervisorReview(request.employeeId, context, tx);
      const rejectedBy = context.reviewerUserId ?? input.rejectedBy;
      if (!rejectedBy) {
        throw new Error('Rejected by is required when rejecting a correction request');
      }

      await assertUserExists(rejectedBy, tx);

      const rejectedAt = input.rejectedAt ? new Date(input.rejectedAt) : new Date();

      await tx
        .update(manualPunchRequests)
        .set({
          status: 'SUPERVISOR_REJECTED',
          approvedBy: null,
          approvedAt: null,
          rejectedBy,
          rejectedAt,
          rejectionReason: input.rejectionReason ?? null,
          updatedAt: new Date(),
        })
        .where(eq(manualPunchRequests.id, id));

      return {
        manualPunchRequest: await getManualPunchRequestById(id, tx),
        attendancePunch: null,
      };
    }

    throw new Error('Unsupported correction request status');
  });

  if (result.attendancePunch && result.manualPunchRequest?.requestedPunchTime) {
    const punchDate = toDateKey(new Date(result.manualPunchRequest.requestedPunchTime));
    const { generateAttendanceDailyRecords } = await import('./manageAttendanceApprovals');
    await generateAttendanceDailyRecords(punchDate);
  }

  return result;
}

export async function getManualPunchRequestById(id: string, tx: DbClient = db) {
  return tx.query.manualPunchRequests.findFirst({
    where: eq(manualPunchRequests.id, id),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
    },
  });
}

async function assertEmployeeExists(id: string, tx: DbClient = db) {
  const found = await tx.query.employees.findFirst({
    where: eq(employees.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Employee not found');
}

async function assertUserExists(id: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('User not found');
}

function isProcessedStatus(status: string) {
  return ['HR_REJECTED', 'SUPERVISOR_APPROVED', 'SUPERVISOR_REJECTED', 'APPROVED', 'REJECTED'].includes(status);
}

function canSupervisorDecide(status: string) {
  return status === 'PENDING_HR_REVIEW' || status === 'HR_REVIEWED' || status === 'PENDING';
}

function toDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function assertCanSupervisorReview(employeeId: string, context: { scope?: EmployeeVisibilityScope; reviewerUserId?: string; roles?: string[] | null }, tx: DbClient) {
  if (context.scope?.type === 'unrestricted') return;
  if (!context.reviewerUserId) throw new Error('Reviewer is required');
  const managedEmployeeIds = await getManagedEmployeeIdsForUser(context.reviewerUserId, context.roles, tx);
  if (managedEmployeeIds.includes(employeeId)) return;
  throw new Error('Only the assigned supervisor can approve this correction request');
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
      where: and(
        eq(employees.departmentId, supervisor.departmentId),
        eq(employees.isActive, true),
      ),
      columns: { id: true },
    });
    departmentEmployees.forEach((employee: any) => {
      if (employee.id !== supervisor.id) managedIds.add(employee.id);
    });
  }

  return [...managedIds];
}
