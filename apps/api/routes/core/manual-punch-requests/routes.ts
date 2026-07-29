import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../../schemas/shared';
import {
  ChangeManualPunchRequestStatusRequestSchema,
  CreateManualPunchRequestRequestSchema,
  ManualPunchRequestActionResponseSchema,
  ManualPunchRequestResponseSchema,
  ManualPunchRequestsResponseSchema,
} from '../../../schemas/core.schema';
import { openApiApp } from '../../../lib/openapi';
import {
  changeManualPunchRequestStatusHandler,
  createManualPunchRequestHandler,
  getManualPunchRequestsHandler,
} from './handlers/manualPunchRequests';

const manualPunchRequestsApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const createManualPunchRequestRoute = createRoute({
  method: 'post',
  path: '/manual-punch-requests',
  tags: ['Core', 'Manual Punch Requests'],
  summary: 'Create Manual Punch Request',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateManualPunchRequestRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ManualPunchRequestResponseSchema } },
      description: 'Created manual punch request',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getManualPunchRequestsRoute = createRoute({
  method: 'get',
  path: '/manual-punch-requests',
  tags: ['Core', 'Manual Punch Requests'],
  summary: 'Get Manual Punch Requests',
  responses: {
    200: {
      content: { 'application/json': { schema: ManualPunchRequestsResponseSchema } },
      description: 'Manual punch request list',
    },
  },
});

export const changeManualPunchRequestStatusRoute = createRoute({
  method: 'post',
  path: '/manual-punch-requests/{id}/status',
  tags: ['Core', 'Manual Punch Requests'],
  summary: 'Approve or Reject Manual Punch Request',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: ChangeManualPunchRequestStatusRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ManualPunchRequestActionResponseSchema } },
      description: 'Updated manual punch request status',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Manual punch request not found',
    },
  },
});

manualPunchRequestsApp.post('/manual-punch-requests', createManualPunchRequestHandler);
manualPunchRequestsApp.get('/manual-punch-requests', getManualPunchRequestsHandler);
manualPunchRequestsApp.post('/manual-punch-requests/:id/status', changeManualPunchRequestStatusHandler);

openApiApp
  .openapi(createManualPunchRequestRoute, createManualPunchRequestHandler as any)
  .openapi(getManualPunchRequestsRoute, getManualPunchRequestsHandler as any)
  .openapi(changeManualPunchRequestStatusRoute, changeManualPunchRequestStatusHandler as any);

export default manualPunchRequestsApp;
