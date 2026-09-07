function splitOrigins(value?: string) {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function normalizeOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
}

function expandAllowedOrigin(origin: string) {
  const normalizedOrigin = normalizeOrigin(origin);
  const origins = [normalizedOrigin];

  try {
    const parsedOrigin = new URL(normalizedOrigin);
    const isWebOrigin = parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:';
    const isLocalOrigin = parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1';

    if (isWebOrigin && !isLocalOrigin && parsedOrigin.protocol === 'http:') {
      origins.push(`https://${parsedOrigin.host}`);
    }
  } catch {
    // Keep the normalized value for non-URL origin entries.
  }

  return origins;
}

export const allowedCorsOrigins = new Set(
  [
    'http://localhost:3011',
    'https://www.taams.com',
    ...splitOrigins(process.env.FRONT_END_URL),
    ...splitOrigins(process.env.FRONTEND_URL),
    ...splitOrigins(process.env.APP_BASE_URL),
    ...splitOrigins(process.env.CORS_ALLOWED_ORIGINS),
  ].flatMap(expandAllowedOrigin),
);

export function isAllowedRequestOrigin(origin: string | null | undefined) {
  if (!origin) return false;
  return allowedCorsOrigins.has(normalizeOrigin(origin));
}
