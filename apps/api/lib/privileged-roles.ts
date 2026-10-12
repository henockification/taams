export const SUPER_ADMIN_ROLE_NAMES = new Set(['super_admin', 'superadmin']);
export const PRIVILEGED_ROLE_NAMES = new Set(['super_admin', 'superadmin', 'admin']);

export function normalizeRoleName(name: string) {
  return name.trim().toLowerCase();
}

const HR_SUPERVISOR_UNRESTRICTED_ROLE_NAMES = new Set(['super_admin', 'superadmin', 'admin', 'executive']);

/**
 * HR setup operations (organization structure, department assignments, shifts, work
 * schedules, holidays, biometric exemptions) need both the human_resource and the
 * supervisor role, unless the user holds an unrestricted role.
 */
export function hasHrSupervisorRoles(roles?: string[] | null) {
  const names = new Set((roles ?? []).map(normalizeRoleName));
  if ([...names].some((role) => HR_SUPERVISOR_UNRESTRICTED_ROLE_NAMES.has(role))) return true;
  return names.has('human_resource') && names.has('supervisor');
}

export function hasSuperAdminRole(roles?: string[] | null) {
  return (roles ?? []).some((role) => SUPER_ADMIN_ROLE_NAMES.has(normalizeRoleName(role)));
}

export function includesPrivilegedRole(roles?: string[] | null) {
  return (roles ?? []).some((role) => PRIVILEGED_ROLE_NAMES.has(normalizeRoleName(role)));
}
