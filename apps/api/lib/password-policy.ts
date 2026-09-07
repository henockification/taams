const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  'password1234',
  '123456789012',
  'qwertyuiopas',
  'admin1234567',
  'changeme1234',
  'letmein12345',
]);

export const MIN_PASSWORD_LENGTH = 12;

export function assertPasswordPolicy(password: string, email?: string | null) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }
  if (/\s/.test(password)) {
    throw new Error('Password cannot contain spaces');
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase())) {
    throw new Error('Password is too common');
  }
  const localPart = email?.split('@')[0]?.toLowerCase();
  if (localPart && localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
    throw new Error('Password cannot contain your email');
  }
}
