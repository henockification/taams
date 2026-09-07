import { Hono } from 'hono';
import { ingestZktecoPush } from '../../../lib/zkteco/zkteco-ingestion.service';
import { requireRegisteredZktecoDevice, ZktecoDeviceAuthError } from '../../../lib/zkteco/device-auth';

const zktecoCdataApp = new Hono();

function getQueryParams(url: string) {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

function deviceAuthError(c: any, error: unknown) {
  if (error instanceof ZktecoDeviceAuthError) {
    return c.text('ERROR', error.status);
  }
  console.error('ZKTeco request failed', error instanceof Error ? error.message : error);
  return c.text('ERROR', 500);
}

zktecoCdataApp.get('/', async (c) => {
  try {
    await requireRegisteredZktecoDevice(c);
    return c.text('OK', 200);
  } catch (error) {
    return deviceAuthError(c, error);
  }
});

zktecoCdataApp.post('/', async (c) => {
  const table = c.req.query('table') ?? null;
  const rawBody = await c.req.text();
  const query = getQueryParams(c.req.url);

  try {
    const device = await requireRegisteredZktecoDevice(c, { requirePushAuth: true });
    await ingestZktecoPush({
      serialNumber: device.serialNumber ?? '',
      table,
      rawBody,
      query,
    });
    return c.text('OK', 200);
  } catch (error) {
    return deviceAuthError(c, error);
  }
});

export default zktecoCdataApp;
