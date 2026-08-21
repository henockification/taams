import { Context } from 'hono';
import {
  ChangeBiometricExemptionStatusRequestSchema,
  CreateBiometricExemptionRequestSchema,
  UpdateBiometricExemptionRequestSchema,
} from '../../../../schemas/core.schema';
import {
  changeBiometricExemptionStatus,
  createBiometricExemptionScoped,
  deactivateBiometricExemptionScoped,
  getBiometricExemptions,
  updateBiometricExemptionScoped,
} from '../../../../db/orm/core/manageBiometricExemptions';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getUserPermissionNames } from '../../../../db/orm/rbac/manageRbac';
import { resolveEmployeeVisibilityScope } from '../../../../db/orm/core/manageEmployeeVisibility';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatBiometricExemption } from '../../helpers/formatters';
// import { safeEnqueueWorkflowNotification } from '../../../../lib/notifications';

export async function getBiometricExemptionsHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const biometricExemptions = await getBiometricExemptions({
      scope,
      userId: session.user.id,
      roles: session.user.role ?? [],
    });
    return c.json({
      success: true,
      biometricExemptions: biometricExemptions.map(formatBiometricExemption),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch biometric exemptions');
  }
}

export async function createBiometricExemptionHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const parsed = CreateBiometricExemptionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const biometricExemption = await createBiometricExemptionScoped({
      ...parsed.data,
      requestedBy: session.user.id ?? c.user?.id ?? parsed.data.requestedBy,
      createdBy: session.user.id ?? c.user?.id ?? parsed.data.createdBy,
      updatedBy: session.user.id ?? c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    }, scope);
    // Notification trigger disabled until SMS/email provider credentials are available.
    // if (biometricExemption.employeeId) {
    //   await safeEnqueueWorkflowNotification('BIOMETRIC_EXEMPTION_SUBMITTED', {
    //     entityId: biometricExemption.id,
    //     employeeId: biometricExemption.employeeId,
    //     reason: biometricExemption.reason,
    //   });
    // }

    return c.json({
      success: true,
      biometricExemption: formatBiometricExemption(biometricExemption),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create biometric exemption');
  }
}

export async function changeBiometricExemptionStatusHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const id = c.req.param('id');
    const parsed = ChangeBiometricExemptionStatusRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const biometricExemption = await changeBiometricExemptionStatus(id, {
      ...parsed.data,
      reviewerUserId: session.user.id,
      roles: session.user.role ?? [],
      scope,
    });
    // Notification trigger disabled until SMS/email provider credentials are available.
    // if (biometricExemption?.employeeId) {
    //   await safeEnqueueWorkflowNotification(
    //     biometricExemption.status === 'APPROVED' ? 'BIOMETRIC_EXEMPTION_APPROVED' : 'BIOMETRIC_EXEMPTION_REJECTED',
    //     {
    //       entityId: biometricExemption.id,
    //       employeeId: biometricExemption.employeeId,
    //       reason: biometricExemption.rejectionReason ?? null,
    //     },
    //   );
    // }

    return c.json({
      success: true,
      biometricExemption: formatBiometricExemption(biometricExemption),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update biometric exemption status');
  }
}

export async function updateBiometricExemptionHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const id = c.req.param('id');
    const parsed = UpdateBiometricExemptionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const biometricExemption = await updateBiometricExemptionScoped(id, {
      ...parsed.data,
      biometricExemptionId: id,
      updatedBy: session.user.id ?? c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    }, scope);

    if (!biometricExemption) {
      return c.json({ success: false, error: 'Biometric exemption not found' }, 404);
    }

    return c.json({
      success: true,
      biometricExemption: formatBiometricExemption(biometricExemption),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update biometric exemption');
  }
}

export async function deleteBiometricExemptionHandler(c: Context) {
  try {
    const session = await resolveSession(c);
    const scope = await resolveScope(session);
    const id = c.req.param('id');
    const biometricExemption = await deactivateBiometricExemptionScoped(id, scope, session.user.id ?? c.user?.id ?? null);

    if (!biometricExemption) {
      return c.json({ success: false, error: 'Biometric exemption not found' }, 404);
    }

    return c.json({
      success: true,
      biometricExemption: formatBiometricExemption(biometricExemption),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to remove biometric exemption');
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
