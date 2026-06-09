import { Context, Next } from 'hono';
import { timingSafeEqual } from 'node:crypto';

function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Requires `X-API-Key` to match `STOREFRONT_API_KEY` for catalog/storefront public routes.
 * In development, if `STOREFRONT_API_KEY` is unset, requests are allowed (with a warning).
 */
export const requireStorefrontApiKey = async (c: Context, next: Next) => {
  const expected = process.env.STOREFRONT_API_KEY?.trim();
  if (!expected) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        '[storefrontApiKey] STOREFRONT_API_KEY is unset; allowing request (development only)'
      );
      await next();
      return;
    }
    console.error('STOREFRONT_API_KEY is not configured');
    return c.json({ success: false, error: 'Service misconfigured' }, 503);
  }

  const provided = c.req.header('x-api-key')?.trim() ?? '';
  if (!provided || !safeEqual(provided, expected)) {
    return c.json({ success: false, error: 'Invalid or missing API key' }, 401);
  }

  await next();
};
