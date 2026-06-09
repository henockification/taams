export type Permission = {
  id: string;
  name: string;
  resource: string;
  action: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  createdAt: string;
  updatedAt: string;
};

export type RolesResponse = {
  success: boolean;
  roles: Role[];
};

export type RoleResponse = {
  success: boolean;
  role: Role;
};

export type PermissionsResponse = {
  success: boolean;
  permissions: Permission[];
};

export type PermissionResponse = {
  success: boolean;
  permission: Permission;
};

export type CreateRoleInput = {
  name: string;
  description?: string;
  permissionIds?: string[];
};

export type UpdateRoleInput = {
  roleId: string;
  name?: string;
  description?: string | null;
};

export type CreatePermissionInput = {
  name: string;
  resource: string;
  action: string;
  description?: string;
};

export type UpdatePermissionInput = {
  permissionId: string;
  name?: string;
  resource?: string;
  action?: string;
  description?: string | null;
};

export type AssignRolePermissionsInput = {
  roleId: string;
  permissionIds: string[];
};

export type AssignUserRolesInput = {
  userId: string;
  roleIds: string[];
};
