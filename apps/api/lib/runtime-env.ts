function envFlag(value?: string | null) {
  return (value ?? '').trim().toLowerCase();
}

export function isProduction() {
  const env = envFlag(process.env.NODE_ENV || process.env.APP_ENV);
  return env === 'production' || env === 'prod';
}

export function isLocalRuntime() {
  return !isProduction();
}

export function allowMasterOtp() {
  if (isProduction()) return false;
  return ['1', 'true', 'yes', 'on'].includes(envFlag(process.env.ALLOW_MASTER_OTP));
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
  const cookieSecure = envFlag(process.env.COOKIE_SECURE);
  if (cookieSecure === 'true' || cookieSecure === '1' || cookieSecure === 'yes' || cookieSecure === 'on') return true;
  if (cookieSecure === 'false' || cookieSecure === '0' || cookieSecure === 'no' || cookieSecure === 'off') return false;
  if (isProduction()) return true;
  return process.env.FRONTEND_URL?.startsWith('https://')
    || process.env.APP_BASE_URL?.startsWith('https://')
    || false;
}
