import type { Context, Next } from 'hono';
import { isAllowedRequestOrigin, normalizeOrigin } from '../lib/cors';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originFromReferer(referer: string | undefined) {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return normalizeOrigin(referer);
  }
}

export async function requireCsrfOrigin(c: Context, next: Next) {
  if (SAFE_METHODS.has(c.req.method)) {
    return next();
  }

  const path = c.req.path;
  if (path.startsWith('/api/zkteco') || path.startsWith('/iclock')) {
    return next();
  }

  const origin = c.req.header('origin') || originFromReferer(c.req.header('referer'));
  if (!isAllowedRequestOrigin(origin)) {
    return c.json({ message: 'Invalid request origin' }, 403);
  }

  return next();
}
