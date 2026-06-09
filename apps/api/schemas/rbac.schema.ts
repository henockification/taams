import { z } from 'zod';

const PermissionActionSchema = z.enum(['read', 'add', 'edit', 'approve', 'reject']);

export const PermissionSchema = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  name: z.string().openapi({ example: 'users:create' }),
  resource: z.string().openapi({ example: 'users' }),
  action: z.string().openapi({ example: 'read' }),
  description: z.string().nullable().openapi({ example: 'Create users' }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const RoleSchema = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  name: z.string().openapi({ example: 'admin' }),
  description: z.string().nullable().openapi({ example: 'System administrator' }),
  permissions: z.array(PermissionSchema).optional(),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const CreateRoleRequestSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9:_-]+$/).openapi({ example: 'admin' }),
  description: z.string().max(500).optional().openapi({ example: 'System administrator' }),
  permissionIds: z.array(z.string().uuid()).optional().openapi({
    example: ['a52da4a6-4b69-4aa0-865c-1a03fddb731f'],
  }),
});

export const UpdateRoleRequestSchema = z.object({
  name: z.string().min(1).max(80).regex(/^[a-z0-9:_-]+$/).optional().openapi({ example: 'admin' }),
  description: z.string().max(500).nullable().optional().openapi({ example: 'System administrator' }),
});

export const CreatePermissionRequestSchema = z.object({
  name: z.string().min(1).max(120).regex(/^[a-z0-9:_-]+$/).openapi({ example: 'users:read' }),
  resource: z.string().min(1).max(80).regex(/^[a-z0-9:_-]+$/).openapi({ example: 'users' }),
  action: PermissionActionSchema.openapi({ example: 'read' }),
  description: z.string().max(500).optional().openapi({ example: 'Create users' }),
});

export const UpdatePermissionRequestSchema = z.object({
  name: z.string().min(1).max(120).regex(/^[a-z0-9:_-]+$/).optional().openapi({ example: 'users:read' }),
  resource: z.string().min(1).max(80).regex(/^[a-z0-9:_-]+$/).optional().openapi({ example: 'users' }),
  action: PermissionActionSchema.optional().openapi({ example: 'read' }),
  description: z.string().max(500).nullable().optional().openapi({ example: 'Create users' }),
});

export const AssignRolePermissionsRequestSchema = z.object({
  permissionIds: z.array(z.string().uuid()).openapi({
    example: ['a52da4a6-4b69-4aa0-865c-1a03fddb731f'],
    description: 'Replaces the complete permission set for a role',
  }),
});

export const AssignUserRolesRequestSchema = z.object({
  roleIds: z.array(z.string().uuid()).openapi({
    example: ['a52da4a6-4b69-4aa0-865c-1a03fddb731f'],
    description: 'Replaces the complete role set for a user',
  }),
});

export const RolesResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  roles: z.array(RoleSchema),
});

export const RoleResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  role: RoleSchema,
});

export const PermissionsResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  permissions: z.array(PermissionSchema),
});

export const PermissionResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  permission: PermissionSchema,
});
