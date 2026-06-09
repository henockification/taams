import { Hono } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { UsersResponseSchema, UserResponseSchema } from '../../schemas/users.schema';
import { ErrorResponseSchema } from '../../schemas/shared';
import { openApiApp } from '../../lib/openapi';
import { getUsersHandler } from './handlers/getUsersHandler';
import { getUserHandler } from './handlers/getUserHandler';
import { signupHandler } from './handlers/signupHandler';

// Create the users app
const usersApp = new Hono();

// Users endpoint route definition
export const usersRoute = createRoute({
  method: 'get',
  path: '/users',
  tags: ['Users'],
  summary: 'Get All Users',
  description: 'Retrieve a list of all users from the database',
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
    
// Register the actual route
usersApp.get('/users', getUsersHandler);
usersApp.get('/users/:id', getUserHandler);
usersApp.post('/users/signup', signupHandler);

// Register the OpenAPI definition
openApiApp.openapi(usersRoute, getUsersHandler)
          .openapi(userRoute, getUserHandler);

export default usersApp;
