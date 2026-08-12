import { Context } from 'hono';
import { CreateBiometricDeviceSyncRequestSchema } from '../../../../schemas/core.schema';
import {
  getBiometricDeviceById,
  getAttendanceSyncBatchesByDeviceId,
} from '../../../../db/orm/core/manageBiometricDevices';
import { pullZktecoAttendanceForDevice } from '../../../../lib/zkteco/tcp-pull-sync';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatAttendanceSyncBatch } from '../../helpers/formatters';

export async function syncBiometricDeviceHandler(c: Context) {
  try {
    const deviceId = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const parsed = CreateBiometricDeviceSyncRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const biometricDevice = await getBiometricDeviceById(deviceId);

    if (!biometricDevice) {
      return c.json({
        success: false,
        error: 'Biometric device not found',
      }, 404);
    }

    const attendanceSyncBatch = await pullZktecoAttendanceForDevice(biometricDevice);

    return c.json({
      success: true,
      attendanceSyncBatch: formatAttendanceSyncBatch(attendanceSyncBatch),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to sync biometric device');
  }
}

export async function getBiometricDeviceSyncHistoryHandler(c: Context) {
  try {
    const deviceId = c.req.param('id');
    const attendanceSyncBatches = await getAttendanceSyncBatchesByDeviceId(deviceId);

    return c.json({
      success: true,
      attendanceSyncBatches: attendanceSyncBatches.map(formatAttendanceSyncBatch),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch sync history');
  }
}
