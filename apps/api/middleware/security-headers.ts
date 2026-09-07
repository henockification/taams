import type { Context, Next } from 'hono';
import { isProduction } from '../lib/runtime-env';

export async function securityHeaders(c: Context, next: Next) {
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('Content-Security-Policy', "frame-ancestors 'none'");
  if (isProduction()) {
    c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  await next();
}
