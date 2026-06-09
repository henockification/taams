export const DEV_OTP_CODE = '111111';

export type OtpPurpose = 'password-reset' | 'email-verification';

export function hashOtp(code: string) {
  return `dev-fixed:${code}`;
}

export function verifyOtp(code: string) {
  return code === DEV_OTP_CODE;
}

export async function sendOtp(_identifier: string, _purpose: OtpPurpose) {
  return { success: true };
}
