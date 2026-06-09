import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import {
  AssignRolePermissionsRequestSchema,
  CreatePermissionRequestSchema,
  CreateRoleRequestSchema,
  PermissionResponseSchema,
  PermissionsResponseSchema,
  RoleResponseSchema,
  RolesResponseSchema,
  UpdatePermissionRequestSchema,
  UpdateRoleRequestSchema,
} from '../../schemas/rbac.schema';
import { ErrorResponseSchema } from '../../schemas/shared';
import { openApiApp } from '../../lib/openapi';
import { assignRolePermissionsHandler } from './handlers/assignRolePermissionsHandler';
import { createPermissionHandler } from './handlers/createPermissionHandler';
import { createRoleHandler } from './handlers/createRoleHandler';
import { getPermissionsHandler } from './handlers/getPermissionsHandler';
import { getRolesHandler } from './handlers/getRolesHandler';
import { updatePermissionHandler } from './handlers/updatePermissionHandler';
import { updateRoleHandler } from './handlers/updateRoleHandler';

const rbacApp = new Hono();

export const getRolesRoute = createRoute({
  method: 'get',
  path: '/roles',
  tags: ['RBAC'],
  summary: 'Get Roles',
  description: 'Retrieve all roles with their permissions',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: RolesResponseSchema,
        },
      },
      description: 'List of roles',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Server error',
    },
  },
});

export const createRoleRoute = createRoute({
  method: 'post',
  path: '/roles',
  tags: ['RBAC'],
  summary: 'Create Role',
  description: 'Create a role and optionally attach permissions',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: RoleResponseSchema,
        },
      },
      description: 'Created role',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request',
    },
  },
});

export const assignRolePermissionsRoute = createRoute({
  method: 'post',
  path: '/roles/{id}/permissions',
  tags: ['RBAC'],
  summary: 'Assign Permissions to Role',
  description: 'Replace the complete permission set assigned to a role',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: AssignRolePermissionsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: RoleResponseSchema,
        },
      },
      description: 'Updated role permissions',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Role not found',
    },
  },
});

export const updateRoleRoute = createRoute({
  method: 'patch',
  path: '/roles/{id}',
  tags: ['RBAC'],
  summary: 'Update Role',
  description: 'Update role metadata',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateRoleRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: RoleResponseSchema,
        },
      },
      description: 'Updated role',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Role not found',
    },
  },
});

export const getPermissionsRoute = createRoute({
  method: 'get',
  path: '/permissions',
  tags: ['RBAC'],
  summary: 'Get Permissions',
  description: 'Retrieve all permissions',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PermissionsResponseSchema,
        },
      },
      description: 'List of permissions',
    },
    500: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Server error',
    },
  },
});

export const createPermissionRoute = createRoute({
  method: 'post',
  path: '/permissions',
  tags: ['RBAC'],
  summary: 'Create Permission',
  description: 'Create a permission',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePermissionRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: PermissionResponseSchema,
        },
      },
      description: 'Created permission',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Invalid request',
    },
  },
});

export const updatePermissionRoute = createRoute({
  method: 'patch',
  path: '/permissions/{id}',
  tags: ['RBAC'],
  summary: 'Update Permission',
  description: 'Update permission metadata',
  request: {
    params: z.object({
      id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePermissionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: PermissionResponseSchema,
        },
      },
      description: 'Updated permission',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Permission not found',
    },
  },
});

rbacApp.get('/roles', getRolesHandler);
rbacApp.post('/roles', createRoleHandler);
rbacApp.patch('/roles/:id', updateRoleHandler);
rbacApp.post('/roles/:id/permissions', assignRolePermissionsHandler);
rbacApp.get('/permissions', getPermissionsHandler);
rbacApp.post('/permissions', createPermissionHandler);
rbacApp.patch('/permissions/:id', updatePermissionHandler);

openApiApp
  .openapi(getRolesRoute, getRolesHandler)
  .openapi(createRoleRoute, createRoleHandler)
  .openapi(updateRoleRoute, updateRoleHandler)
  .openapi(assignRolePermissionsRoute, assignRolePermissionsHandler)
  .openapi(getPermissionsRoute, getPermissionsHandler)
  .openapi(createPermissionRoute, createPermissionHandler)
  .openapi(updatePermissionRoute, updatePermissionHandler);

export default rbacApp;
