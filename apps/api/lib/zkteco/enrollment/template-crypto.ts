import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

// Face/palm templates are encrypted at rest with AES-256-GCM. The key comes from
// BIOMETRIC_TEMPLATE_KEY (32 bytes as 64 hex chars or base64).
const VERSION_PREFIX = 'v1:';

let cachedKey: Buffer | null = null;

function templateKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.BIOMETRIC_TEMPLATE_KEY?.trim();
  if (!raw) {
    throw new Error('BIOMETRIC_TEMPLATE_KEY is required to store biometric templates');
  }
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('BIOMETRIC_TEMPLATE_KEY must be 32 bytes (64 hex chars or base64)');
  }
  cachedKey = key;
  return key;
}

export function hashTemplate(template: string) {
  return createHash('sha256').update(template).digest('hex');
}

export function encryptTemplate(template: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', templateKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(template, 'utf8'), cipher.final()]);
  return VERSION_PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decryptTemplate(encrypted: string) {
  if (!encrypted.startsWith(VERSION_PREFIX)) {
    throw new Error('Unsupported biometric template encoding');
  }
  const payload = Buffer.from(encrypted.slice(VERSION_PREFIX.length), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', templateKey(), payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
}
