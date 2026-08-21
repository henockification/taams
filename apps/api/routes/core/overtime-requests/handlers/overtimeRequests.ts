import { Context } from 'hono';
import {
  ChangeOvertimeRequestStatusRequestSchema,
  CreateOvertimeRequestRequestSchema,
} from '../../../../schemas/core.schema';
import {
  changeOvertimeRequestStatus,
  createOvertimeRequest,
  getOvertimeRequests,
} from '../../../../db/orm/core/manageOvertimeRequests';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getUserPermissionNames } from '../../../../db/orm/rbac/manageRbac';
import { resolveEmployeeVisibilityScope } from '../../../../db/orm/core/manageEmployeeVisibility';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatOvertimeRequest } from '../../helpers/formatters';
// import { safeEnqueueWorkflowNotification } from '../../../../lib/notifications';

export async function createOvertimeRequestHandler(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = CreateOvertimeRequestRequestSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const requestedBy = session.user.id ?? c.user?.id ?? parsed.data.requestedBy;
    if (!requestedBy) return validationErrorResponse(c, 'requestedBy is required');

    const overtimeRequest = await createOvertimeRequest({
      ...parsed.data,
      requestedBy,
    }, scope);
    // Notification trigger disabled until SMS/email provider credentials are available.
    // await safeEnqueueWorkflowNotification('OVERTIME_REQUEST_SUBMITTED', {
    //   entityId: overtimeRequest.id,
    //   employeeId: overtimeRequest.employeeId,
    //   date: overtimeRequest.overtimeDate,
    //   reason: overtimeRequest.reason,
    // });

    return c.json({
      success: true,
      overtimeRequest: formatOvertimeRequest(overtimeRequest),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create overtime request');
  }
}

export async function getOvertimeRequestsHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const overtimeRequests = await getOvertimeRequests({
      scope,
      userId: session.user.id,
      roles: session.user.role ?? [],
      dateFrom: c.req.query('dateFrom'),
      dateTo: c.req.query('dateTo'),
      status: c.req.query('status'),
    });

    return c.json({
      success: true,
      overtimeRequests: overtimeRequests.map(formatOvertimeRequest),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch overtime requests');
  }
}

export async function changeOvertimeRequestStatusHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = ChangeOvertimeRequestStatusRequestSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const overtimeRequest = await changeOvertimeRequestStatus(id, parsed.data, {
      scope,
      reviewerUserId: session.user.id,
      roles: session.user.role ?? [],
    });
    // Notification trigger disabled until SMS/email provider credentials are available.
    // await safeEnqueueWorkflowNotification(
    //   overtimeRequest.status === 'APPROVED' ? 'OVERTIME_REQUEST_APPROVED' : 'OVERTIME_REQUEST_REJECTED',
    //   {
    //     entityId: overtimeRequest.id,
    //     employeeId: overtimeRequest.employeeId,
    //     date: overtimeRequest.overtimeDate,
    //     reason: overtimeRequest.rejectionReason ?? null,
    //     metadata: {
    //       requestedMinutes: overtimeRequest.requestedMinutes,
    //       approvedMinutes: overtimeRequest.approvedMinutes,
    //     },
    //   },
    // );

    return c.json({
      success: true,
      overtimeRequest: formatOvertimeRequest(overtimeRequest),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update overtime request status');
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
  const permissions = await getUserPermissionNames(session.user.id);
  return resolveEmployeeVisibilityScope({
    userId: session.user.id,
    roles: session.user.role ?? [],
    permissions,
  });
}
