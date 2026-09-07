export type LoginMethod = 'email' | 'phone';

export function isValidEthiopianPhone(value: string) {
  const digits = value.replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (digits.startsWith('+251') && digits.length >= 13) return true;
  const numeric = digits.replace(/\D/g, '');
  return (
    (numeric.startsWith('251') && numeric.length >= 12)
    || (numeric.startsWith('0') && numeric.length >= 10)
    || (numeric.startsWith('9') && numeric.length >= 9)
  );
}

export function identifierPayload(method: LoginMethod, value: string) {
  const identifier = value.trim();
  return method === 'email' ? { email: identifier } : { phone: identifier };
}
