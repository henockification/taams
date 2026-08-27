import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../../schemas/shared';
import {
  CreateSupervisorDelegationRequestSchema,
  SupervisorDelegationResponseSchema,
  SupervisorDelegationsResponseSchema,
} from '../../../schemas/core.schema';
import { openApiApp } from '../../../lib/openapi';
import {
  createSupervisorDelegationHandler,
  getSupervisorDelegationsHandler,
  revokeSupervisorDelegationHandler,
} from './handlers/supervisorDelegations';

const supervisorDelegationsApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const getSupervisorDelegationsRoute = createRoute({
  method: 'get',
  path: '/supervisor-delegations',
  tags: ['Core', 'Supervisor Delegations'],
  summary: 'Get supervisor delegations for current user',
  responses: {
    200: {
      content: { 'application/json': { schema: SupervisorDelegationsResponseSchema } },
      description: 'Supervisor delegations',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Authentication required',
    },
  },
});

export const createSupervisorDelegationRoute = createRoute({
  method: 'post',
  path: '/supervisor-delegations',
  tags: ['Core', 'Supervisor Delegations'],
  summary: 'Create supervisor delegation',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateSupervisorDelegationRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: SupervisorDelegationResponseSchema } },
      description: 'Created supervisor delegation',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const revokeSupervisorDelegationRoute = createRoute({
  method: 'post',
  path: '/supervisor-delegations/{id}/revoke',
  tags: ['Core', 'Supervisor Delegations'],
  summary: 'Revoke supervisor delegation',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: SupervisorDelegationResponseSchema } },
      description: 'Revoked supervisor delegation',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Supervisor delegation not found',
    },
  },
});

supervisorDelegationsApp.get('/supervisor-delegations', getSupervisorDelegationsHandler);
supervisorDelegationsApp.post('/supervisor-delegations', createSupervisorDelegationHandler);
supervisorDelegationsApp.post('/supervisor-delegations/:id/revoke', revokeSupervisorDelegationHandler);

openApiApp
  .openapi(getSupervisorDelegationsRoute, getSupervisorDelegationsHandler as any)
  .openapi(createSupervisorDelegationRoute, createSupervisorDelegationHandler as any)
  .openapi(revokeSupervisorDelegationRoute, revokeSupervisorDelegationHandler as any);

export default supervisorDelegationsApp;
