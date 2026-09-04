import { Context } from 'hono';
import {
  BulkUpsertLeaveBalancesRequestSchema,
  AuthorizeLeaveRequestSchema,
  ChangeLeaveRequestStatusRequestSchema,
  CreateLeaveInterruptionRequestSchema,
  CreateLeaveFiscalYearRequestSchema,
  CreateLeaveRequestRequestSchema,
  CreateLeaveTypeRequestSchema,
  TransferLeaveBalanceRequestSchema,
  ReviewLeaveInterruptionRequestSchema,
  UpdateLeaveFiscalYearRequestSchema,
  UpdateLeaveRequestRequestSchema,
  UpdateLeaveTypeRequestSchema,
  UpsertLeaveBalanceRequestSchema,
} from '../../../../schemas/core.schema';
import {
  bulkUpsertLeaveBalancesScoped,
  authorizeLeaveInterruption,
  authorizeLeaveRequest,
  changeLeaveRequestStatusScoped,
  createLeaveInterruptionScoped,
  createLeaveFiscalYear,
  createLeaveRequest,
  createLeaveType,
  getLeaveBalances,
  getLeaveFiscalYears,
  getLeaveRequests,
  getLeaveTypes,
  reviewLeaveInterruptionScoped,
  setActiveLeaveFiscalYear,
  transferLeaveBalanceScoped,
  updateLeaveFiscalYear,
  updateLeaveRequestScoped,
  updateLeaveType,
  upsertLeaveBalanceScoped,
} from '../../../../db/orm/core/manageLeave';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getUserPermissionNames, getUserRoleNames } from '../../../../db/orm/rbac/manageRbac';
import { assertCanAccessEmployee, resolveEmployeeVisibilityScope } from '../../../../db/orm/core/manageEmployeeVisibility';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import {
  formatLeaveBalance,
  formatLeaveBalanceTransaction,
  formatLeaveFiscalYear,
  formatLeaveRequest,
  formatLeaveType,
} from '../../helpers/formatters';
import { safeEnqueueWorkflowNotification } from '../../../../lib/notifications';
import { refreshAttendanceForAuthorizedLeave } from '../../../../db/orm/core/manageAttendanceApprovals';

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
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const fiscalYearId = c.req.query('fiscalYearId') || undefined;
    const view = c.req.query('view') === 'approvals'
      ? 'approvals'
      : c.req.query('view') === 'authorizations'
        ? 'authorizations'
        : c.req.query('view') === 'management'
          ? 'management'
          : 'self';
    const permissions = view === 'authorizations' ? await getUserPermissionNames(session.user.id) : [];
    const leaveBalances = await getLeaveBalances(fiscalYearId, {
      scope,
      userId: session.user.id,
      view,
      canAuthorize: permissions.includes('leave-authorizations:approve'),
    });
    return c.json({ success: true, leaveBalances: leaveBalances.map(formatLeaveBalance) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch leave balances');
  }
}

export async function upsertLeaveBalanceHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const parsed = UpsertLeaveBalanceRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveBalance = await upsertLeaveBalanceScoped({
      ...parsed.data,
      createdBy: session.user.id ?? c.user?.id ?? parsed.data.createdBy,
      updatedBy: session.user.id ?? c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    }, scope);
    return c.json({ success: true, leaveBalance: formatLeaveBalance(leaveBalance) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to save leave balance');
  }
}

export async function bulkUpsertLeaveBalancesHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const parsed = BulkUpsertLeaveBalancesRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveBalances = await bulkUpsertLeaveBalancesScoped({
      ...parsed.data,
      createdBy: session.user.id ?? c.user?.id ?? parsed.data.createdBy,
      updatedBy: session.user.id ?? c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    }, scope);
    return c.json({ success: true, leaveBalances: leaveBalances.map(formatLeaveBalance) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to bulk save leave balances');
  }
}

export async function transferLeaveBalanceHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const parsed = TransferLeaveBalanceRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const result = await transferLeaveBalanceScoped({
      ...parsed.data,
      approvedBy: session.user.id ?? c.user?.id ?? parsed.data.approvedBy,
    }, scope);
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
    const session = await resolveSession(c);
    const view = c.req.query('view') === 'approvals'
      ? 'approvals'
      : c.req.query('view') === 'authorizations'
        ? 'authorizations'
        : 'self';
    const permissions = view === 'authorizations' ? await getUserPermissionNames(session.user.id) : [];
    const kind = c.req.query('kind') === 'annual'
      ? 'annual'
      : c.req.query('kind') === 'other'
        ? 'other'
        : undefined;
    const leaveRequests = await getLeaveRequests(kind, {
      userId: session.user.id,
      view,
      canAuthorize: permissions.includes('leave-authorizations:approve'),
    });
    return c.json({ success: true, leaveRequests: leaveRequests.map(formatLeaveRequest) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch leave requests');
  }
}

export async function createLeaveRequestHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const parsed = CreateLeaveRequestRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const requestedBy = session.user.id;
    if (!requestedBy) return validationErrorResponse(c, 'requestedBy is required');
    await assertCanAccessEmployee(parsed.data.employeeId, { type: 'self', userId: requestedBy });
    const leaveRequest = await createLeaveRequest({ ...parsed.data, requestedBy });
    // Notification trigger disabled until SMS/email provider credentials are available.
    await safeEnqueueWorkflowNotification('LEAVE_REQUEST_SUBMITTED', {
      entityId: leaveRequest.id,
      employeeId: leaveRequest.employeeId,
      date: `${leaveRequest.startDate} - ${leaveRequest.endDate}`,
      reason: leaveRequest.reason,
    });
    return c.json({ success: true, leaveRequest: formatLeaveRequest(leaveRequest) }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create leave request');
  }
}

export async function updateLeaveRequestHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const parsed = UpdateLeaveRequestRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const updatedBy = session.user.id;
    if (!updatedBy) return validationErrorResponse(c, 'updatedBy is required');
    const leaveRequest = await updateLeaveRequestScoped(c.req.param('id'), { ...parsed.data, updatedBy }, updatedBy);
    return c.json({ success: true, leaveRequest: formatLeaveRequest(leaveRequest) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update leave request');
  }
}

export async function changeLeaveRequestStatusHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const parsed = ChangeLeaveRequestStatusRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const payload = { ...parsed.data };

    if (payload.status === 'APPROVED') {
      payload.approvedBy = session.user.id;
      if (!payload.approvedBy) return validationErrorResponse(c, 'approvedBy is required when approving a leave request');
    } else {
      payload.rejectedBy = session.user.id;
      if (!payload.rejectedBy) return validationErrorResponse(c, 'rejectedBy is required when rejecting a leave request');
    }

    const leaveRequest = await changeLeaveRequestStatusScoped(c.req.param('id'), payload);
    // Notification trigger disabled until SMS/email provider credentials are available.
    await safeEnqueueWorkflowNotification(
      leaveRequest.status === 'APPROVED' ? 'LEAVE_REQUEST_SUPERVISOR_APPROVED' : 'LEAVE_REQUEST_REJECTED',
      {
        entityId: leaveRequest.id,
        employeeId: leaveRequest.employeeId,
        date: `${leaveRequest.startDate} - ${leaveRequest.endDate}`,
        reason: leaveRequest.rejectionReason ?? null,
      },
    );
    return c.json({ success: true, leaveRequest: formatLeaveRequest(leaveRequest) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update leave request status');
  }
}

export async function authorizeLeaveRequestHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    await assertLeaveAuthorizationPermission(session.user.id);
    const parsed = AuthorizeLeaveRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveRequest = await authorizeLeaveRequest(c.req.param('id'), {
      ...parsed.data,
      actorUserId: session.user.id,
    });
    if (leaveRequest.status === 'AUTHORIZED') await refreshAttendanceForAuthorizedLeave(leaveRequest);
    await safeEnqueueWorkflowNotification(
      leaveRequest.status === 'AUTHORIZED' ? 'LEAVE_REQUEST_AUTHORIZED' : 'LEAVE_REQUEST_AUTHORIZATION_REJECTED',
      {
        entityId: leaveRequest.id,
        employeeId: leaveRequest.employeeId,
        date: `${leaveRequest.startDate} - ${leaveRequest.endDate}`,
        reason: leaveRequest.authorizationRejectionReason ?? null,
      },
    );
    return c.json({ success: true, leaveRequest: formatLeaveRequest(leaveRequest) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to authorize leave request');
  }
}

export async function authorizeLeaveInterruptionHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    await assertLeaveAuthorizationPermission(session.user.id);
    const parsed = AuthorizeLeaveRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const leaveRequest = await authorizeLeaveInterruption(c.req.param('id'), {
      ...parsed.data,
      actorUserId: session.user.id,
    });
    if (parsed.data.status === 'AUTHORIZED') await refreshAttendanceForAuthorizedLeave(leaveRequest);
    await safeEnqueueWorkflowNotification(
      parsed.data.status === 'AUTHORIZED' ? 'LEAVE_INTERRUPTION_AUTHORIZED' : 'LEAVE_INTERRUPTION_AUTHORIZATION_REJECTED',
      {
        entityId: c.req.param('id'),
        employeeId: leaveRequest.employeeId,
        date: `${leaveRequest.startDate} - ${leaveRequest.endDate}`,
        reason: parsed.data.rejectionReason ?? null,
      },
    );
    return c.json({ success: true, leaveRequest: formatLeaveRequest(leaveRequest) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to authorize leave interruption');
  }
}

export async function createLeaveInterruptionHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const parsed = CreateLeaveInterruptionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const requestedBy = session.user.id;
    if (!requestedBy) return validationErrorResponse(c, 'requestedBy is required');
    const leaveRequest = await createLeaveInterruptionScoped({
      leaveRequestId: c.req.param('id'),
      ...parsed.data,
      requestedBy,
    }, requestedBy);
    return c.json({ success: true, leaveRequest: formatLeaveRequest(leaveRequest) }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create leave interruption');
  }
}

export async function reviewLeaveInterruptionHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const parsed = ReviewLeaveInterruptionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);
    const reviewedBy = session.user.id;
    if (!reviewedBy) return validationErrorResponse(c, 'reviewedBy is required');
    const leaveRequest = await reviewLeaveInterruptionScoped({
      leaveInterruptionId: c.req.param('id'),
      ...parsed.data,
      reviewedBy,
    });
    if (parsed.data.status === 'APPROVED') {
      await safeEnqueueWorkflowNotification('LEAVE_INTERRUPTION_SUPERVISOR_APPROVED', {
        entityId: c.req.param('id'),
        employeeId: leaveRequest.employeeId,
        date: `${leaveRequest.startDate} - ${leaveRequest.endDate}`,
      });
    }
    return c.json({ success: true, leaveRequest: formatLeaveRequest(leaveRequest) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to review leave interruption');
  }
}

async function resolveSession(c: Context) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');
  const session = await getSessionByToken(token);
  if (!session?.user?.id) throw new Error('Authentication required');
  return session;
}

async function resolveScope(session: Awaited<ReturnType<typeof getSessionByToken>>) {
  if (!session?.user?.id) throw new Error('Authentication required');
  const roles = await resolveRoleNames(session);
  const permissions = await getUserPermissionNames(session.user.id);
  return resolveEmployeeVisibilityScope({
    userId: session.user.id,
    roles,
    permissions: roles.some((role) => role.toLowerCase() === 'human_resource') ? permissions : [],
  });
}

async function resolveRoleNames(session: Awaited<ReturnType<typeof getSessionByToken>>) {
  if (!session?.user?.id) throw new Error('Authentication required');
  const assignedRoles = await getUserRoleNames(session.user.id);
  return [...new Set([...(session.user.role ?? []), ...assignedRoles])];
}

async function assertLeaveAuthorizationPermission(userId: string) {
  const permissions = await getUserPermissionNames(userId);
  if (!permissions.includes('leave-authorizations:approve')) throw new Error('Leave authorization permission is required');
}
