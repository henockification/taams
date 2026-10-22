import type { Context, Next } from 'hono';
import { getRequestClientIp } from '../../middleware/auth';

// ZK_ADMS_DEBUG=true logs every iclock request (path, query, first 1 KB of the body) so
// the firmware's push dialect can be confirmed. Template data is redacted.
export async function logAdmsRequest(c: Context, next: Next) {
  if (process.env.ZK_ADMS_DEBUG !== 'true') return next();

  let bodyPreview: string | null = null;
  if (c.req.method === 'POST') {
    const body = await c.req.raw.clone().text().catch(() => '');
    bodyPreview = redactTemplates(body.slice(0, 1024));
  }
  await next();
  console.log('ZKTeco ADMS request', {
    method: c.req.method,
    path: c.req.path,
    query: c.req.query(),
    // Must equal the device's IP in TAAMS, or the device gets no commands.
    clientIp: getRequestClientIp(c),
    status: c.res.status,
    bodyPreview,
  });
}

export function redactTemplates(text: string) {
  return text.replace(/(tmp|TMP|Tmp)=[^\t\r\n]*/g, '$1=<redacted>');
}
