import { normalizeEthiopianPhone } from './notifications';

export type LoginIdentifier = {
  email?: string;
  phone?: string;
  identifier: string;
};

export function normalizeLoginEmail(value?: string | null) {
  const email = value?.trim().toLowerCase() || '';
  return email.includes('@') ? email : null;
}

export function normalizeLoginPhone(value?: string | null) {
  return normalizeEthiopianPhone(value);
}

export function parseLoginIdentifier(input: { email?: unknown; phone?: unknown }): LoginIdentifier | null {
  const email = typeof input.email === 'string' ? normalizeLoginEmail(input.email) : null;
  if (email) {
    return { email, identifier: email };
  }

  const phoneRaw = typeof input.phone === 'string' ? input.phone : '';
  const phone = normalizeLoginPhone(phoneRaw);
  if (phone) {
    return { phone, identifier: phone };
  }

  return null;
}

export function assertUserHasLoginIdentifier(email?: string | null, phone?: string | null) {
  if (!email && !phone) {
    throw new Error('An email or phone number is required');
  }
}
