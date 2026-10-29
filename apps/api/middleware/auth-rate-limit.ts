import type { Context } from 'hono';
import { rateLimiter, type ClientRateLimitInfo, type Store } from 'hono-rate-limiter';
import { getRequestClientIp } from './auth';
import { normalizeLoginEmail, normalizeLoginPhone } from '../lib/login-identifier';

const WINDOW_MS = 15 * 60 * 1000;
const ACCOUNT_ATTEMPT_LIMIT = 10;

/**
 * In-memory hit counts, like the library's default store, but readable and clearable per
 * account so an administrator's "unlock" also lifts the "Too many attempts" block.
 */
class AccountHitStore implements Store {
  localKeys = true;
  private windowMs = WINDOW_MS;
  private readonly hits = new Map<string, ClientRateLimitInfo & { resetTime: Date }>();

  init(options: { windowMs: number }) {
    this.windowMs = options.windowMs;
  }

  private current(key: string, now = Date.now()) {
    const entry = this.hits.get(key);
    if (entry && entry.resetTime.getTime() <= now) {
      this.hits.delete(key);
      return undefined;
    }
    return entry;
  }

  get(key: string) {
    return this.current(key);
  }

  increment(key: string) {
    const now = Date.now();
    // Expired windows are dropped as they are found, and swept now and then so the map stays small.
    if (this.hits.size > 5000) {
      for (const [entryKey, entry] of this.hits) if (entry.resetTime.getTime() <= now) this.hits.delete(entryKey);
    }
    const entry = this.current(key, now) ?? { totalHits: 0, resetTime: new Date(now + this.windowMs) };
    entry.totalHits += 1;
    this.hits.set(key, entry);
    return { ...entry };
  }

  decrement(key: string) {
    const entry = this.current(key);
    if (entry && entry.totalHits > 0) entry.totalHits -= 1;
  }

  resetKey(key: string) {
    this.hits.delete(key);
  }

  /** Keys for an account from any address. */
  keysFor(identifier: string) {
    return [...this.hits.keys()].filter((key) => key.startsWith('account:') && key.endsWith(`:${identifier}`));
  }
}

const accountHitStore = new AccountHitStore();

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

/** One spelling per account, so "0911…" and "+251911…" share a budget an admin can clear. */
function canonicalIdentifier(value: string) {
  const raw = value.trim().toLowerCase().replace(/\s+/g, '');
  if (!raw) return '';
  return normalizeLoginEmail(raw) ?? normalizeLoginPhone(raw) ?? raw;
}

/** The account being targeted (email or phone), read from the JSON body. */
async function requestIdentifier(c: Context) {
  const body = await c.req.json().catch(() => null) as { email?: unknown; phone?: unknown } | null;
  const identifier = typeof body?.email === 'string' && body.email.trim()
    ? body.email
    : typeof body?.phone === 'string' ? body.phone : '';
  return canonicalIdentifier(identifier) || 'no-identifier';
}

const tooManyRequests = (c: Context) => c.json({
  message: 'Too many attempts. Please wait a few minutes and try again.',
  code: 'RATE_LIMITED',
}, 429);

// Per account from one address. Wrong passwords are also counted per account in
// the database (see FAILED_LOGIN_LIMIT), which locks the account itself.
export const authAccountRateLimiter = rateLimiter({
  windowMs: WINDOW_MS,
  limit: ACCOUNT_ATTEMPT_LIMIT,
  store: accountHitStore,
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

function accountKeys(identifiers: Array<string | null | undefined>) {
  return [...new Set(identifiers.map((value) => (value ? canonicalIdentifier(value) : '')).filter(Boolean))]
    .flatMap((identifier) => accountHitStore.keysFor(identifier));
}

/** True while an account is refused with "Too many attempts" from any address. */
export function isSignInThrottled(identifiers: Array<string | null | undefined>) {
  return accountKeys(identifiers).some((key) => (accountHitStore.get(key)?.totalHits ?? 0) >= ACCOUNT_ATTEMPT_LIMIT);
}

/**
 * Clears an account's sign-in attempt counts so it can sign in again at once. Counts live in
 * this server's memory, so this reaches attempts made against this API instance.
 */
export function clearSignInThrottle(identifiers: Array<string | null | undefined>) {
  const keys = accountKeys(identifiers);
  keys.forEach((key) => accountHitStore.resetKey(key));
  return keys.length;
}
