import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { safeSendDirectNotification, workflowNotificationsAreEnabled } from './notifications';
import { hasSuperAdminRole } from './privileged-roles';
import { allowMasterOtp, isTruthyEnv, requireAuthSecret } from './runtime-env';

export const MASTER_OTP_CODE = '424242';
export const OTP_TTL_MINUTES = 10;

export type OtpPurpose = 'sign-in' | 'password-reset' | 'email-verification';

/**
 * Super admins sign in with the fixed code instead of an emailed one when SUPER_ADMIN_FIXED_OTP is on.
 * Sign-in only: the password is still required, whereas a fixed password-reset code would let anyone
 * who knows the super admin's email take over the account.
 */
export function usesSuperAdminFixedOtp(roles?: string[] | null) {
  return isTruthyEnv('SUPER_ADMIN_FIXED_OTP') && hasSuperAdminRole(roles);
}

export function generateOtpCode(options: { fixed?: boolean } = {}) {
  if (options.fixed) return MASTER_OTP_CODE;
  const notificationsEnabled = workflowNotificationsAreEnabled();
  if (!notificationsEnabled) {
    if (!allowMasterOtp()) {
      throw new Error(
        'OTP delivery is not configured. Set ALLOW_MASTER_OTP=true, or enable NOTIFICATIONS_ENABLED with a working email/SMS provider.',
      );
    }
    return MASTER_OTP_CODE;
  }
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(code: string) {
  return createHmac('sha256', requireAuthSecret()).update(code).digest('hex');
}

export function verifyOtp(code: string, expectedHash: string) {
  const actual = Buffer.from(hashOtp(code), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isOtpTestingMode() {
  return allowMasterOtp() && !workflowNotificationsAreEnabled();
}

export async function sendOtp(identifier: string, purpose: OtpPurpose, code: string) {
  const copy = otpCopy(purpose);
  await safeSendDirectNotification({
    eventType: copy.eventType,
    recipientEmail: identifier,
    subject: copy.subject,
    message: `${copy.introduction} Your verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. Do not share this code with anyone.`,
    metadata: { purpose, expiresInMinutes: OTP_TTL_MINUTES },
  });
  return { success: true };
}

function otpCopy(purpose: OtpPurpose) {
  if (purpose === 'sign-in') {
    return {
      eventType: 'AUTH_SIGN_IN_OTP',
      subject: 'Your TAMS sign-in code',
      introduction: 'A sign-in attempt was made for your TAMS account.',
    };
  }
  if (purpose === 'password-reset') {
    return {
      eventType: 'AUTH_PASSWORD_RESET_OTP',
      subject: 'Your TAMS password reset code',
      introduction: 'A password reset was requested for your TAMS account.',
    };
  }
  return {
    eventType: 'AUTH_EMAIL_VERIFICATION_OTP',
    subject: 'Your TAMS email verification code',
    introduction: 'Use this code to verify your TAMS email address.',
  };
}
