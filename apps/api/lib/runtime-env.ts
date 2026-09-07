export function isProduction() {
  const env = (process.env.NODE_ENV ?? process.env.APP_ENV ?? '').toLowerCase();
  return env === 'production' || env === 'prod';
}

export function isLocalRuntime() {
  return !isProduction();
}

export function allowMasterOtp() {
  if (isProduction()) return false;
  return process.env.ALLOW_MASTER_OTP === 'true';
}

export function requireAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET?.trim();
  if (secret) return secret;
  if (isProduction()) {
    throw new Error('BETTER_AUTH_SECRET is required');
  }
  return 'taams-local-otp-secret';
}

export function cookieShouldBeSecure() {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  if (isProduction()) return true;
  return process.env.FRONTEND_URL?.startsWith('https://')
    || process.env.APP_BASE_URL?.startsWith('https://')
    || false;
}
