import { and, eq, inArray, isNull } from 'drizzle-orm';
import { PENDING_CORRECTION_STATUSES } from '../../../lib/attendance/correction-status';
import { db } from '../../db';
import { attendanceDailyRecords, attendancePunches, employees, manualPunchRequests, user } from '../../schema';
import { addisToday } from '../../../lib/attendance/schedule-evaluator';
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
  diffChanges,
  employeeAuditFields,
  formatEmployeeLabel,
  writeAuditEvent,
} from '../../../lib/audit';

type DbClient = typeof db | any;

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
      status: 'PENDING_REVIEW',
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

/**
 * The employee may change their own correction request (time, type, reason) until
 * a supervisor or HR has decided on it.
 */
export async function updateOwnManualPunchRequest(
  id: string,
  input: { requestedPunchTime: string; requestedPunchType: string; reason: string },
  actorUserId: string,
) {
  const request = await getManualPunchRequestById(id);
  if (!request) throw new Error('Manual punch request not found');
  if (request.requestedBy !== actorUserId && request.employee?.userId !== actorUserId) {
    throw new Error('Manual punch request not found');
  }
  if (!PENDING_CORRECTION_STATUSES.includes(request.status)) {
    throw new Error('This correction request has already been reviewed and cannot be edited');
  }

  const requestedPunchTime = new Date(input.requestedPunchTime);
  const updated = await db.transaction(async (tx) => {
    // Guard on status so an edit cannot overwrite a request approved in the meantime.
    const [row] = await tx.update(manualPunchRequests)
      .set({
        requestedPunchTime,
        requestedPunchType: input.requestedPunchType,
        reason: input.reason.trim(),
        updatedAt: new Date(),
      } as any)
      .where(and(eq(manualPunchRequests.id, id), inArray(manualPunchRequests.status, PENDING_CORRECTION_STATUSES)))
      .returning({ id: manualPunchRequests.id });
    if (!row) throw new Error('This correction request has already been reviewed and cannot be edited');

    await writeAuditEvent(tx, {
      action: 'MANUAL_PUNCH_UPDATED',
      resourceType: 'manual_punch_request',
      resourceId: id,
      resourceLabel: `${formatEmployeeLabel(request.employee)} attendance correction`,
      ...employeeAuditFields(request.employee),
      changes: diffChanges(
        { requestedPunchTime: new Date(request.requestedPunchTime).toISOString(), requestedPunchType: request.requestedPunchType, reason: request.reason },
        { requestedPunchTime: requestedPunchTime.toISOString(), requestedPunchType: input.requestedPunchType, reason: input.reason.trim() },
      ),
    });
    return getManualPunchRequestById(id, tx);
  });
  return updated;
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
      if (context.scope?.type !== 'hr' && context.scope?.type !== 'hr-departments' && context.scope?.type !== 'unrestricted') {
        throw new Error('Only HR can review attendance correction requests');
      }
      if (context.scope) await assertCanAccessEmployee(request.employeeId, context.scope, tx);

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
          employeeCode: true,
        },
      });

      if (!employee) {
        throw new Error('Employee not found');
      }

      // Biometric IDs match the employee code; older records may lack one.
      const biometricId = employee.biometricId?.trim() || employee.employeeCode.trim();
      const punch = {
        employeeId: employee.id,
        biometricId,
        punchTime: request.requestedPunchTime,
        punchType: request.requestedPunchType,
        source: 'MANUAL' as const,
        isManual: true,
        manualReason: request.reason,
        approvedBy,
        approvedAt: approvedAt.toISOString(),
        supervisorDelegationId: actionContext.supervisorDelegationId,
      };
      // A manual punch at exactly this time may already exist; reuse it.
      const attendancePunch = await createAttendancePunch(punch, tx, { ignoreDuplicates: true })
        ?? await tx.query.attendancePunches.findFirst({
          where: and(
            eq(attendancePunches.biometricId, biometricId),
            eq(attendancePunches.punchTime, new Date(request.requestedPunchTime)),
            isNull(attendancePunches.deviceId),
          ),
        });

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
      const rejectionReason = input.rejectionReason?.trim();
      if (!rejectionReason) {
        throw new Error('Rejection reason is required');
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
          rejectionReason,
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
    // Apply the approved correction to the day's attendance even when that day
    // was already approved, otherwise payroll keeps the uncorrected record.
    const punchDate = toDateKey(new Date(result.manualPunchRequest.requestedPunchTime));
    const employeeId = result.manualPunchRequest.employeeId;
    const previous = await db.query.attendanceDailyRecords.findFirst({
      where: and(eq(attendanceDailyRecords.employeeId, employeeId), eq(attendanceDailyRecords.attendanceDate, punchDate)),
      columns: { id: true, status: true },
    });
    const { generateAttendanceDailyRecords } = await import('./manageAttendanceApprovals');
    await generateAttendanceDailyRecords(punchDate, { recalculateEmployeeIds: [employeeId] });
    if (previous?.status === 'HR_APPROVED') {
      await writeAuditEvent(db, {
        action: 'ATTENDANCE_REOPENED_AFTER_CORRECTION',
        resourceType: 'attendance_daily_record',
        resourceId: previous.id,
        resourceLabel: `${formatEmployeeLabel(result.manualPunchRequest.employee)} attendance ${punchDate}`,
        ...employeeAuditFields(result.manualPunchRequest.employee),
        changes: { status: { from: 'HR_APPROVED', to: 'SUPERVISOR_APPROVED' } },
        metadata: { manualPunchRequestId: result.manualPunchRequest.id },
      });
    }
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
  return PENDING_CORRECTION_STATUSES.includes(status);
}

// Attendance dates are Addis Ababa calendar days, independent of the server time zone.
function toDateKey(value: Date) {
  return addisToday(value);
}
