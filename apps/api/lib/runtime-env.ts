function readEnv(name: string) {
  return process.env[name];
}

function envFlag(name: string) {
  return (readEnv(name) ?? '').trim().toLowerCase();
}

export function isTruthyEnv(name: string) {
  return ['1', 'true', 'yes', 'on'].includes(envFlag(name));
}

export function isFalsyEnv(name: string) {
  return ['0', 'false', 'no', 'off'].includes(envFlag(name));
}

/**
 * Live-production switch. Do not use NODE_ENV: Docker and Next.js standalone
 * always set NODE_ENV=production, including on HTTP test hosts.
 */
export function isProduction() {
  const env = envFlag('APP_ENV');
  return env === 'production' || env === 'prod';
}

export function isLocalRuntime() {
  return !isProduction();
}

export function allowMasterOtp() {
  if (isProduction()) return false;
  return isTruthyEnv('ALLOW_MASTER_OTP');
}

export function requireAuthSecret() {
  const secret = readEnv('AUTH_SECRET')?.trim() || readEnv('BETTER_AUTH_SECRET')?.trim();
  if (secret) return secret;
  if (isProduction()) {
    throw new Error('AUTH_SECRET is required when APP_ENV=production');
  }
  return 'taams-local-otp-secret';
}

export function cookieShouldBeSecure() {
  if (isTruthyEnv('COOKIE_SECURE')) return true;
  if (isFalsyEnv('COOKIE_SECURE')) return false;
  if (isProduction()) return true;
  return readEnv('FRONTEND_URL')?.startsWith('https://')
    || readEnv('APP_BASE_URL')?.startsWith('https://')
    || false;
}
