import { Context } from 'hono';
import {
  CreateBiometricExemptionRequestSchema,
  UpdateBiometricExemptionRequestSchema,
} from '../../../../schemas/core.schema';
import {
  createBiometricExemption,
  deactivateBiometricExemption,
  getBiometricExemptions,
  updateBiometricExemption,
} from '../../../../db/orm/core/manageBiometricExemptions';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatBiometricExemption } from '../../helpers/formatters';

export async function getBiometricExemptionsHandler(c: Context) {
  try {
    const biometricExemptions = await getBiometricExemptions();
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
    const parsed = CreateBiometricExemptionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const biometricExemption = await createBiometricExemption({
      ...parsed.data,
      createdBy: c.user?.id ?? parsed.data.createdBy,
      updatedBy: c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    });

    return c.json({
      success: true,
      biometricExemption: formatBiometricExemption(biometricExemption),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create biometric exemption');
  }
}

export async function updateBiometricExemptionHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const parsed = UpdateBiometricExemptionRequestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const biometricExemption = await updateBiometricExemption(id, {
      ...parsed.data,
      biometricExemptionId: id,
      updatedBy: c.user?.id ?? parsed.data.updatedBy ?? parsed.data.createdBy,
    });

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
    const id = c.req.param('id');
    const biometricExemption = await deactivateBiometricExemption(id, c.user?.id ?? null);

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
