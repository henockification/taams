import type { Context, Next } from 'hono';
import { getRequestClientIp } from '../../middleware/auth';

export type AdmsTrafficEntry = {
  at: string;
  method: string;
  path: string;
  query: string;
  status: number;
  requestBody: string | null;
  responseBody: string | null;
};

const TRAFFIC_PER_DEVICE = 40;
const TRAFFIC_BODY_PREVIEW = 2048;
// Recent iclock traffic per serial number, for the device console. In memory only: it is
// a troubleshooting view and is gone after a restart. Template data is redacted.
const trafficBySerial = new Map<string, AdmsTrafficEntry[]>();

export function getAdmsTraffic(serialNumber: string) {
  return [...(trafficBySerial.get(serialNumber.toUpperCase()) ?? [])].reverse();
}

// Records device traffic for the console (idle "OK" polls are skipped). ZK_ADMS_DEBUG=true
// also logs every iclock request so the firmware's push dialect can be confirmed.
export async function logAdmsRequest(c: Context, next: Next) {
  let requestBody: string | null = null;
  if (c.req.method === 'POST') {
    const body = await c.req.raw.clone().text().catch(() => '');
    requestBody = redactTemplates(body.slice(0, TRAFFIC_BODY_PREVIEW));
  }
  await next();

  const responseBody = c.res ? await c.res.clone().text().catch(() => null) : null;
  const serialNumber = (c.req.query('SN') ?? c.req.query('sn') ?? '').toUpperCase();
  const idlePoll = c.req.method === 'GET' && responseBody?.trim() === 'OK';
  if (serialNumber && !idlePoll) {
    const entries = trafficBySerial.get(serialNumber) ?? [];
    entries.push({
      at: new Date().toISOString(),
      method: c.req.method,
      path: c.req.path,
      query: new URL(c.req.url).search,
      status: c.res.status,
      requestBody,
      responseBody: responseBody === null ? null : redactTemplates(responseBody.slice(0, TRAFFIC_BODY_PREVIEW)),
    });
    if (entries.length > TRAFFIC_PER_DEVICE) entries.splice(0, entries.length - TRAFFIC_PER_DEVICE);
    trafficBySerial.set(serialNumber, entries);
  }

  if (process.env.ZK_ADMS_DEBUG !== 'true') return;
  console.log('ZKTeco ADMS request', {
    method: c.req.method,
    path: c.req.path,
    query: c.req.query(),
    // Must equal the device's IP in TAAMS, or the device gets no commands.
    clientIp: getRequestClientIp(c),
    status: c.res.status,
    bodyPreview: requestBody === null ? null : requestBody.slice(0, 1024),
  });
}

export function redactTemplates(text: string) {
  return text.replace(/(tmp|TMP|Tmp|content|Content|CONTENT)=[^\t\r\n&]*/g, '$1=<redacted>');
}
