export type LoginMethod = 'email' | 'phone';

export const ETHIOPIA_COUNTRY_CODE = '+251';
const LOCAL_MOBILE_LENGTH = 9;

export function toLocalEthiopianMobile(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('251')) digits = digits.slice(3);
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits && !digits.startsWith('9')) {
    const nineIndex = digits.indexOf('9');
    digits = nineIndex >= 0 ? digits.slice(nineIndex) : '';
  }
  return digits.slice(0, LOCAL_MOBILE_LENGTH);
}

export function toCanonicalEthiopianMobile(value: string) {
  const local = toLocalEthiopianMobile(value);
  return local.length === LOCAL_MOBILE_LENGTH ? `${ETHIOPIA_COUNTRY_CODE}${local}` : '';
}

export function isValidLocalEthiopianMobile(value: string) {
  return /^9\d{8}$/.test(toLocalEthiopianMobile(value));
}

export function identifierPayload(method: LoginMethod, value: string) {
  if (method === 'email') {
    return { email: value.trim() };
  }
  return { phone: toCanonicalEthiopianMobile(value) };
}
