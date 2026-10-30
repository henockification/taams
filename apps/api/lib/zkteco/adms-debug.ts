import { createHash } from 'node:crypto';
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

export type AdmsWatchedLine = {
  at: string;
  direction: 'device' | 'server';
  path: string;
  // The line with its template replaced by length + sha256 (same hash TAAMS stores).
  line: string;
  fields: Record<string, string>;
  templateSha256: string | null;
};

const WATCHED_LINES_MAX = 200;
// One watched PIN per device: every line that names it is kept, however much other traffic
// there is (a BIODATA query uploads the whole device).
const watchBySerial = new Map<string, { pin: string; lines: AdmsWatchedLine[] }>();

export function setAdmsWatch(serialNumber: string, pin: string | null) {
  const key = serialNumber.toUpperCase();
  const current = watchBySerial.get(key);
  if (!pin) {
    watchBySerial.delete(key);
    return;
  }
  if (current?.pin !== pin) watchBySerial.set(key, { pin, lines: [] });
}

export function getAdmsWatch(serialNumber: string) {
  const watch = watchBySerial.get(serialNumber.toUpperCase());
  return watch ? { pin: watch.pin, lines: [...watch.lines].reverse() } : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function captureWatchedLines(serialNumber: string, path: string, direction: AdmsWatchedLine['direction'], body: string | null) {
  const watch = watchBySerial.get(serialNumber);
  if (!watch || !body) return;
  const pinPattern = new RegExp(`(^|[\\s:])pin=${escapeRegExp(watch.pin)}(\\t|\\s|$)`, 'i');
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || !pinPattern.test(line)) continue;
    const fields: Record<string, string> = {};
    let templateSha256: string | null = null;
    for (const part of line.split('\t')) {
      const separator = part.indexOf('=');
      if (separator <= 0) continue;
      const key = part.slice(0, separator).trim().split(' ').pop()!.toLowerCase();
      const value = part.slice(separator + 1).trim();
      if (key === 'tmp') {
        templateSha256 = createHash('sha256').update(value).digest('hex');
        fields.tmp = `<${value.length} chars>`;
      } else {
        fields[key] = value;
      }
    }
    watch.lines.push({
      at: new Date().toISOString(),
      direction,
      path,
      line: line.replace(/(tmp)=([^\t]*)/gi, (_match, key: string, value: string) =>
        `${key}=<${value.length} chars, sha256 ${createHash('sha256').update(value).digest('hex').slice(0, 12)}>`),
      fields,
      templateSha256,
    });
  }
  if (watch.lines.length > WATCHED_LINES_MAX) watch.lines.splice(0, watch.lines.length - WATCHED_LINES_MAX);
}

export function getAdmsTraffic(serialNumber: string) {
  return [...(trafficBySerial.get(serialNumber.toUpperCase()) ?? [])].reverse();
}

// Records device traffic for the console (idle "OK" polls are skipped). ZK_ADMS_DEBUG=true
// also logs every iclock request so the firmware's push dialect can be confirmed.
export async function logAdmsRequest(c: Context, next: Next) {
  const serialNumber = (c.req.query('SN') ?? c.req.query('sn') ?? '').toUpperCase();
  let requestBody: string | null = null;
  if (c.req.method === 'POST') {
    const body = await c.req.raw.clone().text().catch(() => '');
    captureWatchedLines(serialNumber, c.req.path, 'device', body);
    requestBody = redactTemplates(body.slice(0, TRAFFIC_BODY_PREVIEW));
  }
  await next();

  const responseBody = c.res ? await c.res.clone().text().catch(() => null) : null;
  captureWatchedLines(serialNumber, c.req.path, 'server', responseBody);
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
