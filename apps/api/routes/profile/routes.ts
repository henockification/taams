import { Hono } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../schemas/shared';
import { ProfileResponseSchema, UpdateProfileRequestSchema } from '../../schemas/profile.schema';
import { openApiApp } from '../../lib/openapi';
import { getProfileHandler, updateProfileHandler } from './handlers/profileHandler';

const profileApp = new Hono();

export const getProfileRoute = createRoute({
  method: 'get',
  path: '/profile',
  tags: ['Profile'],
  summary: 'Get signed-in user profile',
  responses: {
    200: { content: { 'application/json': { schema: ProfileResponseSchema } }, description: 'Signed-in profile' },
    401: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Authentication required' },
  },
});

export const updateProfileRoute = createRoute({
  method: 'patch',
  path: '/profile',
  tags: ['Profile'],
  summary: 'Update signed-in user profile',
  request: { body: { content: { 'application/json': { schema: UpdateProfileRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: ProfileResponseSchema } }, description: 'Updated signed-in profile' },
    400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Invalid request' },
    401: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Authentication required' },
  },
});

profileApp.get('/profile', getProfileHandler);
profileApp.patch('/profile', updateProfileHandler);

openApiApp
  .openapi(getProfileRoute, getProfileHandler as any)
  .openapi(updateProfileRoute, updateProfileHandler as any);

export default profileApp;
