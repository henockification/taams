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

function appEnv() {
  return envFlag('APP_ENV');
}

export function isProduction() {
  // Next.js standalone and the Dockerfile always set NODE_ENV=production, even
  // when operators set NODE_ENV=development at runtime. Prefer APP_ENV.
  const explicit = appEnv();
  if (explicit) return explicit === 'production' || explicit === 'prod';
  const nodeEnv = envFlag('NODE_ENV');
  return nodeEnv === 'production' || nodeEnv === 'prod';
}

export function isLocalRuntime() {
  return !isProduction();
}

export function allowMasterOtp() {
  if (!isTruthyEnv('ALLOW_MASTER_OTP')) return false;
  const explicit = appEnv();
  if (explicit === 'production' || explicit === 'prod') return false;
  return true;
}

export function requireAuthSecret() {
  const secret = readEnv('BETTER_AUTH_SECRET')?.trim();
  if (secret) return secret;
  if (isProduction()) {
    throw new Error('BETTER_AUTH_SECRET is required');
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
