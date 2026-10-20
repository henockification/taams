import { Hono } from 'hono';
import { requireRegisteredZktecoDevice, ZktecoDeviceAuthError } from '../../../lib/zkteco/device-auth';
import { formatCommandLine } from '../../../lib/zkteco/enrollment/commands';
import { admsCommandsEnabled, claimDeviceCommands, markDeviceCommandPoll } from '../../../db/orm/core/manageBiometricEnrollment';

const zktecoGetrequestApp = new Hono();

// Devices poll here for commands. Until ADMS commands are enabled globally and for the
// device, the reply stays the plain "OK" it has always been.
zktecoGetrequestApp.get('/', async (c) => {
  try {
    const device = await requireRegisteredZktecoDevice(c);
    if (!admsCommandsEnabled() || !device.enrollmentSyncEnabled) {
      return c.text('OK', 200);
    }

    // Commands carry biometric templates: only hand them to the authenticated device.
    try {
      await requireRegisteredZktecoDevice(c, { requirePushAuth: true });
    } catch (error) {
      if (!(error instanceof ZktecoDeviceAuthError)) throw error;
      console.warn('ZKTeco command poll failed device authentication', { deviceId: device.id });
      return c.text('OK', 200);
    }

    await markDeviceCommandPoll(device.id, c.req.query('pushver') ?? null);
    const commands = await claimDeviceCommands(device.id);
    if (commands.length === 0) {
      return c.text('OK', 200);
    }
    return c.text(`${commands.map((command) => formatCommandLine(command.id, command.command)).join('\n')}\n`, 200);
  } catch (error) {
    if (error instanceof ZktecoDeviceAuthError) {
      return c.text('ERROR', error.status);
    }
    console.error('ZKTeco getrequest failed', error instanceof Error ? error.message : error);
    return c.text('ERROR', 500);
  }
});

export default zktecoGetrequestApp;
