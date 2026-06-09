import type {
  AssignRolePermissionsInput,
  AssignUserRolesInput,
  CreatePermissionInput,
  CreateRoleInput,
  PermissionResponse,
  PermissionsResponse,
  RoleResponse,
  RolesResponse,
  UpdatePermissionInput,
  UpdateRoleInput,
} from '../types/rbac.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3012';

async function rbacFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || data?.details || `HTTP error! status: ${response.status}`);
  }

  return data as T;
}

export const rbacApi = {
  getRoles: () => rbacFetch<RolesResponse>('/roles'),
  createRole: (input: CreateRoleInput) =>
    rbacFetch<RoleResponse>('/roles', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateRole: ({ roleId, ...input }: UpdateRoleInput) =>
    rbacFetch<RoleResponse>(`/roles/${roleId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  assignRolePermissions: ({ roleId, permissionIds }: AssignRolePermissionsInput) =>
    rbacFetch<RoleResponse>(`/roles/${roleId}/permissions`, {
      method: 'POST',
      body: JSON.stringify({ permissionIds }),
    }),
  getPermissions: () => rbacFetch<PermissionsResponse>('/permissions'),
  createPermission: (input: CreatePermissionInput) =>
    rbacFetch<PermissionResponse>('/permissions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updatePermission: ({ permissionId, ...input }: UpdatePermissionInput) =>
    rbacFetch<PermissionResponse>(`/permissions/${permissionId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  assignUserRoles: ({ userId, roleIds }: AssignUserRolesInput) =>
    rbacFetch(`/users/${userId}/roles`, {
      method: 'POST',
      body: JSON.stringify({ roleIds }),
    }),
};
