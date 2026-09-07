import type { Context } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { getRequestClientIp } from './auth';

export const authRateLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  keyGenerator: (c: Context) => getRequestClientIp(c) || c.req.header('x-real-ip') || 'unknown',
  handler: (c: Context) => c.json({ message: 'Too many requests' }, 429),
});
