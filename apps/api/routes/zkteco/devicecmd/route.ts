import { Hono } from 'hono';
import { requireRegisteredZktecoDevice, ZktecoDeviceAuthError } from '../../../lib/zkteco/device-auth';
import { parseDeviceCommandReplies } from '../../../lib/zkteco/enrollment/commands';
import { completeDeviceCommands } from '../../../db/orm/core/manageBiometricEnrollment';

const zktecoDevicecmdApp = new Hono();

// Results of the commands handed out by getrequest: "ID=<id>&Return=<code>&CMD=<cmd>" lines.
zktecoDevicecmdApp.post('/', async (c) => {
  try {
    const device = await requireRegisteredZktecoDevice(c, { requirePushAuth: true });
    const replies = parseDeviceCommandReplies(await c.req.text());
    await completeDeviceCommands(device.id, replies);
    return c.text('OK', 200);
  } catch (error) {
    if (error instanceof ZktecoDeviceAuthError) {
      return c.text('ERROR', error.status);
    }
    console.error('ZKTeco devicecmd failed', error instanceof Error ? error.message : error);
    return c.text('ERROR', 500);
  }
});

export default zktecoDevicecmdApp;
