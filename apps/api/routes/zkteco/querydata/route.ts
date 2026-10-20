import { Hono } from 'hono';
import { ingestZktecoPush } from '../../../lib/zkteco/zkteco-ingestion.service';
import { requireRegisteredZktecoDevice, ZktecoDeviceAuthError } from '../../../lib/zkteco/device-auth';

const zktecoQuerydataApp = new Hono();

// Newer firmware answers "DATA QUERY ..." here (type=tabledata&tablename=user|biodata)
// instead of through cdata. Same handling as a cdata upload.
zktecoQuerydataApp.post('/', async (c) => {
  try {
    const device = await requireRegisteredZktecoDevice(c, { requirePushAuth: true });
    const query = Object.fromEntries(new URL(c.req.url).searchParams.entries());
    await ingestZktecoPush({
      serialNumber: device.serialNumber ?? '',
      table: c.req.query('tablename') ?? c.req.query('table') ?? null,
      rawBody: await c.req.text(),
      query,
    });
    return c.text('OK', 200);
  } catch (error) {
    if (error instanceof ZktecoDeviceAuthError) {
      return c.text('ERROR', error.status);
    }
    console.error('ZKTeco querydata failed', error instanceof Error ? error.message : error);
    return c.text('ERROR', 500);
  }
});

export default zktecoQuerydataApp;
