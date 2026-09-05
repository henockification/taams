import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { employees, manualPunchRequests, user } from '../../schema';
import type {
  ChangeManualPunchRequestStatusInput,
  CreateManualPunchRequestInput,
} from '../../../types/core.types';
import { createAttendancePunch } from './manageBiometricDevices';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageEmployeeVisibility';
import {
  getVisibleEmployeeIdsForSupervisorActor,
  resolveSupervisorActionContext,
} from './manageSupervisorDelegations';
import {
  employeeAuditFields,
  formatEmployeeLabel,
  writeAuditEvent,
} from '../../../lib/audit';

type DbClient = typeof db | any;
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

  const created = await getManualPunchRequestById(request.id);
  await writeAuditEvent(db, {
    action: 'MANUAL_PUNCH_SUBMITTED',
    resourceType: 'manual_punch_request',
    resourceId: request.id,
    resourceLabel: `${formatEmployeeLabel(created?.employee)} attendance correction`,
    ...employeeAuditFields(created?.employee),
  });
  return created;
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

  if (!input.userId) return [];
  const visibleRequests = [];
  const visibleIdsByDate = new Map<string, string[]>();

  for (const request of requests) {
    const referenceDate = toDateKey(new Date(request.requestedPunchTime));
    let managedEmployeeIds = visibleIdsByDate.get(referenceDate);
    if (!managedEmployeeIds) {
      managedEmployeeIds = await getVisibleEmployeeIdsForSupervisorActor(input.userId, input.roles, db, referenceDate);
      visibleIdsByDate.set(referenceDate, managedEmployeeIds);
    }
    if (managedEmployeeIds.includes(request.employeeId)) visibleRequests.push(request);
  }

  return visibleRequests;
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

      const reviewed = await getManualPunchRequestById(id, tx);
      await writeAuditEvent(tx, {
        action: input.status === 'HR_REJECTED' ? 'MANUAL_PUNCH_HR_REJECTED' : 'MANUAL_PUNCH_HR_REVIEWED',
        resourceType: 'manual_punch_request',
        resourceId: id,
        resourceLabel: `${formatEmployeeLabel(request.employee)} attendance correction`,
        ...employeeAuditFields(request.employee),
        changes: { status: { from: request.status, to: input.status } },
      });
      return {
        manualPunchRequest: reviewed,
        attendancePunch: null,
      };
    }

    if (input.status === 'SUPERVISOR_APPROVED' || input.status === 'APPROVED') {
      if (!canSupervisorDecide(request.status)) {
        throw new Error('This correction request cannot be approved');
      }

      const approvedBy = context.reviewerUserId ?? input.approvedBy;
      if (!approvedBy) throw new Error('Approved by is required when approving a correction request');
      await assertUserExists(approvedBy, tx);
      const actionContext = await resolveSupervisorActionContext({
        actorUserId: approvedBy,
        roles: context.roles,
        targetEmployeeId: request.employeeId,
        referenceDate: toDateKey(new Date(request.requestedPunchTime)),
        tx,
      });
      if (request.employee?.userId === approvedBy) {
        throw new Error('Cannot approve your own attendance correction');
      }

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
        supervisorDelegationId: actionContext.supervisorDelegationId,
      }, tx);

      await tx
        .update(manualPunchRequests)
        .set({
          status: 'SUPERVISOR_APPROVED',
          approvedBy,
          approvedAt,
          supervisorDelegationId: actionContext.supervisorDelegationId,
          rejectedBy: null,
          rejectedAt: null,
          rejectionReason: null,
          updatedAt: new Date(),
        })
        .where(eq(manualPunchRequests.id, id));

      const approvedRequest = await getManualPunchRequestById(id, tx);
      await writeAuditEvent(tx, {
        action: 'MANUAL_PUNCH_APPROVED',
        resourceType: 'manual_punch_request',
        resourceId: id,
        resourceLabel: `${formatEmployeeLabel(request.employee)} attendance correction`,
        ...employeeAuditFields(request.employee),
        supervisorDelegationId: actionContext.supervisorDelegationId,
        changes: { status: { from: request.status, to: 'SUPERVISOR_APPROVED' } },
      });
      return {
        manualPunchRequest: approvedRequest,
        attendancePunch,
      };
    }

    if (input.status === 'SUPERVISOR_REJECTED' || input.status === 'REJECTED') {
      if (!canSupervisorDecide(request.status)) {
        throw new Error('This correction request cannot be rejected');
      }

      const rejectedBy = context.reviewerUserId ?? input.rejectedBy;
      if (!rejectedBy) {
        throw new Error('Rejected by is required when rejecting a correction request');
      }

      await assertUserExists(rejectedBy, tx);
      const actionContext = await resolveSupervisorActionContext({
        actorUserId: rejectedBy,
        roles: context.roles,
        targetEmployeeId: request.employeeId,
        referenceDate: toDateKey(new Date(request.requestedPunchTime)),
        tx,
      });

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
          supervisorDelegationId: actionContext.supervisorDelegationId,
          updatedAt: new Date(),
        })
        .where(eq(manualPunchRequests.id, id));

      const rejectedRequest = await getManualPunchRequestById(id, tx);
      await writeAuditEvent(tx, {
        action: 'MANUAL_PUNCH_REJECTED',
        resourceType: 'manual_punch_request',
        resourceId: id,
        resourceLabel: `${formatEmployeeLabel(request.employee)} attendance correction`,
        ...employeeAuditFields(request.employee),
        supervisorDelegationId: actionContext.supervisorDelegationId,
        changes: { status: { from: request.status, to: 'SUPERVISOR_REJECTED' } },
      });
      return {
        manualPunchRequest: rejectedRequest,
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
