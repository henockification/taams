import { Context } from 'hono';
import {
  ChangeManualPunchRequestStatusRequestSchema,
  CreateManualPunchRequestRequestSchema,
} from '../../../../schemas/core.schema';
import {
  changeManualPunchRequestStatus,
  createManualPunchRequest,
  getManualPunchRequests,
} from '../../../../db/orm/core/manageManualPunchRequests';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getUserPermissionNames } from '../../../../db/orm/rbac/manageRbac';
import { resolveEmployeeVisibilityScope } from '../../../../db/orm/core/manageHrUnits';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatAttendancePunch, formatManualPunchRequest } from '../../helpers/formatters';

export async function createManualPunchRequestHandler(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const parsed = CreateManualPunchRequestRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const requestedBy = session.user.id ?? c.user?.id ?? parsed.data.requestedBy;

    if (!requestedBy) {
      return validationErrorResponse(c, 'requestedBy is required');
    }

    const manualPunchRequest = await createManualPunchRequest({
      ...parsed.data,
      requestedBy,
    }, scope);

    return c.json({
      success: true,
      manualPunchRequest: formatManualPunchRequest(manualPunchRequest),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create manual punch request');
  }
}

export async function getManualPunchRequestsHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const manualPunchRequests = await getManualPunchRequests(scope);

    return c.json({
      success: true,
      manualPunchRequests: manualPunchRequests.map(formatManualPunchRequest),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch manual punch requests');
  }
}

export async function changeManualPunchRequestStatusHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const body = await c.req.json().catch(() => ({}));
    const parsed = ChangeManualPunchRequestStatusRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const payload = { ...parsed.data };

    if (payload.status === 'APPROVED') {
      payload.approvedBy = session.user.id ?? c.user?.id ?? payload.approvedBy;

      if (!payload.approvedBy) {
        return validationErrorResponse(c, 'approvedBy is required when approving a manual punch request');
      }
    } else {
      payload.rejectedBy = session.user.id ?? c.user?.id ?? payload.rejectedBy;

      if (!payload.rejectedBy) {
        return validationErrorResponse(c, 'rejectedBy is required when rejecting a manual punch request');
      }
    }

    const result = await changeManualPunchRequestStatus(id, payload, scope);

    if (!result.manualPunchRequest) {
      return c.json({
        success: false,
        error: 'Manual punch request not found',
      }, 404);
    }

    return c.json({
      success: true,
      manualPunchRequest: formatManualPunchRequest(result.manualPunchRequest),
      attendancePunch: result.attendancePunch ? formatAttendancePunch(result.attendancePunch) : null,
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update manual punch request status');
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
