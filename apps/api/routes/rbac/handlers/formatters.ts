export function formatPermission(permission: any) {
  return {
    id: permission.id,
    name: permission.name,
    resource: permission.resource,
    action: permission.action,
    description: permission.description ?? null,
    createdAt: permission.createdAt.toISOString(),
    updatedAt: permission.updatedAt.toISOString(),
  };
}

export function formatRole(role: any) {
  return {
    id: role.id,
    name: role.name,
    description: role.description ?? null,
    permissions: (role.rolePermissions ?? []).map((rolePermission: any) =>
      formatPermission(rolePermission.permission)
    ),
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

export function formatUserLock(user: { lockedUntil?: Date | string | null; failedLoginCount?: number | null }) {
  const lockedUntil = user.lockedUntil ? new Date(user.lockedUntil) : null;
  const locked = Boolean(lockedUntil && !Number.isNaN(lockedUntil.getTime()) && lockedUntil.getTime() > Date.now());
  return {
    locked,
    lockedUntil: locked && lockedUntil ? lockedUntil.toISOString() : null,
    failedLoginCount: user.failedLoginCount ?? 0,
  };
}

export function formatUser(user: any) {
  const roleNames = (user.userRoles ?? []).map((userRole: any) => userRole.role.name);
  const roles = roleNames.length ? roleNames : user.role ?? ['user'];

  return {
    id: user.id,
    name: user.name,
    email: user.email ?? null,
    phone: user.phone ?? null,
    emailVerified: user.emailVerified,
    role: user.role ?? roles,
    roles,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    image: user.image,
    ...formatUserLock(user),
  };
}
