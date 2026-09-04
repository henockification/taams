import { and, asc, eq, gte, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  annualLeaveRequestDates,
  attendanceDailyRecords,
  employeeWorkSchedules,
  employees,
  leaveBalanceTransactions,
  leaveBalances,
  leaveFiscalYears,
  leaveInterruptionDates,
  leaveInterruptions,
  leaveRequests,
  leaveTypes,
  holidays,
  user,
  workScheduleDays,
} from '../../schema';
import type {
  BulkUpsertLeaveBalancesInput,
  AuthorizeLeaveInput,
  ChangeLeaveRequestStatusInput,
  CreateLeaveInterruptionInput,
  CreateLeaveFiscalYearInput,
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  TransferLeaveBalanceInput,
  UpdateLeaveFiscalYearInput,
  UpdateLeaveRequestInput,
  UpdateLeaveTypeInput,
  UpsertLeaveBalanceInput,
  ReviewLeaveInterruptionInput,
} from '../../../types/core.types';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageEmployeeVisibility';
import {
  getPrimaryLeaveApprovalEmployeeIds,
  resolveLeaveApprovalActionContext,
} from './manageSupervisorDelegations';
import { filterLeaveRequestsByView, type LeaveRequestView } from './leaveVisibility';

export type LeaveBalanceView = 'self' | 'approvals' | 'authorizations' | 'management';

type DbClient = typeof db | any;
type AnnualLeaveDateSelection = { date: string; dayValue: number };
const KNOWN_LEAVE_TYPES = [
  {
    code: 'ANNUAL',
    nameEn: 'Annual Leave',
    nameAm: 'ዓመታዊ ፈቃድ',
    description: 'Annual leave deducted from employee fiscal-year balance.',
    deductsAnnualBalance: true,
    requiresBalance: true,
    allowedDays: null,
  },
  {
    code: 'SICK',
    nameEn: 'Sick Leave',
    nameAm: 'የሕመም ፈቃድ',
    description: 'Sick leave capped by policy.',
    deductsAnnualBalance: false,
    requiresBalance: false,
    allowedDays: '240.00',
  },
  {
    code: 'MATERNITY',
    nameEn: 'Maternity Leave',
    nameAm: 'የወሊድ ፈቃድ',
    description: 'Maternity leave with pay.',
    deductsAnnualBalance: false,
    requiresBalance: false,
    allowedDays: '120.00',
  },
  {
    code: 'PATERNITY',
    nameEn: 'Paternity Leave',
    nameAm: 'የአባትነት ፈቃድ',
    description: 'Paternity leave with pay.',
    deductsAnnualBalance: false,
    requiresBalance: false,
    allowedDays: '10.00',
  },
  {
    code: 'SPECIAL_FULL_PAY',
    nameEn: 'Special Leave with Full Pay',
    nameAm: 'ልዩ ፈቃድ ከሙሉ ክፍያ ጋር',
    description: 'Special leave with full pay capped by policy.',
    deductsAnnualBalance: false,
    requiresBalance: false,
    allowedDays: '7.00',
  },
  {
    code: 'UNPAID',
    nameEn: 'Unpaid Leave',
    nameAm: 'ያለ ክፍያ ፈቃድ',
    description: 'Special leave without pay capped by policy.',
    deductsAnnualBalance: false,
    requiresBalance: false,
    allowedDays: '365.00',
  },
] as const;

export async function getLeaveFiscalYears() {
  return db.select().from(leaveFiscalYears).orderBy(asc(leaveFiscalYears.startsAt));
}

export async function createLeaveFiscalYear(input: CreateLeaveFiscalYearInput) {
  assertDateRange(input.startsAt, input.endsAt);

  return db.transaction(async (tx) => {
    if (input.isActive) {
      await tx.update(leaveFiscalYears).set({ isActive: false, updatedAt: new Date() });
    }

    const [fiscalYear] = await tx.insert(leaveFiscalYears).values({
      name: input.name,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      isActive: input.isActive ?? false,
    } as any).returning();

    return fiscalYear;
  });
}

export async function updateLeaveFiscalYear(id: string, input: UpdateLeaveFiscalYearInput) {
  if (input.startsAt || input.endsAt) {
    const existing = await getLeaveFiscalYearById(id);
    if (!existing) throw new Error('Leave fiscal year not found');
    assertDateRange(input.startsAt ?? existing.startsAt, input.endsAt ?? existing.endsAt);
  }

  return db.transaction(async (tx) => {
    if (input.isActive) {
      await tx.update(leaveFiscalYears).set({ isActive: false, updatedAt: new Date() });
    }

    const [fiscalYear] = await tx.update(leaveFiscalYears)
      .set(removeUndefined({
        name: input.name,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        isActive: input.isActive,
        updatedAt: new Date(),
      }) as any)
      .where(eq(leaveFiscalYears.id, id))
      .returning();

    if (!fiscalYear) throw new Error('Leave fiscal year not found');
    return fiscalYear;
  });
}

export async function setActiveLeaveFiscalYear(id: string) {
  return db.transaction(async (tx) => {
    await assertLeaveFiscalYearExists(id, tx);
    await tx.update(leaveFiscalYears).set({ isActive: false, updatedAt: new Date() });
    const [fiscalYear] = await tx.update(leaveFiscalYears)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(leaveFiscalYears.id, id))
      .returning();
    return fiscalYear;
  });
}

export async function getLeaveTypes() {
  await ensureKnownLeaveTypes();
  return db.select().from(leaveTypes).orderBy(asc(leaveTypes.nameEn));
}

export async function createLeaveType(input: CreateLeaveTypeInput) {
  const [leaveType] = await db.insert(leaveTypes).values({
    code: input.code.trim().toUpperCase(),
    nameEn: input.nameEn,
    nameAm: input.nameAm ?? null,
    description: input.description ?? null,
    deductsAnnualBalance: input.deductsAnnualBalance ?? false,
    requiresBalance: input.requiresBalance ?? false,
    allowedDays: input.allowedDays === undefined || input.allowedDays === null || input.allowedDays === ''
      ? null
      : fixed(parseDays(input.allowedDays, 'allowedDays')),
    isActive: input.isActive ?? true,
  } as any).returning();

  return leaveType;
}

export async function updateLeaveType(id: string, input: UpdateLeaveTypeInput) {
  const [leaveType] = await db.update(leaveTypes)
    .set(removeUndefined({
      code: input.code?.trim().toUpperCase(),
      nameEn: input.nameEn,
      nameAm: input.nameAm,
      description: input.description,
      deductsAnnualBalance: input.deductsAnnualBalance,
      requiresBalance: input.requiresBalance,
      allowedDays: input.allowedDays === undefined
        ? undefined
        : input.allowedDays === null || input.allowedDays === ''
          ? null
          : fixed(parseDays(input.allowedDays, 'allowedDays')),
      isActive: input.isActive,
      updatedAt: new Date(),
    }) as any)
    .where(eq(leaveTypes.id, id))
    .returning();

  if (!leaveType) throw new Error('Leave type not found');
  return leaveType;
}

export async function getLeaveBalances(
  fiscalYearId?: string,
  context: { scope?: EmployeeVisibilityScope; userId?: string; view?: LeaveBalanceView; canAuthorize?: boolean } = {},
) {
  const balances = await db.query.leaveBalances.findMany({
    where: fiscalYearId ? eq(leaveBalances.fiscalYearId, fiscalYearId) : undefined,
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      fiscalYear: true,
    },
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  const { scope, userId, view = 'self' } = context;
  if (!userId) return [];
  if (view === 'management') {
    if (scope?.type !== 'unrestricted' && scope?.type !== 'hr') throw new Error('Leave balance management access is required');
    return balances;
  }
  if (view === 'authorizations') {
    if (!context.canAuthorize) throw new Error('Leave authorization permission is required');
    return balances;
  }
  if (view === 'approvals') {
    const visibleEmployeeIds = new Set(await getPrimaryLeaveApprovalEmployeeIds(userId));
    return balances.filter((balance) => visibleEmployeeIds.has(balance.employeeId));
  }
  return balances.filter((balance) => balance.employee?.userId === userId);
}

export async function upsertLeaveBalance(input: UpsertLeaveBalanceInput, tx: DbClient = db) {
  const employee = await getEmployeeById(input.employeeId, tx);
  if (!employee) throw new Error('Employee not found');
  await assertLeaveFiscalYearExists(input.fiscalYearId, tx);
  if (input.createdBy) await assertUserExists(input.createdBy, tx);
  if (input.updatedBy) await assertUserExists(input.updatedBy, tx);

  const opening = parseDays(input.opening, 'opening');
  const existing = await tx.query.leaveBalances.findFirst({
    where: and(
      eq(leaveBalances.employeeId, input.employeeId),
      eq(leaveBalances.fiscalYearId, input.fiscalYearId),
    ),
  });

  if (existing) {
    const available = opening + numeric(existing.transferredIn) - numeric(existing.used) - numeric(existing.reserved);
    if (available < 0) throw new Error('Opening balance cannot be lower than already used leave');

    const [updated] = await tx.update(leaveBalances)
      .set({
        opening: fixed(opening),
        available: fixed(available),
        updatedBy: input.updatedBy ?? input.createdBy ?? null,
        updatedAt: new Date(),
      } as any)
      .where(eq(leaveBalances.id, existing.id))
      .returning();

    await createBalanceTransaction(tx, updated, 'INITIAL', opening, input.updatedBy ?? input.createdBy ?? null, 'Initial balance updated');
    return getLeaveBalanceById(updated.id, tx);
  }

  const [created] = await tx.insert(leaveBalances).values({
    employeeId: input.employeeId,
    fiscalYearId: input.fiscalYearId,
    employmentTypeSnapshot: employee.employmentType,
    opening: fixed(opening),
    transferredIn: fixed(0),
    reserved: fixed(0),
    used: fixed(0),
    available: fixed(opening),
    createdBy: input.createdBy ?? null,
    updatedBy: input.updatedBy ?? input.createdBy ?? null,
  } as any).returning();

  await createBalanceTransaction(tx, created, 'INITIAL', opening, input.createdBy ?? null, 'Initial balance created');
  return getLeaveBalanceById(created.id, tx);
}

export async function bulkUpsertLeaveBalances(input: BulkUpsertLeaveBalancesInput) {
  return db.transaction(async (tx) => {
    const balances = [];
    for (const balance of input.balances) {
      balances.push(await upsertLeaveBalance({
        employeeId: balance.employeeId,
        fiscalYearId: input.fiscalYearId,
        opening: balance.opening,
        createdBy: input.createdBy ?? null,
        updatedBy: input.updatedBy ?? input.createdBy ?? null,
      }, tx));
    }
    return balances;
  });
}

export async function upsertLeaveBalanceScoped(input: UpsertLeaveBalanceInput, scope: EmployeeVisibilityScope) {
  await assertCanAccessEmployee(input.employeeId, scope);
  return upsertLeaveBalance(input);
}

export async function bulkUpsertLeaveBalancesScoped(input: BulkUpsertLeaveBalancesInput, scope: EmployeeVisibilityScope) {
  for (const balance of input.balances) {
    await assertCanAccessEmployee(balance.employeeId, scope);
  }
  return bulkUpsertLeaveBalances(input);
}

export async function transferLeaveBalanceScoped(input: TransferLeaveBalanceInput, scope: EmployeeVisibilityScope) {
  await assertCanAccessEmployee(input.employeeId, scope);
  return transferLeaveBalance(input);
}

export async function transferLeaveBalance(input: TransferLeaveBalanceInput) {
  return db.transaction(async (tx) => {
    const employee = await getEmployeeById(input.employeeId, tx);
    if (!employee) throw new Error('Employee not found');
    if (employee.employmentType !== 'PERMANENT') {
      throw new Error('Only permanent employees can carry annual leave forward');
    }
    if (input.approvedBy) await assertUserExists(input.approvedBy, tx);

    const days = parseDays(input.days, 'transfer days');
    const fromFiscalYear = await getLeaveFiscalYearById(input.fromFiscalYearId, tx);
    const toFiscalYear = await getLeaveFiscalYearById(input.toFiscalYearId, tx);
    if (!fromFiscalYear || !toFiscalYear) throw new Error('Fiscal year not found');
    assertTransferWindow(fromFiscalYear, toFiscalYear);

    const fromBalance = await getEmployeeFiscalYearBalance(input.employeeId, input.fromFiscalYearId, tx);
    const toBalance = await getEmployeeFiscalYearBalance(input.employeeId, input.toFiscalYearId, tx);
    if (!fromBalance || !toBalance) throw new Error('Both source and target balances are required before transfer');
    if (numeric(fromBalance.available) < days) throw new Error('Transfer amount exceeds available source balance');

    const [updatedFrom] = await tx.update(leaveBalances)
      .set({
        available: sql`${leaveBalances.available} - ${days}`,
        updatedBy: input.approvedBy ?? null,
        updatedAt: new Date(),
      } as any)
      .where(and(eq(leaveBalances.id, fromBalance.id), gte(leaveBalances.available, fixed(days))))
      .returning();
    if (!updatedFrom) throw new Error('Transfer amount exceeds available source balance');

    const [updatedTo] = await tx.update(leaveBalances)
      .set({
        transferredIn: sql`${leaveBalances.transferredIn} + ${days}`,
        available: sql`${leaveBalances.available} + ${days}`,
        updatedBy: input.approvedBy ?? null,
        updatedAt: new Date(),
      } as any)
      .where(eq(leaveBalances.id, toBalance.id))
      .returning();

    const [outTx] = await tx.insert(leaveBalanceTransactions).values({
      leaveBalanceId: updatedFrom.id,
      employeeId: input.employeeId,
      fiscalYearId: input.fromFiscalYearId,
      type: 'TRANSFER_OUT',
      days: fixed(days),
      note: input.note ?? 'Carry-forward transfer out',
      createdBy: input.approvedBy ?? null,
    } as any).returning();

    const [inTx] = await tx.insert(leaveBalanceTransactions).values({
      leaveBalanceId: updatedTo.id,
      employeeId: input.employeeId,
      fiscalYearId: input.toFiscalYearId,
      linkedTransactionId: outTx.id,
      type: 'TRANSFER_IN',
      days: fixed(days),
      note: input.note ?? 'Carry-forward transfer in',
      createdBy: input.approvedBy ?? null,
    } as any).returning();

    await tx.update(leaveBalanceTransactions)
      .set({ linkedTransactionId: inTx.id } as any)
      .where(eq(leaveBalanceTransactions.id, outTx.id));

    return {
      fromBalance: await getLeaveBalanceById(updatedFrom.id, tx),
      toBalance: await getLeaveBalanceById(updatedTo.id, tx),
      transactions: [outTx, inTx],
    };
  });
}

export async function getLeaveRequests(
  kind?: 'annual' | 'other',
  context: { userId?: string; view?: LeaveRequestView; canAuthorize?: boolean } = {},
) {
  await ensureKnownLeaveTypes();
  await reconcileAnnualLeaveConsumption();
  const requests = await db.query.leaveRequests.findMany({
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      leaveType: true,
      fiscalYear: true,
      annualLeaveDates: {
        orderBy: (table, { asc }) => [asc(table.leaveDate)],
      },
      interruptions: {
        with: { dates: true },
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      },
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  const scopedRequests = await filterLeaveRequestsForViewer(requests, context);

  if (!kind) return scopedRequests;
  return scopedRequests.filter((request) => isAnnualLeaveType(request.leaveType) === (kind === 'annual'));
}

export async function reconcileAnnualLeaveConsumption(cutoffDate = yesterday()) {
  return db.transaction(async (tx) => {
    const scheduledDates = await tx.query.annualLeaveRequestDates.findMany({
      where: and(
        eq(annualLeaveRequestDates.status, 'APPROVED'),
        eq(annualLeaveRequestDates.utilizationStatus, 'SCHEDULED'),
        lte(annualLeaveRequestDates.leaveDate, cutoffDate),
      ),
      with: { leaveRequest: true },
      orderBy: (table: any, { asc }: any) => [asc(table.leaveDate)],
    });

    for (const annualDate of scheduledDates) {
      const request = annualDate.leaveRequest;
      if (!request || request.status !== 'AUTHORIZED' || !request.fiscalYearId) continue;
      const days = numeric(annualDate.approvedDayValue);
      if (days <= 0) continue;
      const balance = await getEmployeeFiscalYearBalance(request.employeeId, request.fiscalYearId, tx);
      if (!balance) throw new Error('Annual leave balance not found while consuming approved leave');
      if (numeric(balance.reserved) < days) throw new Error('Reserved annual leave balance is inconsistent');

      const [updatedDate] = await tx.update(annualLeaveRequestDates).set({
        utilizationStatus: 'CONSUMED',
        updatedAt: new Date(),
      } as any).where(and(
        eq(annualLeaveRequestDates.id, annualDate.id),
        eq(annualLeaveRequestDates.utilizationStatus, 'SCHEDULED'),
      )).returning();
      if (!updatedDate) continue;

      const [updatedBalance] = await tx.update(leaveBalances).set({
        reserved: sql`${leaveBalances.reserved} - ${days}`,
        used: sql`${leaveBalances.used} + ${days}`,
        updatedAt: new Date(),
      } as any).where(and(
        eq(leaveBalances.id, balance.id),
        gte(leaveBalances.reserved, fixed(days)),
      )).returning();
      if (!updatedBalance) throw new Error('Reserved annual leave balance is inconsistent');
      await createBalanceTransaction(tx, updatedBalance, 'CONSUMPTION', days, null, `Annual leave consumed on ${formatDateValue(annualDate.leaveDate)}`, request.id);
    }
  });
}

export async function createLeaveRequest(input: CreateLeaveRequestInput) {
  const employee = await getEmployeeById(input.employeeId);
  if (!employee) throw new Error('Employee not found');
  const leaveType = await getLeaveTypeById(input.leaveTypeId);
  if (!leaveType) throw new Error('Leave type not found');
  if (input.requestedBy) await assertUserExists(input.requestedBy);

  const requiresBalance = isAnnualLeaveType(leaveType);
  if (requiresBalance && !input.fiscalYearId) throw new Error('Fiscal year is required for annual leave');
  let fiscalYear = input.fiscalYearId
    ? await getLeaveFiscalYearById(input.fiscalYearId)
    : null;
  if (input.fiscalYearId && !fiscalYear) throw new Error('Leave fiscal year not found');

  if (requiresBalance) {
    await assertAnnualFiscalYearAllowed(employee, fiscalYear!);
    const dateSelections = normalizeAnnualLeaveDateSelections(input.annualLeaveDates);
    await assertAnnualLeaveDatesAreWorkingDays(input.employeeId, dateSelections.map((selection) => selection.date));
    await assertNoActiveAnnualLeaveDateOverlap(input.employeeId, dateSelections.map((selection) => selection.date));
    const requestedDays = sumDaySelections(dateSelections);
    assertWithinAllowedDays(leaveType, requestedDays);

    const balance = await getEmployeeFiscalYearBalance(input.employeeId, fiscalYear!.id);
    if (!balance) throw new Error('Annual leave balance not found for this fiscal year');
    if (numeric(balance.available) < requestedDays) throw new Error('Insufficient annual leave balance');

    const dateValues = dateSelections.map((selection) => selection.date).sort();
    return db.transaction(async (tx) => {
      const [request] = await tx.insert(leaveRequests).values({
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        fiscalYearId: fiscalYear?.id ?? null,
        startDate: dateValues[0],
        endDate: dateValues[dateValues.length - 1],
        requestedDays: fixed(requestedDays),
        reason: input.reason,
        requestedBy: input.requestedBy,
      } as any).returning();

      await tx.insert(annualLeaveRequestDates).values(
        dateSelections.map((selection) => ({
          leaveRequestId: request.id,
          employeeId: input.employeeId,
          leaveDate: selection.date,
          requestedDayValue: fixed(selection.dayValue),
          approvedDayValue: null,
          status: 'PENDING',
        }))
      );

      return getLeaveRequestById(request.id, tx);
    });
  }

  if (!input.startDate || !input.endDate) throw new Error('Start date and end date are required');

  fiscalYear = await getActiveLeaveFiscalYear();
  if (!fiscalYear) throw new Error('Active leave fiscal year is required');

  const requestedDays = await calculateWorkingDays(input.employeeId, input.startDate, input.endDate);
  assertWithinAllowedDays(leaveType, requestedDays);

  const [request] = await db.insert(leaveRequests).values({
    employeeId: input.employeeId,
    leaveTypeId: input.leaveTypeId,
    fiscalYearId: fiscalYear?.id ?? null,
    startDate: input.startDate,
    endDate: input.endDate,
    requestedDays: fixed(requestedDays),
    reason: input.reason,
    requestedBy: input.requestedBy,
  } as any).returning();

  return getLeaveRequestById(request.id);
}

export async function updateLeaveRequest(id: string, input: UpdateLeaveRequestInput) {
  return db.transaction(async (tx) => {
    const request = await getLeaveRequestById(id, tx);
    if (!request) throw new Error('Leave request not found');
    if (request.status !== 'PENDING') throw new Error('Only pending leave requests can be edited');
    if (!input.updatedBy) throw new Error('Updated by is required');
    await assertUserExists(input.updatedBy, tx);
    if (request.requestedBy !== input.updatedBy && request.employee?.userId !== input.updatedBy) {
      throw new Error('Only the requester can edit this leave request before supervisor action');
    }

    const leaveType = request.leaveType ?? await getLeaveTypeById(request.leaveTypeId, tx);
    if (isAnnualLeaveType(leaveType)) {
      if (!input.fiscalYearId) throw new Error('Fiscal year is required for annual leave');
      const fiscalYear = await getLeaveFiscalYearById(input.fiscalYearId, tx);
      if (!fiscalYear) throw new Error('Leave fiscal year not found');
      const employee = await getEmployeeById(request.employeeId, tx);
      if (!employee) throw new Error('Employee not found');
      await assertAnnualFiscalYearAllowed(employee, fiscalYear);

      const dateSelections = normalizeAnnualLeaveDateSelections(input.annualLeaveDates);
      await assertAnnualLeaveDatesAreWorkingDays(request.employeeId, dateSelections.map((selection) => selection.date), tx);
      await assertNoActiveAnnualLeaveDateOverlap(request.employeeId, dateSelections.map((selection) => selection.date), tx, request.id);
      const requestedDays = sumDaySelections(dateSelections);
      assertWithinAllowedDays(leaveType, requestedDays);

      const balance = await getEmployeeFiscalYearBalance(request.employeeId, fiscalYear.id, tx);
      if (!balance) throw new Error('Annual leave balance not found for this fiscal year');
      if (numeric(balance.available) < requestedDays) throw new Error('Insufficient annual leave balance');

      const dateValues = dateSelections.map((selection) => selection.date).sort();
      const [updated] = await tx.update(leaveRequests).set({
        fiscalYearId: fiscalYear.id,
        startDate: dateValues[0],
        endDate: dateValues[dateValues.length - 1],
        requestedDays: fixed(requestedDays),
        reason: input.reason.trim(),
        updatedAt: new Date(),
      } as any).where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'PENDING'))).returning();
      if (!updated) throw new Error('Leave request is already processed');

      await tx.delete(annualLeaveRequestDates).where(eq(annualLeaveRequestDates.leaveRequestId, id));
      await tx.insert(annualLeaveRequestDates).values(
        dateSelections.map((selection) => ({
          leaveRequestId: id,
          employeeId: request.employeeId,
          leaveDate: selection.date,
          requestedDayValue: fixed(selection.dayValue),
          approvedDayValue: null,
          status: 'PENDING',
        }))
      );

      return getLeaveRequestById(id, tx);
    }

    if (!input.startDate || !input.endDate) throw new Error('Start date and end date are required');
    const requestedDays = await calculateWorkingDays(request.employeeId, input.startDate, input.endDate, tx);
    assertWithinAllowedDays(leaveType, requestedDays);

    const [updated] = await tx.update(leaveRequests).set({
      startDate: input.startDate,
      endDate: input.endDate,
      requestedDays: fixed(requestedDays),
      reason: input.reason.trim(),
      updatedAt: new Date(),
    } as any).where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'PENDING'))).returning();
    if (!updated) throw new Error('Leave request is already processed');

    return getLeaveRequestById(id, tx);
  });
}

export async function updateLeaveRequestScoped(id: string, input: UpdateLeaveRequestInput, actorUserId: string) {
  const request = await getLeaveRequestById(id);
  if (!request) throw new Error('Leave request not found');
  assertLeaveRequestOwner(request, actorUserId);
  return updateLeaveRequest(id, input);
}

export async function changeLeaveRequestStatus(
  id: string,
  input: ChangeLeaveRequestStatusInput,
) {
  return db.transaction(async (tx) => {
    const request = await getLeaveRequestById(id, tx);
    if (!request) throw new Error('Leave request not found');

    if (input.status === 'REJECTED') {
      const rejectedBy = input.rejectedBy;
      if (!rejectedBy) throw new Error('Rejected by is required when rejecting a leave request');
      if (!input.rejectionReason?.trim()) throw new Error('Rejection reason is required');
      await assertUserExists(rejectedBy, tx);
      const actionContext = await resolveLeaveApprovalActionContext({
        actorUserId: rejectedBy,
        targetEmployeeId: request.employeeId,
        tx,
      });
      if (request.requestedBy === rejectedBy) throw new Error('A requester cannot review their own leave request');
      if (request.status !== 'PENDING') throw new Error('Leave request is already processed');

      if (isAnnualLeaveType(request.leaveType)) {
        await tx.update(annualLeaveRequestDates).set({
          status: 'REJECTED',
          approvedDayValue: fixed(0),
          utilizationStatus: 'CANCELLED',
          updatedAt: new Date(),
        } as any).where(eq(annualLeaveRequestDates.leaveRequestId, request.id));
      }

      const [updated] = await tx.update(leaveRequests).set({
        status: 'REJECTED',
        approvedBy: null,
        approvedAt: null,
        rejectedBy,
        rejectedAt: input.rejectedAt ? new Date(input.rejectedAt) : new Date(),
        rejectionReason: input.rejectionReason.trim(),
        supervisorDelegationId: actionContext.supervisorDelegationId,
        updatedAt: new Date(),
      } as any).where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'PENDING'))).returning();
      if (!updated) throw new Error('Leave request is already processed');

      return getLeaveRequestById(updated.id, tx);
    }

    const approvedBy = input.approvedBy;
    if (!approvedBy) throw new Error('Approved by is required when approving a leave request');
    await assertUserExists(approvedBy, tx);
    const actionContext = await resolveLeaveApprovalActionContext({
      actorUserId: approvedBy,
      targetEmployeeId: request.employeeId,
      tx,
    });
    if (request.requestedBy === approvedBy) throw new Error('A requester cannot review their own leave request');
    if (request.status !== 'PENDING') throw new Error('Leave request is already processed');

    const leaveType = request.leaveType ?? await getLeaveTypeById(request.leaveTypeId, tx);
    if (isAnnualLeaveType(leaveType)) {
      if (!request.fiscalYearId) throw new Error('Annual leave request has no fiscal year');
      const balance = await getEmployeeFiscalYearBalance(request.employeeId, request.fiscalYearId, tx);
      if (!balance) throw new Error('Annual leave balance not found for this fiscal year');
      const approvedSelections = resolveAnnualApprovalSelections(request, input.approvedDates);
      await assertAnnualLeaveDatesAreWorkingDays(request.employeeId, approvedSelections.map((selection) => selection.date), tx);
      await assertNoActiveAnnualLeaveDateOverlap(request.employeeId, approvedSelections.map((selection) => selection.date), tx, request.id);
      const days = sumDaySelections(approvedSelections);
      if (days <= 0) throw new Error('At least one annual leave date must be approved');
      assertWithinAllowedDays(leaveType, days);
      if (numeric(balance.available) < days) throw new Error('Insufficient annual leave balance');

      const [updatedBalance] = await tx.update(leaveBalances).set({
        reserved: sql`${leaveBalances.reserved} + ${days}`,
        available: sql`${leaveBalances.available} - ${days}`,
        updatedBy: approvedBy,
        updatedAt: new Date(),
      } as any).where(and(
        eq(leaveBalances.id, balance.id),
        gte(leaveBalances.available, fixed(days)),
      )).returning();
      if (!updatedBalance) throw new Error('Insufficient annual leave balance');

      await createBalanceTransaction(tx, updatedBalance, 'RESERVATION', days, approvedBy, 'Annual leave supervisor-approved and reserved pending HR authorization', request.id);

      const approvedByDate = new Map(approvedSelections.map((selection) => [selection.date, selection.dayValue]));
      const requestDates = request.annualLeaveDates ?? [];
      const requestDateByDate = new Map(
        requestDates.map((requestDate: any) => [formatDateValue(requestDate.leaveDate), requestDate]),
      );

      if (requestDates.length > 0) {
        for (const requestDate of requestDates) {
          const dateValue = formatDateValue(requestDate.leaveDate);
          const approvedDayValue = approvedByDate.get(dateValue);
          await tx.update(annualLeaveRequestDates).set({
            status: approvedDayValue ? 'APPROVED' : 'REJECTED',
            approvedDayValue: fixed(approvedDayValue ?? 0),
            utilizationStatus: approvedDayValue ? 'SCHEDULED' : 'CANCELLED',
            updatedAt: new Date(),
          } as any).where(eq(annualLeaveRequestDates.id, requestDate.id));
        }
      }

      const supervisorAddedSelections = approvedSelections.filter((selection) => !requestDateByDate.has(selection.date));
      if (supervisorAddedSelections.length) {
        await tx.insert(annualLeaveRequestDates).values(supervisorAddedSelections.map((selection) => ({
          leaveRequestId: request.id,
          employeeId: request.employeeId,
          leaveDate: selection.date,
          requestedDayValue: fixed(selection.dayValue),
          approvedDayValue: fixed(selection.dayValue),
          status: 'APPROVED',
          source: 'ORIGINAL',
          utilizationStatus: 'SCHEDULED',
        })) as any);
      }

      const approvedDates = approvedSelections.map((selection) => selection.date).sort();
      await tx.update(leaveRequests).set({
        startDate: approvedDates[0],
        endDate: approvedDates[approvedDates.length - 1],
        updatedAt: new Date(),
      } as any).where(eq(leaveRequests.id, request.id));
    }

    const [updated] = await tx.update(leaveRequests).set({
      status: 'APPROVED',
      approvedBy,
      approvedAt: input.approvedAt ? new Date(input.approvedAt) : new Date(),
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      authorizedBy: null,
      authorizedAt: null,
      authorizationRejectedBy: null,
      authorizationRejectedAt: null,
      authorizationRejectionReason: null,
      supervisorDelegationId: actionContext.supervisorDelegationId,
      updatedAt: new Date(),
    } as any).where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'PENDING'))).returning();
    if (!updated) throw new Error('Leave request is already processed');

    return getLeaveRequestById(updated.id, tx);
  });
}

export async function changeLeaveRequestStatusScoped(
  id: string,
  input: ChangeLeaveRequestStatusInput,
) {
  const request = await getLeaveRequestById(id);
  if (!request) throw new Error('Leave request not found');
  return changeLeaveRequestStatus(id, input);
}

export async function authorizeLeaveRequest(id: string, input: AuthorizeLeaveInput) {
  return db.transaction(async (tx) => {
    const request = await getLeaveRequestById(id, tx);
    if (!request) throw new Error('Leave request not found');
    if (request.status === input.status) return request;
    if (request.status !== 'APPROVED') throw new Error('Only supervisor-approved leave requests can be authorized');
    await assertUserExists(input.actorUserId, tx);

    const leaveType = request.leaveType ?? await getLeaveTypeById(request.leaveTypeId, tx);
    const approvedDates: AnnualLeaveDateSelection[] = (request.annualLeaveDates ?? [])
      .filter((date: any) => date.status === 'APPROVED' && numeric(date.approvedDayValue) > 0)
      .map((date: any) => ({ date: formatDateValue(date.leaveDate), dayValue: numeric(date.approvedDayValue) }));
    const affectedDates = isAnnualLeaveType(leaveType)
      ? approvedDates.map((date) => date.date)
      : calendarDateRange(request.startDate, request.endDate);

    if (input.status === 'AUTHORIZATION_REJECTED') {
      if (!input.rejectionReason?.trim()) throw new Error('Authorization rejection reason is required');
      if (isAnnualLeaveType(leaveType)) {
        if (!request.fiscalYearId) throw new Error('Annual leave request has no fiscal year');
        const days = sumDaySelections(approvedDates);
        const balance = await getEmployeeFiscalYearBalance(request.employeeId, request.fiscalYearId, tx);
        if (!balance || numeric(balance.reserved) < days) throw new Error('Reserved annual leave balance is inconsistent');
        const [updatedBalance] = await tx.update(leaveBalances).set({
          reserved: sql`${leaveBalances.reserved} - ${days}`,
          available: sql`${leaveBalances.available} + ${days}`,
          updatedBy: input.actorUserId,
          updatedAt: new Date(),
        } as any).where(and(eq(leaveBalances.id, balance.id), gte(leaveBalances.reserved, fixed(days)))).returning();
        if (!updatedBalance) throw new Error('Reserved annual leave balance is inconsistent');
        await createBalanceTransaction(tx, updatedBalance, 'REVERSAL', days, input.actorUserId, 'Annual leave reservation released after HR rejection', request.id);
        await tx.update(annualLeaveRequestDates).set({
          utilizationStatus: 'CANCELLED',
          updatedAt: new Date(),
        } as any).where(and(
          eq(annualLeaveRequestDates.leaveRequestId, request.id),
          eq(annualLeaveRequestDates.status, 'APPROVED'),
        ));
      }

      const [updated] = await tx.update(leaveRequests).set({
        status: 'AUTHORIZATION_REJECTED',
        authorizationRejectedBy: input.actorUserId,
        authorizationRejectedAt: new Date(),
        authorizationRejectionReason: input.rejectionReason.trim(),
        updatedAt: new Date(),
      } as any).where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'APPROVED'))).returning();
      if (!updated) throw new Error('Leave request authorization is already processed');
      return getLeaveRequestById(updated.id, tx);
    }

    await assertNoAuthorizedLeaveConflict(request.employeeId, affectedDates, request.id, tx);
    await assertNoPayrollReadyAttendanceDates(request.employeeId, affectedDates, tx);
    if (isAnnualLeaveType(leaveType)) {
      if (!request.fiscalYearId) throw new Error('Annual leave request has no fiscal year');
      if (approvedDates.length === 0) throw new Error('Annual leave request has no approved dates');
      await assertAnnualLeaveDatesAreWorkingDays(request.employeeId, approvedDates.map((date) => date.date), tx);
      await assertNoActiveAnnualLeaveDateOverlap(request.employeeId, approvedDates.map((date) => date.date), tx, request.id);
      const days = sumDaySelections(approvedDates);
      const balance = await getEmployeeFiscalYearBalance(request.employeeId, request.fiscalYearId, tx);
      if (!balance || numeric(balance.reserved) < days) throw new Error('Reserved annual leave balance is inconsistent');
      const [updatedBalance] = await tx.update(leaveBalances).set({
        reserved: sql`${leaveBalances.reserved} - ${days}`,
        used: sql`${leaveBalances.used} + ${days}`,
        updatedBy: input.actorUserId,
        updatedAt: new Date(),
      } as any).where(and(eq(leaveBalances.id, balance.id), gte(leaveBalances.reserved, fixed(days)))).returning();
      if (!updatedBalance) throw new Error('Reserved annual leave balance is inconsistent');
      await createBalanceTransaction(tx, updatedBalance, 'CONSUMPTION', days, input.actorUserId, 'Annual leave consumed on HR authorization', request.id);
      await tx.update(annualLeaveRequestDates).set({
        utilizationStatus: 'CONSUMED',
        updatedAt: new Date(),
      } as any).where(and(
        eq(annualLeaveRequestDates.leaveRequestId, request.id),
        eq(annualLeaveRequestDates.status, 'APPROVED'),
      ));
    }

    const [updated] = await tx.update(leaveRequests).set({
      status: 'AUTHORIZED',
      authorizedBy: input.actorUserId,
      authorizedAt: new Date(),
      authorizationRejectedBy: null,
      authorizationRejectedAt: null,
      authorizationRejectionReason: null,
      updatedAt: new Date(),
    } as any).where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, 'APPROVED'))).returning();
    if (!updated) throw new Error('Leave request authorization is already processed');
    return getLeaveRequestById(updated.id, tx);
  });
}

export async function authorizeLeaveInterruption(id: string, input: AuthorizeLeaveInput) {
  return db.transaction(async (tx) => {
    const interruption = await getLeaveInterruptionById(id, tx);
    if (!interruption) throw new Error('Leave interruption not found');
    if (interruption.status === input.status) return getLeaveRequestById(interruption.leaveRequestId, tx);
    if (interruption.status !== 'APPROVED') throw new Error('Only supervisor-approved leave interruptions can be authorized');
    await assertUserExists(input.actorUserId, tx);
    const request = await getLeaveRequestById(interruption.leaveRequestId, tx);
    if (!request || request.status !== 'AUTHORIZED') throw new Error('The original leave request is not authorized');

    if (input.status === 'AUTHORIZATION_REJECTED') {
      if (!input.rejectionReason?.trim()) throw new Error('Authorization rejection reason is required');
      const [updated] = await tx.update(leaveInterruptions).set({
        status: 'AUTHORIZATION_REJECTED',
        authorizationRejectedBy: input.actorUserId,
        authorizationRejectedAt: new Date(),
        authorizationRejectionReason: input.rejectionReason.trim(),
        updatedAt: new Date(),
      } as any).where(and(eq(leaveInterruptions.id, id), eq(leaveInterruptions.status, 'APPROVED'))).returning();
      if (!updated) throw new Error('Leave interruption authorization is already processed');
      return getLeaveRequestById(request.id, tx);
    }

    const interrupted = approvedInterruptionSelections(interruption, 'INTERRUPTED_APPROVED');
    const continuation = approvedInterruptionSelections(interruption, 'CONTINUATION_APPROVED');
    await validateInterruptionPattern(request, interrupted, continuation, tx);
    await assertNoAuthorizedLeaveConflict(request.employeeId, continuation.map((item) => item.date), request.id, tx);
    await assertNoPayrollReadyAttendanceDates(request.employeeId, [...interrupted, ...continuation].map((item) => item.date), tx);

    const annualDatesByDate = new Map(
      (request.annualLeaveDates ?? []).map((date: any) => [formatDateValue(date.leaveDate), date]),
    );
    for (const selection of interrupted) {
      const date: any = annualDatesByDate.get(selection.date);
      await tx.update(annualLeaveRequestDates).set({ utilizationStatus: 'INTERRUPTED', updatedAt: new Date() } as any)
        .where(eq(annualLeaveRequestDates.id, date.id));
    }
    await tx.insert(annualLeaveRequestDates).values(continuation.map((selection) => ({
      leaveRequestId: request.id,
      employeeId: request.employeeId,
      leaveDate: selection.date,
      requestedDayValue: fixed(selection.dayValue),
      approvedDayValue: fixed(selection.dayValue),
      status: 'APPROVED',
      source: 'CONTINUATION',
      utilizationStatus: 'CONSUMED',
    })) as any);

    const allDates = [...(request.annualLeaveDates ?? []).map((date: any) => formatDateValue(date.leaveDate)), ...continuation.map((date) => date.date)].sort();
    await tx.update(leaveRequests).set({ startDate: allDates[0], endDate: allDates[allDates.length - 1], updatedAt: new Date() } as any)
      .where(eq(leaveRequests.id, request.id));
    const [updated] = await tx.update(leaveInterruptions).set({
      status: 'AUTHORIZED',
      authorizedBy: input.actorUserId,
      authorizedAt: new Date(),
      authorizationRejectedBy: null,
      authorizationRejectedAt: null,
      authorizationRejectionReason: null,
      updatedAt: new Date(),
    } as any).where(and(eq(leaveInterruptions.id, id), eq(leaveInterruptions.status, 'APPROVED'))).returning();
    if (!updated) throw new Error('Leave interruption authorization is already processed');
    return getLeaveRequestById(request.id, tx);
  });
}

export async function createLeaveInterruptionScoped(input: CreateLeaveInterruptionInput, actorUserId: string) {
  const request = await getLeaveRequestById(input.leaveRequestId);
  if (!request) throw new Error('Leave request not found');
  assertLeaveRequestOwner(request, actorUserId);
  return createLeaveInterruption(input);
}

export async function createLeaveInterruption(input: CreateLeaveInterruptionInput) {
  return db.transaction(async (tx) => {
    const request = await getLeaveRequestById(input.leaveRequestId, tx);
    if (!request) throw new Error('Leave request not found');
    if (request.status !== 'AUTHORIZED' || !isAnnualLeaveType(request.leaveType)) {
      throw new Error('Only authorized annual leave can be interrupted');
    }
    if (!input.requestedBy) throw new Error('Requested by is required');
    await assertUserExists(input.requestedBy, tx);
    if (input.authorityUserId) await assertUserExists(input.authorityUserId, tx);

    const interrupted = normalizeAnnualLeaveDateSelections(input.interruptedDates);
    const continuation = normalizeAnnualLeaveDateSelections(input.continuationDates);
    await validateInterruptionPattern(request, interrupted, continuation, tx);

    const dates = interrupted.map((selection) => selection.date).sort();
    const [interruption] = await tx.insert(leaveInterruptions).values({
      leaveRequestId: request.id,
      reason: input.reason.trim(),
      recallAuthority: input.recallAuthority.trim(),
      authorityUserId: input.authorityUserId ?? null,
      actualWorkStartDate: dates[0],
      actualWorkEndDate: dates[dates.length - 1],
      requestedBy: input.requestedBy,
    } as any).returning();

    await insertInterruptionDates(tx, interruption.id, 'INTERRUPTED_PROPOSED', interrupted);
    await insertInterruptionDates(tx, interruption.id, 'CONTINUATION_PROPOSED', continuation);
    return getLeaveRequestById(request.id, tx);
  });
}

export async function reviewLeaveInterruptionScoped(
  input: ReviewLeaveInterruptionInput,
) {
  const interruption = await getLeaveInterruptionById(input.leaveInterruptionId);
  if (!interruption) throw new Error('Leave interruption not found');
  const request = await getLeaveRequestById(interruption.leaveRequestId);
  if (!request) throw new Error('Leave request not found');
  return reviewLeaveInterruption(input);
}

function assertLeaveRequestOwner(request: any, actorUserId: string) {
  if (request.requestedBy !== actorUserId || request.employee?.userId !== actorUserId) {
    throw new Error('Leave request not found');
  }
}

export async function reviewLeaveInterruption(input: ReviewLeaveInterruptionInput) {
  return db.transaction(async (tx) => {
    const interruption = await getLeaveInterruptionById(input.leaveInterruptionId, tx);
    if (!interruption) throw new Error('Leave interruption not found');
    if (!input.reviewedBy) throw new Error('Reviewed by is required');
    await assertUserExists(input.reviewedBy, tx);

    const request = await getLeaveRequestById(interruption.leaveRequestId, tx);
    if (!request) throw new Error('Leave request not found');
    const actionContext = await resolveLeaveApprovalActionContext({
      actorUserId: input.reviewedBy,
      targetEmployeeId: request.employeeId,
      tx,
    });
    if (interruption.requestedBy === input.reviewedBy) {
      throw new Error('A requester cannot review their own leave interruption');
    }
    if (interruption.status !== 'PENDING') throw new Error('Leave interruption is already processed');

    if (input.status === 'REJECTED') {
      if (!input.rejectionReason?.trim()) throw new Error('Rejection reason is required');
      const [rejectedInterruption] = await tx.update(leaveInterruptions).set({
        status: 'REJECTED',
        reviewedBy: input.reviewedBy,
        reviewedAt: new Date(),
        rejectionReason: input.rejectionReason.trim(),
        supervisorDelegationId: actionContext.supervisorDelegationId,
        updatedAt: new Date(),
      } as any).where(and(
        eq(leaveInterruptions.id, interruption.id),
        eq(leaveInterruptions.status, 'PENDING'),
      )).returning();
      if (!rejectedInterruption) throw new Error('Leave interruption is already processed');
      return getLeaveRequestById(request.id, tx);
    }

    const proposedInterrupted = interruption.dates
      .filter((date: any) => date.kind === 'INTERRUPTED_PROPOSED')
      .map((date: any) => ({ date: formatDateValue(date.leaveDate), dayValue: numeric(date.dayValue) }));
    const proposedContinuation = interruption.dates
      .filter((date: any) => date.kind === 'CONTINUATION_PROPOSED')
      .map((date: any) => ({ date: formatDateValue(date.leaveDate), dayValue: numeric(date.dayValue) }));
    const interrupted: AnnualLeaveDateSelection[] = input.interruptedDates
      ? normalizeAnnualLeaveDateSelections(input.interruptedDates)
      : proposedInterrupted;
    const continuation: AnnualLeaveDateSelection[] = input.continuationDates
      ? normalizeAnnualLeaveDateSelections(input.continuationDates)
      : proposedContinuation;
    await validateInterruptionPattern(request, interrupted, continuation, tx);

    await insertInterruptionDates(tx, interruption.id, 'INTERRUPTED_APPROVED', interrupted);
    await insertInterruptionDates(tx, interruption.id, 'CONTINUATION_APPROVED', continuation);
    const [reviewedInterruption] = await tx.update(leaveInterruptions).set({
      status: 'APPROVED',
      actualWorkStartDate: [...interrupted].sort((a, b) => a.date.localeCompare(b.date))[0].date,
      actualWorkEndDate: [...interrupted].sort((a, b) => b.date.localeCompare(a.date))[0].date,
      reviewedBy: input.reviewedBy,
      reviewedAt: new Date(),
      rejectionReason: null,
      authorizedBy: null,
      authorizedAt: null,
      authorizationRejectedBy: null,
      authorizationRejectedAt: null,
      authorizationRejectionReason: null,
      supervisorDelegationId: actionContext.supervisorDelegationId,
      updatedAt: new Date(),
    } as any).where(and(
      eq(leaveInterruptions.id, interruption.id),
      eq(leaveInterruptions.status, 'PENDING'),
    )).returning();
    if (!reviewedInterruption) throw new Error('Leave interruption is already processed');
    return getLeaveRequestById(request.id, tx);
  });
}

async function filterLeaveRequestsForViewer(
  requests: any[],
  context: { userId?: string; view?: LeaveRequestView; canAuthorize?: boolean } = {},
) {
  const { userId, view = 'self' } = context;
  if (!userId) return [];
  if (view === 'authorizations' && !context.canAuthorize) throw new Error('Leave authorization permission is required');
  const visibleEmployeeIds = view === 'approvals' ? await getPrimaryLeaveApprovalEmployeeIds(userId) : [];
  return filterLeaveRequestsByView(requests, view, userId, visibleEmployeeIds);
}

function approvedInterruptionSelections(interruption: any, kind: string): AnnualLeaveDateSelection[] {
  return interruption.dates
    .filter((date: any) => date.kind === kind)
    .map((date: any) => ({ date: formatDateValue(date.leaveDate), dayValue: numeric(date.dayValue) }));
}

async function assertNoPayrollReadyAttendanceDates(employeeId: string, dates: string[], tx: DbClient) {
  if (dates.length === 0) return;
  const record = await tx.query.attendanceDailyRecords.findFirst({
    where: and(
      eq(attendanceDailyRecords.employeeId, employeeId),
      inArray(attendanceDailyRecords.attendanceDate, dates),
      eq(attendanceDailyRecords.status, 'HR_APPROVED'),
    ),
    columns: { attendanceDate: true },
  });
  if (record) {
    throw new Error(`Attendance for ${formatDateValue(record.attendanceDate)} is already payroll-ready; correct or reopen attendance before authorizing leave`);
  }
}

async function assertNoAuthorizedLeaveConflict(
  employeeId: string,
  dates: string[],
  ignoreLeaveRequestId: string,
  tx: DbClient,
) {
  if (dates.length === 0) return;
  const requestedDates = new Set(dates);
  const sortedDates = [...requestedDates].sort();
  const candidates = await tx.query.leaveRequests.findMany({
    where: and(
      eq(leaveRequests.employeeId, employeeId),
      eq(leaveRequests.status, 'AUTHORIZED'),
      ne(leaveRequests.id, ignoreLeaveRequestId),
      lte(leaveRequests.startDate, sortedDates[sortedDates.length - 1]),
      gte(leaveRequests.endDate, sortedDates[0]),
    ),
    with: { leaveType: true, annualLeaveDates: true },
  });

  for (const candidate of candidates) {
    const effectiveDates = isAnnualLeaveType(candidate.leaveType)
      ? candidate.annualLeaveDates
        .filter((date: any) => date.status === 'APPROVED' && !['INTERRUPTED', 'CANCELLED'].includes(date.utilizationStatus))
        .map((date: any) => formatDateValue(date.leaveDate))
      : calendarDateRange(formatDateValue(candidate.startDate), formatDateValue(candidate.endDate));
    const conflictDate = effectiveDates.find((date: string) => requestedDates.has(date));
    if (conflictDate) throw new Error(`Leave date ${conflictDate} conflicts with another authorized leave request`);
  }
}

function calendarDateRange(startDate: string, endDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

async function validateInterruptionPattern(
  request: any,
  interrupted: AnnualLeaveDateSelection[],
  continuation: AnnualLeaveDateSelection[],
  tx: DbClient,
) {
  if (interrupted.length === 0 || continuation.length === 0) {
    throw new Error('Interrupted and continuation dates are required');
  }
  const interruptedDays = sumDaySelections(interrupted);
  const continuationDays = sumDaySelections(continuation);
  if (interruptedDays !== continuationDays) {
    throw new Error('Continuation days must exactly replace the interrupted leave days');
  }

  const annualDatesByDate = new Map(
    (request.annualLeaveDates ?? []).map((date: any) => [formatDateValue(date.leaveDate), date]),
  );
  for (const selection of interrupted) {
    const date: any = annualDatesByDate.get(selection.date);
    if (!date || date.status !== 'APPROVED' || !['SCHEDULED', 'CONSUMED'].includes(date.utilizationStatus ?? 'SCHEDULED')) {
      throw new Error(`Leave date ${selection.date} is not available for interruption`);
    }
    if (numeric(date.approvedDayValue) !== selection.dayValue) {
      throw new Error(`Interrupted day value for ${selection.date} must match the approved day value`);
    }
    const payrollReadyRecord = await tx.query.attendanceDailyRecords.findFirst({
      where: and(
        eq(attendanceDailyRecords.employeeId, request.employeeId),
        eq(attendanceDailyRecords.attendanceDate, selection.date),
        eq(attendanceDailyRecords.status, 'HR_APPROVED'),
      ),
      columns: { id: true },
    });
    if (payrollReadyRecord) {
      throw new Error(`Leave date ${selection.date} is already payroll-ready and must be corrected through the attendance adjustment workflow`);
    }
  }

  const lastInterruptedDate = [...interrupted].sort((a, b) => b.date.localeCompare(a.date))[0].date;
  const interruptedDateSet = new Set(interrupted.map((selection) => selection.date));
  for (const selection of continuation) {
    if (selection.date <= lastInterruptedDate) {
      throw new Error('Continuation leave dates must be after the interrupted working period');
    }
    if (selection.date < today()) throw new Error('Continuation leave dates cannot be in the past');
    if (annualDatesByDate.has(selection.date) && !interruptedDateSet.has(selection.date)) {
      throw new Error(`Continuation date ${selection.date} already exists in the leave utilization pattern`);
    }
  }
  await assertAnnualLeaveDatesAreWorkingDays(request.employeeId, continuation.map((selection) => selection.date), tx);
  await assertNoActiveAnnualLeaveDateOverlap(request.employeeId, continuation.map((selection) => selection.date), tx);
}

async function assertNoActiveAnnualLeaveDateOverlap(employeeId: string, dates: string[], tx: DbClient = db, ignoreLeaveRequestId?: string) {
  const overlap = await tx.query.annualLeaveRequestDates.findFirst({
    where: and(
      eq(annualLeaveRequestDates.employeeId, employeeId),
      inArray(annualLeaveRequestDates.leaveDate, dates),
      or(eq(annualLeaveRequestDates.status, 'PENDING'), eq(annualLeaveRequestDates.status, 'APPROVED')),
      or(eq(annualLeaveRequestDates.utilizationStatus, 'SCHEDULED'), eq(annualLeaveRequestDates.utilizationStatus, 'CONSUMED')),
      ignoreLeaveRequestId ? sql`${annualLeaveRequestDates.leaveRequestId} <> ${ignoreLeaveRequestId}` : undefined,
    ),
    columns: { leaveDate: true },
  });
  if (overlap) throw new Error(`Annual leave date ${formatDateValue(overlap.leaveDate)} is already part of another active request`);
}

function insertInterruptionDates(
  tx: DbClient,
  interruptionId: string,
  kind: string,
  selections: AnnualLeaveDateSelection[],
) {
  return tx.insert(leaveInterruptionDates).values(selections.map((selection) => ({
    leaveInterruptionId: interruptionId,
    kind,
    leaveDate: selection.date,
    dayValue: fixed(selection.dayValue),
  })) as any);
}

async function assertAnnualFiscalYearAllowed(employee: any, fiscalYear: any, tx: DbClient = db) {
  const activeFiscalYear = await tx.query.leaveFiscalYears.findFirst({
    where: eq(leaveFiscalYears.isActive, true),
    columns: { id: true },
  });

  if (!activeFiscalYear) throw new Error('Active leave fiscal year is required');

  if (employee.employmentType === 'PERMANENT') {
    if (fiscalYear.id === activeFiscalYear.id) {
      throw new Error('Permanent employees can request annual leave only from previous fiscal-year balances');
    }
    return;
  }

  if (fiscalYear.id !== activeFiscalYear.id) {
    throw new Error('Contract and non-permanent employees can request annual leave only from the current fiscal year');
  }
}

function normalizeAnnualLeaveDateSelections(
  selections: Array<{ date: string; dayValue: string | number }> | undefined,
): AnnualLeaveDateSelection[] {
  if (!selections?.length) throw new Error('Annual leave dates are required');

  const byDate = new Map<string, { date: string; dayValue: number }>();
  for (const selection of selections) {
    assertValidDate(selection.date);
    if (byDate.has(selection.date)) throw new Error('Annual leave dates must be unique');
    byDate.set(selection.date, {
      date: selection.date,
      dayValue: parseAnnualLeaveDayValue(selection.dayValue, 'dayValue'),
    });
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function resolveAnnualApprovalSelections(
  request: any,
  approvedDates: Array<{ date: string; dayValue: string | number }> | undefined,
): AnnualLeaveDateSelection[] {
  const requestDates = request.annualLeaveDates ?? [];
  if (requestDates.length === 0) {
    if (approvedDates?.length) return normalizeAnnualLeaveDateSelections(approvedDates);
    return [{ date: request.startDate, dayValue: numeric(request.requestedDays) }];
  }

  return approvedDates?.length
    ? normalizeAnnualLeaveDateSelections(approvedDates)
    : requestDates.map((requestDate: any) => ({
      date: formatDateValue(requestDate.leaveDate),
      dayValue: numeric(requestDate.requestedDayValue),
    }));
}

async function assertAnnualLeaveDatesAreWorkingDays(employeeId: string, dates: string[], tx: DbClient = db) {
  if (dates.length === 0) throw new Error('Annual leave dates are required');
  const sortedDates = [...dates].sort();
  const workDaysBySchedule = new Map<string, Set<string>>();
  for (const date of sortedDates) {
    const assignment = await tx.query.employeeWorkSchedules.findFirst({
      where: and(
        eq(employeeWorkSchedules.employeeId, employeeId),
        eq(employeeWorkSchedules.isActive, true),
        lte(employeeWorkSchedules.effectiveFrom, date),
        or(isNull(employeeWorkSchedules.effectiveTo), gte(employeeWorkSchedules.effectiveTo, date)),
      ),
      orderBy: (table: any, { desc }: any) => [desc(table.effectiveFrom)],
    });
    if (!assignment) throw new Error(`Employee work schedule is required for annual leave date ${date}`);

    let workDays = workDaysBySchedule.get(assignment.workScheduleId);
    if (!workDays) {
      const days = await tx.select().from(workScheduleDays).where(and(
        eq(workScheduleDays.workScheduleId, assignment.workScheduleId),
        eq(workScheduleDays.isActive, true),
      ));
      workDays = new Set(days.filter((day: any) => !day.isOffDay).map((day: any) => day.dayOfWeek));
      if (workDays.size === 0) throw new Error('Employee work schedule has no working days configured');
      workDaysBySchedule.set(assignment.workScheduleId, workDays);
    }
    if (!workDays.has(dayOfWeek(new Date(`${date}T00:00:00Z`)))) {
      throw new Error(`Annual leave date ${date} is not a scheduled working day`);
    }
  }
}

async function ensureKnownLeaveTypes() {
  await db.insert(leaveTypes)
    .values(KNOWN_LEAVE_TYPES.map((leaveType) => ({ ...leaveType, isActive: true })) as any)
    .onConflictDoNothing({ target: leaveTypes.code });
}

async function getLeaveBalanceById(id: string, tx: DbClient = db) {
  return tx.query.leaveBalances.findFirst({
    where: eq(leaveBalances.id, id),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      fiscalYear: true,
    },
  });
}

async function getLeaveRequestById(id: string, tx: DbClient = db) {
  return tx.query.leaveRequests.findFirst({
    where: eq(leaveRequests.id, id),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
      leaveType: true,
      fiscalYear: true,
      annualLeaveDates: {
        orderBy: (table: any, { asc }: any) => [asc(table.leaveDate)],
      },
      interruptions: {
        with: { dates: true },
        orderBy: (table: any, { desc }: any) => [desc(table.createdAt)],
      },
    },
  });
}

async function getLeaveInterruptionById(id: string, tx: DbClient = db) {
  return tx.query.leaveInterruptions.findFirst({
    where: eq(leaveInterruptions.id, id),
    with: { dates: true },
  });
}

async function getEmployeeFiscalYearBalance(employeeId: string, fiscalYearId: string, tx: DbClient = db) {
  return tx.query.leaveBalances.findFirst({
    where: and(
      eq(leaveBalances.employeeId, employeeId),
      eq(leaveBalances.fiscalYearId, fiscalYearId),
    ),
  });
}

async function getEmployeeById(id: string, tx: DbClient = db) {
  return tx.query.employees.findFirst({ where: eq(employees.id, id) });
}

async function getLeaveTypeById(id: string, tx: DbClient = db) {
  return tx.query.leaveTypes.findFirst({ where: eq(leaveTypes.id, id) });
}

async function getLeaveFiscalYearById(id: string, tx: DbClient = db) {
  return tx.query.leaveFiscalYears.findFirst({ where: eq(leaveFiscalYears.id, id) });
}

async function getActiveLeaveFiscalYear(tx: DbClient = db) {
  return tx.query.leaveFiscalYears.findFirst({ where: eq(leaveFiscalYears.isActive, true) });
}

async function getFiscalYearForDate(value: string, tx: DbClient = db) {
  const found = await tx.query.leaveFiscalYears.findFirst({
    where: and(
      lte(leaveFiscalYears.startsAt, value),
      gte(leaveFiscalYears.endsAt, value),
    ),
  });
  if (found) return found;
  return tx.query.leaveFiscalYears.findFirst({ where: eq(leaveFiscalYears.isActive, true) });
}

async function assertLeaveFiscalYearExists(id: string, tx: DbClient = db) {
  const found = await tx.query.leaveFiscalYears.findFirst({
    where: eq(leaveFiscalYears.id, id),
    columns: { id: true },
  });
  if (!found) throw new Error('Leave fiscal year not found');
}

async function assertUserExists(id: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, id),
    columns: { id: true },
  });
  if (!found) throw new Error('User not found');
}

async function calculateWorkingDays(employeeId: string, startDate: string, endDate: string, tx: DbClient = db) {
  assertDateRange(startDate, endDate);
  const assignment = await tx.query.employeeWorkSchedules.findFirst({
    where: and(
      eq(employeeWorkSchedules.employeeId, employeeId),
      eq(employeeWorkSchedules.isActive, true),
      lte(employeeWorkSchedules.effectiveFrom, startDate),
      or(isNull(employeeWorkSchedules.effectiveTo), gte(employeeWorkSchedules.effectiveTo, endDate)),
    ),
    orderBy: (table: any, { desc }: any) => [desc(table.effectiveFrom)],
  });
  if (!assignment) throw new Error('Employee work schedule is required to calculate leave days');

  const [days, overlappingHolidays] = await Promise.all([
    tx.select().from(workScheduleDays).where(
      and(
        eq(workScheduleDays.workScheduleId, assignment.workScheduleId),
        eq(workScheduleDays.isActive, true),
      ),
    ),
    tx.query.holidays.findMany({
      where: and(
        eq(holidays.isActive, true),
        lte(holidays.startDate, endDate),
        gte(holidays.endDate, startDate),
      ),
    }),
  ]);
  const workDays = new Set(days.filter((day: any) => !day.isOffDay).map((day: any) => day.dayOfWeek));
  if (workDays.size === 0) throw new Error('Employee work schedule has no working days configured');

  const holidayDates = new Set<string>();
  for (const holiday of overlappingHolidays) {
    for (const date of dateRange(formatDateValue(holiday.startDate), formatDateValue(holiday.endDate))) {
      holidayDates.add(date.toISOString().slice(0, 10));
    }
  }

  let count = 0;
  for (const date of dateRange(startDate, endDate)) {
    const iso = date.toISOString().slice(0, 10);
    if (!workDays.has(dayOfWeek(date))) continue;
    if (holidayDates.has(iso)) continue;
    count += 1;
  }
  if (count <= 0) throw new Error('Leave request does not include any scheduled working days');
  return count;
}

function createBalanceTransaction(
  tx: DbClient,
  balance: typeof leaveBalances.$inferSelect,
  type: string,
  days: number,
  createdBy: string | null,
  note: string,
  leaveRequestId?: string | null,
) {
  return tx.insert(leaveBalanceTransactions).values({
    leaveBalanceId: balance.id,
    employeeId: balance.employeeId,
    fiscalYearId: balance.fiscalYearId,
    leaveRequestId: leaveRequestId ?? null,
    type,
    days: fixed(days),
    note,
    createdBy,
  } as any);
}

function isAnnualLeaveType(leaveType: any) {
  return normalizeLeaveCode(leaveType) === 'ANNUAL';
}

function normalizeLeaveCode(leaveType: any) {
  return String(leaveType?.code ?? '').trim().toUpperCase();
}

function assertWithinAllowedDays(leaveType: any, requestedDays: number) {
  if (isAnnualLeaveType(leaveType)) return;
  if (leaveType?.allowedDays === null || leaveType?.allowedDays === undefined) return;

  const allowedDays = numeric(leaveType.allowedDays);
  if (allowedDays > 0 && requestedDays > allowedDays) {
    throw new Error(`${leaveType.nameEn ?? 'Leave'} cannot exceed ${fixed(allowedDays)} day(s) per request`);
  }
}

function assertDateRange(startDate: string, endDate: string) {
  if (new Date(`${startDate}T00:00:00Z`).getTime() > new Date(`${endDate}T00:00:00Z`).getTime()) {
    throw new Error('Start date must be before or equal to end date');
  }
}

function assertTransferWindow(fromFiscalYear: any, toFiscalYear: any) {
  const fromEnd = new Date(`${formatDateValue(fromFiscalYear.endsAt)}T00:00:00Z`).getTime();
  const toStart = new Date(`${formatDateValue(toFiscalYear.startsAt)}T00:00:00Z`).getTime();
  if (toStart <= fromEnd) throw new Error('Target fiscal year must be after source fiscal year');
  const maxCarryForwardMs = 2 * 366 * 24 * 60 * 60 * 1000;
  if (toStart - fromEnd > maxCarryForwardMs) {
    throw new Error('Annual leave cannot be carried forward beyond two fiscal years');
  }
}

function dateRange(startDate: string, endDate: string) {
  const dates: Date[] = [];
  const current = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (current.getTime() <= end.getTime()) {
    dates.push(new Date(current));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function dayOfWeek(date: Date) {
  return ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][date.getUTCDay()];
}

function parseDays(value: string | number, fieldName: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${fieldName} must be a non-negative number`);
  return parsed;
}

function parseAnnualLeaveDayValue(value: string | number, fieldName: string) {
  const parsed = parseDays(value, fieldName);
  if (parsed !== 0.5 && parsed !== 1) throw new Error(`${fieldName} must be 0.50 or 1.00`);
  return parsed;
}

function sumDaySelections(selections: AnnualLeaveDateSelection[]) {
  return selections.reduce((sum, selection) => sum + selection.dayValue, 0);
}

function assertValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Annual leave dates must use YYYY-MM-DD format');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Annual leave dates must be valid dates');
  }
}

function numeric(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function fixed(value: number) {
  return value.toFixed(2);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function yesterday() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function formatDateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}
