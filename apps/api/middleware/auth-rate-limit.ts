import type { Context } from 'hono';
import { rateLimiter } from 'hono-rate-limiter';
import { getRequestClientIp } from './auth';

const WINDOW_MS = 15 * 60 * 1000;

// Only endpoints that check a password or an OTP are throttled. Session checks,
// sign-out and similar calls must never use up the budget of a user who is
// actually trying to sign in.
const GUARDED_AUTH_PATHS = [
  '/sign-in/email',
  '/request-password-reset',
  '/reset-password',
  '/email-otp/verify-email',
  '/email-otp/send-verification-otp',
];

function isGuardedAuthPath(c: Context) {
  return GUARDED_AUTH_PATHS.some((path) => c.req.path.endsWith(path));
}

function clientIp(c: Context) {
  return getRequestClientIp(c) || 'unknown-ip';
}

/** The account being targeted (email or phone), read from the JSON body. */
async function requestIdentifier(c: Context) {
  const body = await c.req.json().catch(() => null) as { email?: unknown; phone?: unknown } | null;
  const identifier = typeof body?.email === 'string' && body.email.trim()
    ? body.email
    : typeof body?.phone === 'string' ? body.phone : '';
  return identifier.trim().toLowerCase().replace(/\s+/g, '') || 'no-identifier';
}

const tooManyRequests = (c: Context) => c.json({
  message: 'Too many attempts. Please wait a few minutes and try again.',
  code: 'RATE_LIMITED',
}, 429);

// Per account from one address. Wrong passwords are also counted per account in
// the database (see FAILED_LOGIN_LIMIT), which locks the account itself.
export const authAccountRateLimiter = rateLimiter({
  windowMs: WINDOW_MS,
  limit: 10,
  skip: (c: Context) => !isGuardedAuthPath(c),
  keyGenerator: async (c: Context) => `account:${clientIp(c)}:${await requestIdentifier(c)}`,
  handler: tooManyRequests,
});

// Per address across all accounts. Offices share one public IP, so this is
// generous; it only stops one address from trying many accounts.
export const authIpRateLimiter = rateLimiter({
  windowMs: WINDOW_MS,
  limit: 100,
  skip: (c: Context) => !isGuardedAuthPath(c),
  keyGenerator: (c: Context) => `ip:${clientIp(c)}`,
  handler: tooManyRequests,
});
