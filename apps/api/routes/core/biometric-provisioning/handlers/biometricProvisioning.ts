import type { Context } from 'hono';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getUserPermissionNames, getUserRoleNames } from '../../../../db/orm/rbac/manageRbac';
import {
  applyBiometricProvisioningPreview,
  createBiometricProvisioningPreview,
  getBiometricProvisioningJobById,
  getBiometricProvisioningJobs,
  retryFailedBiometricProvisioningDevices,
} from '../../../../db/orm/core/manageBiometricProvisioning';
import { CreateBiometricProvisioningPreviewRequestSchema } from '../../../../schemas/core.schema';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatBiometricProvisioningJob } from '../../helpers/formatters';

export async function createBiometricProvisioningPreviewHandler(c: Context) {
  try {
    const userId = await requireProvisioningAccess(c, 'execute');
    const parsed = CreateBiometricProvisioningPreviewRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const job = await createBiometricProvisioningPreview(parsed.data, userId);
    return c.json(
      {
        success: true,
        biometricProvisioningJob: formatBiometricProvisioningJob(job),
      },
      202,
    );
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to queue biometric provisioning preview');
  }
}

export async function applyBiometricProvisioningPreviewHandler(c: Context) {
  try {
    const userId = await requireProvisioningAccess(c, 'execute');
    const job = await applyBiometricProvisioningPreview(c.req.param('previewId'), userId);
    return c.json(
      {
        success: true,
        biometricProvisioningJob: formatBiometricProvisioningJob(job),
      },
      202,
    );
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to queue biometric provisioning job');
  }
}

export async function retryBiometricProvisioningJobHandler(c: Context) {
  try {
    const userId = await requireProvisioningAccess(c, 'execute');
    const job = await retryFailedBiometricProvisioningDevices(c.req.param('id'), userId);
    return c.json(
      {
        success: true,
        biometricProvisioningJob: formatBiometricProvisioningJob(job),
      },
      202,
    );
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to retry biometric provisioning devices');
  }
}

export async function getBiometricProvisioningJobHandler(c: Context) {
  try {
    await requireProvisioningAccess(c, 'read');
    const job = await getBiometricProvisioningJobById(c.req.param('id'));
    if (!job) return c.json({ success: false, error: 'Biometric provisioning job not found' }, 404);
    return c.json({
      success: true,
      biometricProvisioningJob: formatBiometricProvisioningJob(job),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch biometric provisioning job');
  }
}

export async function getBiometricProvisioningJobsHandler(c: Context) {
  try {
    await requireProvisioningAccess(c, 'read');
    const jobs = await getBiometricProvisioningJobs(Number(c.req.query('limit') ?? 50));
    return c.json({
      success: true,
      biometricProvisioningJobs: jobs.map(formatBiometricProvisioningJob),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch biometric provisioning history');
  }
}

async function requireProvisioningAccess(c: Context, action: 'read' | 'execute') {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');
  const session = await getSessionByToken(token);
  if (!session?.user?.id) throw new Error('Authentication required');

  const [roles, permissions] = await Promise.all([getUserRoleNames(session.user.id), getUserPermissionNames(session.user.id)]);
  const normalizedRoles = roles.map((role) => role.toLowerCase());
  const allowedRole = normalizedRoles.some((role) => ['super_admin', 'superadmin', 'admin', 'human_resource', 'hr'].includes(role));
  const allowedPermission = permissions.includes(`biometric-provisioning:${action}`);

  if (!allowedRole || !allowedPermission) {
    throw new Error('You do not have permission to use biometric provisioning');
  }
  return session.user.id;
}
