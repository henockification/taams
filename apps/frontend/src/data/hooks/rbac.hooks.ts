import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { rbacApi } from '../api/rbac.api';
import type {
  AssignRolePermissionsInput,
  AssignUserRolesInput,
  CreatePermissionInput,
  CreateRoleInput,
  UpdatePermissionInput,
  UpdateRoleInput,
} from '../types/rbac.types';
import { userQueryKeys } from '../types/api';

export const rbacQueryKeys = {
  all: ['rbac'] as const,
  roles: () => [...rbacQueryKeys.all, 'roles'] as const,
  permissions: () => [...rbacQueryKeys.all, 'permissions'] as const,
};

export function useRoles() {
  return useQuery({
    queryKey: rbacQueryKeys.roles(),
    queryFn: () => rbacApi.getRoles(),
    staleTime: 5 * 60 * 1000,
  });
}

export function usePermissions() {
  return useQuery({
    queryKey: rbacQueryKeys.permissions(),
    queryFn: () => rbacApi.getPermissions(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRoleInput) => rbacApi.createRole(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacQueryKeys.roles() });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateRoleInput) => rbacApi.updateRole(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacQueryKeys.roles() });
    },
  });
}

export function useCreatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePermissionInput) => rbacApi.createPermission(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacQueryKeys.permissions() });
    },
  });
}

export function useUpdatePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePermissionInput) => rbacApi.updatePermission(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacQueryKeys.permissions() });
      queryClient.invalidateQueries({ queryKey: rbacQueryKeys.roles() });
    },
  });
}

export function useAssignRolePermissions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AssignRolePermissionsInput) => rbacApi.assignRolePermissions(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rbacQueryKeys.roles() });
      queryClient.invalidateQueries({ queryKey: rbacQueryKeys.permissions() });
    },
  });
}

export function useAssignUserRoles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AssignUserRolesInput) => rbacApi.assignUserRoles(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: userQueryKeys.detail(variables.userId) });
    },
  });
}
