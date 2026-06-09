/**
 * Headers for storefront catalog routes (`/api/categories-public`, `/api/packages-public*`).
 * Must match the API `STOREFRONT_API_KEY`. Uses `NEXT_PUBLIC_*` so the browser can send the key;
 * treat it as a shared client identifier, not a user secret.
 */
export function storefrontApiKeyHeaders(): Record<string, string> {
  const key = process.env.NEXT_PUBLIC_STOREFRONT_API_KEY?.trim();
  if (!key) return {};
  return { 'X-API-Key': key };
}

function storefrontKeyNeededForPath(path: string): boolean {
  return path.includes('/categories-public') || path.includes('/packages-public');
}

/** Merge storefront key into fetch `init.headers` when the URL path targets public catalog APIs. */
export function withStorefrontApiKey(
  pathOrUrl: string,
  init?: RequestInit
): RequestInit {
  if (!storefrontKeyNeededForPath(pathOrUrl)) return init ?? {};
  const extra = storefrontApiKeyHeaders();
  if (Object.keys(extra).length === 0) return init ?? {};
  const h = init?.headers;
  if (h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Headers)) {
    return { ...init, headers: { ...extra, ...h } };
  }
  if (h instanceof Headers) {
    const merged = new Headers(h);
    for (const [k, v] of Object.entries(extra)) merged.set(k, v);
    return { ...init, headers: merged };
  }
  return { ...init, headers: { ...extra } };
}
