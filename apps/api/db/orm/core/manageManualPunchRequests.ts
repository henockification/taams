import { eq } from 'drizzle-orm';
import { db } from '../../db';
import { employees, manualPunchRequests, user } from '../../schema';
import type {
  ChangeManualPunchRequestStatusInput,
  CreateManualPunchRequestInput,
} from '../../../types/core.types';
import { createAttendancePunch } from './manageBiometricDevices';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageHrUnits';

type DbClient = typeof db | any;

export async function createManualPunchRequest(input: CreateManualPunchRequestInput, scope?: EmployeeVisibilityScope) {
  await assertEmployeeExists(input.employeeId);
  if (scope) await assertCanAccessEmployee(input.employeeId, scope);

  if (!input.requestedBy) {
    throw new Error('requestedBy is required');
  }

  await assertUserExists(input.requestedBy);

  const [request] = await db
    .insert(manualPunchRequests)
    .values({
      employeeId: input.employeeId,
      requestedPunchTime: new Date(input.requestedPunchTime),
      requestedPunchType: input.requestedPunchType,
      reason: input.reason,
      requestedBy: input.requestedBy,
    } as any)
    .returning();

  return getManualPunchRequestById(request.id);
}

export async function getManualPunchRequests(scope?: EmployeeVisibilityScope) {
  const requests = await db.query.manualPunchRequests.findMany({
    with: {
      employee: {
        with: {
          department: true,
          hrUnit: true,
          position: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  if (!scope || scope.type === 'unrestricted') return requests;
  if (scope.type === 'hr_units') {
    return requests.filter((request) => request.employee?.hrUnitId && scope.hrUnitIds.includes(request.employee.hrUnitId));
  }
  return requests.filter((request) => request.employee?.userId === scope.userId);
}

export async function changeManualPunchRequestStatus(
  id: string,
  input: ChangeManualPunchRequestStatusInput,
  scope?: EmployeeVisibilityScope,
) {
  return db.transaction(async (tx) => {
    const request = await getManualPunchRequestById(id, tx);

    if (!request) {
      throw new Error('Manual punch request not found');
    }
    if (scope) await assertCanAccessEmployee(request.employeeId, scope, tx);

    if (request.status !== 'PENDING') {
      throw new Error('Manual punch request is already processed');
    }

    if (input.status === 'APPROVED') {
      const approvedBy = input.approvedBy;
      if (!approvedBy) {
        throw new Error('Approved by is required when approving a manual punch request');
      }

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
          status: 'APPROVED',
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

    const rejectedBy = input.rejectedBy;
    if (!rejectedBy) {
      throw new Error('Rejected by is required when rejecting a manual punch request');
    }

    await assertUserExists(rejectedBy, tx);

    const rejectedAt = input.rejectedAt ? new Date(input.rejectedAt) : new Date();

    await tx
      .update(manualPunchRequests)
      .set({
        status: 'REJECTED',
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
  });
}

export async function getManualPunchRequestById(id: string, tx: DbClient = db) {
  return tx.query.manualPunchRequests.findFirst({
    where: eq(manualPunchRequests.id, id),
    with: {
      employee: {
        with: {
          department: true,
          hrUnit: true,
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
