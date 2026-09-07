import type { Context, Next } from 'hono';
import { bodyLimit } from 'hono/body-limit';

const AUTH_MAX_BYTES = 32 * 1024;
const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const ZKTECO_MAX_BYTES = 256 * 1024;
const DEFAULT_MAX_BYTES = 1024 * 1024;

function maxBodyBytes(path: string) {
  if (path.startsWith('/api/auth')) return AUTH_MAX_BYTES;
  if (path.includes('/employees/permanent/import') || path.includes('/employees/contract/import')) {
    return IMPORT_MAX_BYTES;
  }
  if (path.startsWith('/api/zkteco') || path.startsWith('/iclock')) return ZKTECO_MAX_BYTES;
  return DEFAULT_MAX_BYTES;
}

export async function applyBodyLimit(c: Context, next: Next) {
  return bodyLimit({
    maxSize: maxBodyBytes(c.req.path),
    onError: (ctx) => ctx.json({ message: 'Payload too large' }, 413),
  })(c, next);
}
