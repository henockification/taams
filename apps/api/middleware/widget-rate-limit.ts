import type { Context } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';

// Rate limiting middleware for widget API endpoints
export const widgetRateLimiter = rateLimiter({
  windowMs: 10_000,   // 10 seconds
  limit: 5,           // allow 5 requests per windowMs
  keyGenerator: (c: Context) => {
    const session = c.get('wSession'); // from requireWidgetSession middleware
    const ip = c.req.header('cf-connecting-ip') 
             || c.req.header('x-forwarded-for') 
             || c.req.header('x-real-ip') 
             || c.env?.REMOTE_ADDR 
             || 'unknown';
    return `${session?.installationId || 'anon'}:${ip}`;
  },
  handler: (c: Context) => c.json({ error: 'Too many requests' }, 429),
});
