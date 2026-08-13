import { Hono } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { z } from '@hono/zod-openapi';
import {
  CreateUserRequestSchema,
  UpdateUserRequestSchema,
  UsersResponseSchema,
  UserResponseSchema,
} from '../../schemas/users.schema';
import { AssignUserRolesRequestSchema } from '../../schemas/rbac.schema';
import { AssignUserHrUnitsRequestSchema, UserHrUnitsResponseSchema } from '../../schemas/core.schema';
import { ErrorResponseSchema } from '../../schemas/shared';
import { openApiApp } from '../../lib/openapi';
import { getUsersHandler } from './handlers/getUsersHandler';
import { getUserHandler } from './handlers/getUserHandler';
import { createUserHandler } from './handlers/createUserHandler';
import { updateUserHandler } from './handlers/updateUserHandler';
import { assignUserRolesHandler } from '../rbac/handlers/assignUserRolesHandler';
import { assignUserHrUnitsHandler, getUserHrUnitsHandler } from '../core/handlers/hrUnits';
import { disabledSignupHandler } from './handlers/disabledSignupHandler';

// Create the users app
const usersApp = new Hono();

// Users endpoint route definition
export const usersRoute = createRoute({
  method: 'get',
  path: '/users',
  tags: ['Users'],
  summary: 'Get All Users',
  description: 'Retrieve a list of all users from the database',
  request: {
    query: z.object({
      page: z.string().optional(),
      pageSize: z.string().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UsersResponseSchema,
        },
      },
      description: 'List of users',
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

export const userRoute = createRoute({
  method: 'get',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Get User by ID',
  description: 'Retrieve a user by their ID',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserResponseSchema,
        },
      },
      description: 'User details',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'User not found',
    },
  },
});

export const createUserRoute = createRoute({
  method: 'post',
  path: '/users',
  tags: ['Users'],
  summary: 'Create User',
  description: 'Create a user record and optionally assign roles',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: UserResponseSchema,
        },
      },
      description: 'Created user',
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

export const updateUserRoute = createRoute({
  method: 'patch',
  path: '/users/{id}',
  tags: ['Users'],
  summary: 'Update User',
  description: 'Update a user and optionally replace their assigned roles',
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'user_123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserResponseSchema,
        },
      },
      description: 'Updated user',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'User not found',
    },
  },
});

export const assignUserRolesRoute = createRoute({
  method: 'post',
  path: '/users/{id}/roles',
  tags: ['Users', 'RBAC'],
  summary: 'Assign Roles to User',
  description: 'Replace the complete role set assigned to a user',
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'user_123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: AssignUserRolesRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserResponseSchema,
        },
      },
      description: 'Updated user roles',
    },
    404: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'User not found',
    },
  },
});

export const userHrUnitsRoute = createRoute({
  method: 'get',
  path: '/users/{id}/hr-units',
  tags: ['Users', 'HR Units'],
  summary: 'Get User HR Units',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserHrUnitsResponseSchema,
        },
      },
      description: 'User HR unit memberships',
    },
  },
});

export const assignUserHrUnitsRoute = createRoute({
  method: 'put',
  path: '/users/{id}/hr-units',
  tags: ['Users', 'HR Units'],
  summary: 'Assign HR Units to User',
  request: {
    params: z.object({
      id: z.string().openapi({ example: 'user_123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: AssignUserHrUnitsRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: UserHrUnitsResponseSchema,
        },
      },
      description: 'Updated user HR unit memberships',
    },
  },
});
    
// Register the actual route
usersApp.get('/users', getUsersHandler);
usersApp.post('/users/signup', disabledSignupHandler);
usersApp.get('/users/:id', getUserHandler);
usersApp.post('/users', createUserHandler);
usersApp.patch('/users/:id', updateUserHandler);
usersApp.post('/users/:id/roles', assignUserRolesHandler);
usersApp.get('/users/:id/hr-units', getUserHrUnitsHandler);
usersApp.put('/users/:id/hr-units', assignUserHrUnitsHandler);

// Register the OpenAPI definition
openApiApp.openapi(usersRoute, getUsersHandler)
          .openapi(userRoute, getUserHandler)
          .openapi(createUserRoute, createUserHandler)
          .openapi(updateUserRoute, updateUserHandler)
          .openapi(assignUserRolesRoute, assignUserRolesHandler)
          .openapi(userHrUnitsRoute, getUserHrUnitsHandler as any)
          .openapi(assignUserHrUnitsRoute, assignUserHrUnitsHandler as any);

export default usersApp;
