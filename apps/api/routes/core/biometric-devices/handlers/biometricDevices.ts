import { Context } from 'hono';
import {
  CreateBiometricDeviceRequestSchema,
  UpdateBiometricDeviceRequestSchema,
} from '../../../../schemas/core.schema';
import {
  createBiometricDevice,
  getBiometricDeviceById,
  getBiometricDevices,
  markBiometricDeviceConnectionTestResult,
  updateBiometricDevice,
} from '../../../../db/orm/core/manageBiometricDevices';
import { testZktecoConnection } from '../../../../lib/zkteco/test-zkteco-connection';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatBiometricDevice } from '../../helpers/formatters';

export async function createBiometricDeviceHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreateBiometricDeviceRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const biometricDevice = await createBiometricDevice(parsed.data);

    return c.json({
      success: true,
      biometricDevice: formatBiometricDevice(biometricDevice),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create biometric device');
  }
}

export async function getBiometricDevicesHandler(c: Context) {
  try {
    const result = await getBiometricDevices();

    return c.json({
      success: true,
      biometricDevices: result.map(formatBiometricDevice),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch biometric devices');
  }
}

export async function getBiometricDeviceHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const biometricDevice = await getBiometricDeviceById(id);

    if (!biometricDevice) {
      return c.json({
        success: false,
        error: 'Biometric device not found',
      }, 404);
    }

    return c.json({
      success: true,
      biometricDevice: formatBiometricDevice(biometricDevice),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch biometric device');
  }
}

export async function updateBiometricDeviceHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateBiometricDeviceRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const biometricDevice = await updateBiometricDevice(id, {
      ...parsed.data,
      biometricDeviceId: id,
    });

    return c.json({
      success: true,
      biometricDevice: formatBiometricDevice(biometricDevice),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update biometric device');
  }
}

export async function testBiometricDeviceConnectionHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const biometricDevice = await getBiometricDeviceById(id);

    if (!biometricDevice) {
      return c.json({
        success: false,
        error: 'Biometric device not found',
      }, 404);
    }

    const testedAt = new Date();
    const connectionTest = biometricDevice.ipAddress
      ? await testZktecoConnection({
        ipAddress: biometricDevice.ipAddress,
        port: biometricDevice.port,
      })
      : {
        success: false,
        message: 'Device IP address is required to test TCP connection',
        testedAt,
        latencyMs: 0,
      };

    const updatedDevice = await markBiometricDeviceConnectionTestResult(id, {
      success: connectionTest.success,
      message: connectionTest.message,
      testedAt: connectionTest.testedAt,
    });

    return c.json({
      success: true,
      connectionTest: {
        success: connectionTest.success,
        message: connectionTest.message,
        testedAt: connectionTest.testedAt.toISOString(),
        latencyMs: connectionTest.latencyMs,
      },
      biometricDevice: formatBiometricDevice(updatedDevice),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to test biometric device connection');
  }
}
