import { Context } from 'hono';
import {
  BulkUpsertLeaveBalancesRequestSchema,
  ChangeLeaveRequestStatusRequestSchema,
  CreateLeaveFiscalYearRequestSchema,
  CreateLeaveRequestRequestSchema,
  CreateLeaveTypeRequestSchema,
  TransferLeaveBalanceRequestSchema,
  UpdateLeaveFiscalYearRequestSchema,
  UpdateLeaveTypeRequestSchema,
  UpsertLeaveBalanceRequestSchema,
} from '../../../../schemas/core.schema';
import {
  bulkUpsertLeaveBalances,
  changeLeaveRequestStatus,
  createLeaveFiscalYear,
  createLeaveRequest,
  createLeaveType,
  getLeaveBalances,
  getLeaveFiscalYears,
  getLeaveRequests,
  getLeaveTypes,
  setActiveLeaveFiscalYear,
  transferLeaveBalance,
  updateLeaveFiscalYear,
  updateLeaveType,
  upsertLeaveBalance,
} from '../../../../db/orm/core/manageLeave';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import {
  formatLeaveBalance,
  formatLeaveBalanceTransaction,
  formatLeaveFiscalYear,
  formatLeaveRequest,
  formatLeaveType,
} from '../../helpers/formatters';

export async function getLeaveFiscalYearsHandler(c: Context) {
  try {
    const leaveFiscalYears = await getLeaveFiscalYears();
    return c.json({ success: true, leaveFiscalYears: leaveFiscalYears.map(formatLeaveFiscalYear) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch leave fiscal years');
  }
}

export async function createLeaveFiscalYearHandler(c: Context) {
  try {
    const parsed = CreateLeaveFiscalYearRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveFiscalYear = await createLeaveFiscalYear(parsed.data);
    return c.json({ success: true, leaveFiscalYear: formatLeaveFiscalYear(leaveFiscalYear) }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create leave fiscal year');
  }
}

export async function updateLeaveFiscalYearHandler(c: Context) {
  try {
    const parsed = UpdateLeaveFiscalYearRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveFiscalYear = await updateLeaveFiscalYear(c.req.param('id'), {
      fiscalYearId: c.req.param('id'),
      ...parsed.data,
    });
    return c.json({ success: true, leaveFiscalYear: formatLeaveFiscalYear(leaveFiscalYear) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update leave fiscal year');
  }
}

export async function setActiveLeaveFiscalYearHandler(c: Context) {
  try {
    const leaveFiscalYear = await setActiveLeaveFiscalYear(c.req.param('id'));
    return c.json({ success: true, leaveFiscalYear: formatLeaveFiscalYear(leaveFiscalYear) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to set active leave fiscal year');
  }
}

export async function getLeaveTypesHandler(c: Context) {
  try {
    const leaveTypes = await getLeaveTypes();
    return c.json({ success: true, leaveTypes: leaveTypes.map(formatLeaveType) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch leave types');
  }
}

export async function createLeaveTypeHandler(c: Context) {
  try {
    const parsed = CreateLeaveTypeRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveType = await createLeaveType(parsed.data);
    return c.json({ success: true, leaveType: formatLeaveType(leaveType) }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create leave type');
  }
}

export async function updateLeaveTypeHandler(c: Context) {
  try {
    const parsed = UpdateLeaveTypeRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveType = await updateLeaveType(c.req.param('id'), {
      leaveTypeId: c.req.param('id'),
      ...parsed.data,
    });
    return c.json({ success: true, leaveType: formatLeaveType(leaveType) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update leave type');
  }
}

export async function getLeaveBalancesHandler(c: Context) {
  try {
    const fiscalYearId = c.req.query('fiscalYearId') || undefined;
    const leaveBalances = await getLeaveBalances(fiscalYearId);
    return c.json({ success: true, leaveBalances: leaveBalances.map(formatLeaveBalance) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch leave balances');
  }
}

export async function upsertLeaveBalanceHandler(c: Context) {
  try {
    const parsed = UpsertLeaveBalanceRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveBalance = await upsertLeaveBalance({
      ...parsed.data,
      createdBy: c.user?.id ?? parsed.data.createdBy,
      updatedBy: c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    });
    return c.json({ success: true, leaveBalance: formatLeaveBalance(leaveBalance) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to save leave balance');
  }
}

export async function bulkUpsertLeaveBalancesHandler(c: Context) {
  try {
    const parsed = BulkUpsertLeaveBalancesRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveBalances = await bulkUpsertLeaveBalances({
      ...parsed.data,
      createdBy: c.user?.id ?? parsed.data.createdBy,
      updatedBy: c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    });
    return c.json({ success: true, leaveBalances: leaveBalances.map(formatLeaveBalance) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to bulk save leave balances');
  }
}

export async function transferLeaveBalanceHandler(c: Context) {
  try {
    const parsed = TransferLeaveBalanceRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const result = await transferLeaveBalance({
      ...parsed.data,
      approvedBy: c.user?.id ?? parsed.data.approvedBy,
    });
    return c.json({
      success: true,
      fromBalance: formatLeaveBalance(result.fromBalance),
      toBalance: formatLeaveBalance(result.toBalance),
      transactions: result.transactions.map(formatLeaveBalanceTransaction),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to transfer leave balance');
  }
}

export async function getLeaveRequestsHandler(c: Context) {
  try {
    const kind = c.req.query('kind') === 'annual'
      ? 'annual'
      : c.req.query('kind') === 'other'
        ? 'other'
        : undefined;
    const leaveRequests = await getLeaveRequests(kind);
    return c.json({ success: true, leaveRequests: leaveRequests.map(formatLeaveRequest) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch leave requests');
  }
}

export async function createLeaveRequestHandler(c: Context) {
  try {
    const parsed = CreateLeaveRequestRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const requestedBy = c.user?.id ?? parsed.data.requestedBy;
    if (!requestedBy) return validationErrorResponse(c, 'requestedBy is required');
    const leaveRequest = await createLeaveRequest({ ...parsed.data, requestedBy });
    return c.json({ success: true, leaveRequest: formatLeaveRequest(leaveRequest) }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create leave request');
  }
}

export async function changeLeaveRequestStatusHandler(c: Context) {
  try {
    const parsed = ChangeLeaveRequestStatusRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const payload = { ...parsed.data };

    if (payload.status === 'APPROVED') {
      payload.approvedBy = c.user?.id ?? payload.approvedBy;
      if (!payload.approvedBy) return validationErrorResponse(c, 'approvedBy is required when approving a leave request');
    } else {
      payload.rejectedBy = c.user?.id ?? payload.rejectedBy;
      if (!payload.rejectedBy) return validationErrorResponse(c, 'rejectedBy is required when rejecting a leave request');
    }

    const leaveRequest = await changeLeaveRequestStatus(c.req.param('id'), payload);
    return c.json({ success: true, leaveRequest: formatLeaveRequest(leaveRequest) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update leave request status');
  }
}
