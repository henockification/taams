import { and, asc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db';
import {
  employeeSupervisors,
  employeeWorkSchedules,
  employees,
  leaveBalanceTransactions,
  leaveBalances,
  leaveFiscalYears,
  leaveRequests,
  leaveTypes,
  user,
  workScheduleDays,
} from '../../schema';
import type {
  BulkUpsertLeaveBalancesInput,
  ChangeLeaveRequestStatusInput,
  CreateLeaveFiscalYearInput,
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  TransferLeaveBalanceInput,
  UpdateLeaveFiscalYearInput,
  UpdateLeaveTypeInput,
  UpsertLeaveBalanceInput,
} from '../../../types/core.types';
import { assertCanAccessEmployee, type EmployeeVisibilityScope } from './manageHrUnits';

type DbClient = typeof db | any;
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

export async function getLeaveBalances(fiscalYearId?: string, scope?: EmployeeVisibilityScope) {
  const balances = await db.query.leaveBalances.findMany({
    where: fiscalYearId ? eq(leaveBalances.fiscalYearId, fiscalYearId) : undefined,
    with: {
      employee: {
        with: {
          department: true,
          hrUnit: true,
          position: true,
        },
      },
      fiscalYear: true,
    },
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });

  if (!scope || scope.type === 'unrestricted') return balances;
  if (scope.type === 'hr_units') {
    return balances.filter((balance) => balance.employee?.hrUnitId && scope.hrUnitIds.includes(balance.employee.hrUnitId));
  }
  return balances.filter((balance) => balance.employee?.userId === scope.userId);
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
    const available = opening + numeric(existing.transferredIn) - numeric(existing.used);
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
        available: fixed(numeric(fromBalance.available) - days),
        updatedBy: input.approvedBy ?? null,
        updatedAt: new Date(),
      } as any)
      .where(eq(leaveBalances.id, fromBalance.id))
      .returning();

    const [updatedTo] = await tx.update(leaveBalances)
      .set({
        transferredIn: fixed(numeric(toBalance.transferredIn) + days),
        available: fixed(numeric(toBalance.available) + days),
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

export async function getLeaveRequests(kind?: 'annual' | 'other', scope?: EmployeeVisibilityScope) {
  await ensureKnownLeaveTypes();
  const requests = await db.query.leaveRequests.findMany({
    with: {
      employee: {
        with: {
          department: true,
          hrUnit: true,
          position: true,
        },
      },
      leaveType: true,
      fiscalYear: true,
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });

  const scopedRequests = await filterLeaveRequestsForViewer(requests, scope);

  if (!kind) return scopedRequests;
  return scopedRequests.filter((request) => isAnnualLeaveType(request.leaveType) === (kind === 'annual'));
}

export async function createLeaveRequest(input: CreateLeaveRequestInput) {
  const employee = await getEmployeeById(input.employeeId);
  if (!employee) throw new Error('Employee not found');
  const leaveType = await getLeaveTypeById(input.leaveTypeId);
  if (!leaveType) throw new Error('Leave type not found');
  if (input.requestedBy) await assertUserExists(input.requestedBy);

  const requiresBalance = isAnnualLeaveType(leaveType);
  if (requiresBalance && !input.fiscalYearId) throw new Error('Fiscal year is required for annual leave');
  const fiscalYear = input.fiscalYearId
    ? await getLeaveFiscalYearById(input.fiscalYearId)
    : null;
  if (input.fiscalYearId && !fiscalYear) throw new Error('Leave fiscal year not found');

  const requestedDays = requiresBalance
    ? await calculateWorkingDays(input.employeeId, input.startDate, input.endDate)
    : calculateCalendarDays(input.startDate, input.endDate);
  assertWithinAllowedDays(leaveType, requestedDays);
  if (requiresBalance) {
    const balance = await getEmployeeFiscalYearBalance(input.employeeId, fiscalYear!.id);
    if (!balance) throw new Error('Annual leave balance not found for this fiscal year');
    if (numeric(balance.available) < requestedDays) throw new Error('Insufficient annual leave balance');
  }

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

export async function changeLeaveRequestStatus(id: string, input: ChangeLeaveRequestStatusInput) {
  return db.transaction(async (tx) => {
    const request = await getLeaveRequestById(id, tx);
    if (!request) throw new Error('Leave request not found');
    if (request.status !== 'PENDING') throw new Error('Leave request is already processed');

    if (input.status === 'REJECTED') {
      const rejectedBy = input.rejectedBy;
      if (!rejectedBy) throw new Error('Rejected by is required when rejecting a leave request');
      await assertUserExists(rejectedBy, tx);
      await assertCanReviewRequest(request.employeeId, rejectedBy, tx);

      const [updated] = await tx.update(leaveRequests).set({
        status: 'REJECTED',
        approvedBy: null,
        approvedAt: null,
        rejectedBy,
        rejectedAt: input.rejectedAt ? new Date(input.rejectedAt) : new Date(),
        rejectionReason: input.rejectionReason ?? null,
        updatedAt: new Date(),
      } as any).where(eq(leaveRequests.id, id)).returning();

      return getLeaveRequestById(updated.id, tx);
    }

    const approvedBy = input.approvedBy;
    if (!approvedBy) throw new Error('Approved by is required when approving a leave request');
    await assertUserExists(approvedBy, tx);
    await assertCanReviewRequest(request.employeeId, approvedBy, tx);

    const leaveType = request.leaveType ?? await getLeaveTypeById(request.leaveTypeId, tx);
    if (isAnnualLeaveType(leaveType)) {
      if (!request.fiscalYearId) throw new Error('Annual leave request has no fiscal year');
      const balance = await getEmployeeFiscalYearBalance(request.employeeId, request.fiscalYearId, tx);
      if (!balance) throw new Error('Annual leave balance not found for this fiscal year');
      const days = numeric(request.requestedDays);
      if (numeric(balance.available) < days) throw new Error('Insufficient annual leave balance');

      const [updatedBalance] = await tx.update(leaveBalances).set({
        used: fixed(numeric(balance.used) + days),
        available: fixed(numeric(balance.available) - days),
        updatedBy: approvedBy,
        updatedAt: new Date(),
      } as any).where(eq(leaveBalances.id, balance.id)).returning();

      await createBalanceTransaction(tx, updatedBalance, 'DEDUCTION', days, approvedBy, 'Annual leave approved', request.id);
    }

    const [updated] = await tx.update(leaveRequests).set({
      status: 'APPROVED',
      approvedBy,
      approvedAt: input.approvedAt ? new Date(input.approvedAt) : new Date(),
      rejectedBy: null,
      rejectedAt: null,
      rejectionReason: null,
      updatedAt: new Date(),
    } as any).where(eq(leaveRequests.id, id)).returning();

    return getLeaveRequestById(updated.id, tx);
  });
}

export async function changeLeaveRequestStatusScoped(id: string, input: ChangeLeaveRequestStatusInput, scope: EmployeeVisibilityScope) {
  const request = await getLeaveRequestById(id);
  if (!request) throw new Error('Leave request not found');
  return changeLeaveRequestStatus(id, input);
}

async function filterLeaveRequestsForViewer(requests: any[], scope?: EmployeeVisibilityScope) {
  if (!scope || scope.type === 'unrestricted') return requests;

  if (scope.type === 'hr_units') {
    return requests.filter((request) => (
      request.status === 'APPROVED'
      && request.employee?.hrUnitId
      && scope.hrUnitIds.includes(request.employee.hrUnitId)
    ));
  }

  const viewerEmployee = await db.query.employees.findFirst({
    where: eq(employees.userId, scope.userId),
    columns: { id: true },
  });
  if (!viewerEmployee) return [];

  const directReportIds = await getDirectReportIds(viewerEmployee.id);
  const visibleEmployeeIds = new Set([viewerEmployee.id, ...directReportIds]);
  return requests.filter((request) => visibleEmployeeIds.has(request.employeeId));
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
          hrUnit: true,
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
          hrUnit: true,
          position: true,
        },
      },
      leaveType: true,
      fiscalYear: true,
    },
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

async function assertCanReviewRequest(employeeId: string, reviewerUserId: string, tx: DbClient = db) {
  const reviewer = await tx.query.user.findFirst({
    where: eq(user.id, reviewerUserId),
    columns: { id: true, role: true },
  });
  if (reviewer?.role?.some((role: string) => ['super_admin', 'admin'].includes(role))) return;

  const reviewerEmployee = await tx.query.employees.findFirst({
    where: eq(employees.userId, reviewerUserId),
    columns: { id: true },
  });
  if (!reviewerEmployee) throw new Error('Reviewer is not linked to an employee record');

  const assignment = await tx.query.employeeSupervisors.findFirst({
    where: and(
      eq(employeeSupervisors.employeeId, employeeId),
      eq(employeeSupervisors.supervisorId, reviewerEmployee.id),
      or(isNull(employeeSupervisors.effectiveTo), gte(employeeSupervisors.effectiveTo, today())),
    ),
    columns: { id: true },
  });
  if (!assignment) throw new Error('Only the direct supervisor or an admin can review this leave request');
}

async function getDirectReportIds(supervisorEmployeeId: string, tx: DbClient = db) {
  const assignments = await tx.query.employeeSupervisors.findMany({
    where: and(
      eq(employeeSupervisors.supervisorId, supervisorEmployeeId),
      or(isNull(employeeSupervisors.effectiveTo), gte(employeeSupervisors.effectiveTo, today())),
    ),
    columns: { employeeId: true },
  });

  return assignments.map((assignment: { employeeId: string }) => assignment.employeeId);
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
  if (!assignment) throw new Error('Employee work schedule is required to calculate annual leave days');

  const days = await tx.select().from(workScheduleDays).where(
    and(
      eq(workScheduleDays.workScheduleId, assignment.workScheduleId),
      eq(workScheduleDays.isActive, true),
    ),
  );
  const workDays = new Set(days.filter((day: any) => !day.isOffDay).map((day: any) => day.dayOfWeek));
  if (workDays.size === 0) throw new Error('Employee work schedule has no working days configured');

  let count = 0;
  for (const date of dateRange(startDate, endDate)) {
    if (workDays.has(dayOfWeek(date))) count += 1;
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

function calculateCalendarDays(startDate: string, endDate: string) {
  assertDateRange(startDate, endDate);
  return dateRange(startDate, endDate).length;
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

function formatDateValue(value: unknown) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;
}
