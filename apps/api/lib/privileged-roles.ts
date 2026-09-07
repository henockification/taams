export const SUPER_ADMIN_ROLE_NAMES = new Set(['super_admin', 'superadmin']);
export const PRIVILEGED_ROLE_NAMES = new Set(['super_admin', 'superadmin', 'admin']);

export function normalizeRoleName(name: string) {
  return name.trim().toLowerCase();
}

export function hasSuperAdminRole(roles?: string[] | null) {
  return (roles ?? []).some((role) => SUPER_ADMIN_ROLE_NAMES.has(normalizeRoleName(role)));
}

export function includesPrivilegedRole(roles?: string[] | null) {
  return (roles ?? []).some((role) => PRIVILEGED_ROLE_NAMES.has(normalizeRoleName(role)));
}
