import { timingSafeEqual } from 'node:crypto';
import type { Context } from 'hono';
import { getBiometricDeviceBySerialNumber } from '../../db/orm/core/manageBiometricDevices';
import { getRequestClientIp } from '../../middleware/auth';

export class ZktecoDeviceAuthError extends Error {
  status: 400 | 401 | 403;

  constructor(message: string, status: 400 | 401 | 403 = 401) {
    super(message);
    this.status = status;
  }
}

function secretsEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

function providedPushSecret(c: Context) {
  return c.req.header('x-push-secret')
    || c.req.query('pushSecret')
    || c.req.query('secret')
    || null;
}

export async function requireRegisteredZktecoDevice(c: Context, options: { requirePushAuth?: boolean } = {}) {
  const serialNumber = c.req.query('SN')?.trim();
  if (!serialNumber) {
    throw new ZktecoDeviceAuthError('Missing device serial number', 400);
  }

  const device = await getBiometricDeviceBySerialNumber(serialNumber);
  if (!device || !device.isActive) {
    throw new ZktecoDeviceAuthError('Unknown device', 401);
  }

  if (!options.requirePushAuth) {
    return device;
  }

  const secret = providedPushSecret(c);
  if (device.pushSecret) {
    if (secret && secretsEqual(secret, device.pushSecret)) {
      return device;
    }
  }

  const requestIp = getRequestClientIp(c);
  if (device.ipAddress && requestIp && requestIp === device.ipAddress) {
    return device;
  }

  throw new ZktecoDeviceAuthError('Device authentication failed', 401);
}
