import { Hono } from 'hono';
import { requireRegisteredZktecoDevice, ZktecoDeviceAuthError } from '../../../lib/zkteco/device-auth';

const zktecoGetrequestApp = new Hono();

zktecoGetrequestApp.get('/', async (c) => {
  try {
    await requireRegisteredZktecoDevice(c);
    return c.text('OK', 200);
  } catch (error) {
    if (error instanceof ZktecoDeviceAuthError) {
      return c.text('ERROR', error.status);
    }
    return c.text('ERROR', 500);
  }
});

export default zktecoGetrequestApp;
