import { Hono } from 'hono';
import { ingestZktecoPush } from '../../../lib/zkteco/zkteco-ingestion.service';

const zktecoCdataApp = new Hono();

function getQueryParams(url: string) {
  return Object.fromEntries(new URL(url).searchParams.entries());
}

zktecoCdataApp.get('/', (c) => {
  const sn = c.req.query('SN');
  const query = getQueryParams(c.req.url);

  console.log('ZKTeco GET handshake', {
    sn,
    query,
  });

  return c.text('OK', 200);
});

zktecoCdataApp.post('/', async (c) => {
  const sn = c.req.query('SN');
  const table = c.req.query('table') ?? null;
  const rawBody = await c.req.text();
  const query = getQueryParams(c.req.url);

  console.log('ZKTeco PUSH received', {
    sn,
    table,
    rawBody,
  });

  if (!sn) {
    return c.text('Missing device serial number', 400);
  }

  try {
    await ingestZktecoPush({
      serialNumber: sn,
      table,
      rawBody,
      query,
    });

    return c.text('OK', 200);
  } catch (error) {
    console.error('ZKTeco push failed', error);
    return c.text('ERROR', 500);
  }
});

export default zktecoCdataApp;
