import { userHasPermission, type AuthzUser } from '@/config/app-navigation';

// ZKTeco BIODATA "Type" values reported by the enrollment API.
export const FACE_BIO_TYPE = 2;
export const PALM_BIO_TYPE = 8;

const BIO_TYPE_LABEL_KEYS: Record<number, 'bioTypeFingerprint' | 'bioTypeFace' | 'bioTypePalm' | 'bioTypeVisibleFace'> = {
  1: 'bioTypeFingerprint',
  2: 'bioTypeFace',
  8: 'bioTypePalm',
  9: 'bioTypeVisibleFace',
};

/** Translates a bioType through the `biometricEnrollment` namespace, falling back to the raw number. */
export function bioTypeLabel(bioType: number, t: (key: string, values?: Record<string, string | number>) => string) {
  const key = BIO_TYPE_LABEL_KEYS[bioType];
  return key ? t(key) : t('bioTypeOther', { bioType });
}

export function isPrivilegedDeviceAdmin(roles: string[] | undefined) {
  return (roles ?? []).some((role) => ['super_admin', 'superadmin', 'admin'].includes(role.toLowerCase()));
}

/** Read-only enrollment view; biometric-devices:read keeps working as it did before enrollment had its own permission. */
export function canViewEnrollment(user: AuthzUser) {
  return userHasPermission(user, 'biometric-enrollment:read') || userHasPermission(user, 'biometric-devices:read');
}

/** Syncing, provisioning and removing enrollments: system administrators, or anyone granted biometric-enrollment:push. */
export function canManageEnrollment(user: AuthzUser) {
  return isPrivilegedDeviceAdmin(user?.role) || userHasPermission(user, 'biometric-enrollment:push');
}
