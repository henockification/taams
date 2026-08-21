import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../../schemas/shared';
import {
  ChangeOvertimeRequestStatusRequestSchema,
  CreateOvertimeRequestRequestSchema,
  OvertimeRequestResponseSchema,
  OvertimeRequestsResponseSchema,
} from '../../../schemas/core.schema';
import { openApiApp } from '../../../lib/openapi';
import {
  changeOvertimeRequestStatusHandler,
  createOvertimeRequestHandler,
  getOvertimeRequestsHandler,
} from './handlers/overtimeRequests';

const overtimeRequestsApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const createOvertimeRequestRoute = createRoute({
  method: 'post',
  path: '/overtime-requests',
  tags: ['Core', 'Overtime Requests'],
  summary: 'Create Overtime Request',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateOvertimeRequestRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: OvertimeRequestResponseSchema } },
      description: 'Created overtime request',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getOvertimeRequestsRoute = createRoute({
  method: 'get',
  path: '/overtime-requests',
  tags: ['Core', 'Overtime Requests'],
  summary: 'Get Overtime Requests',
  responses: {
    200: {
      content: { 'application/json': { schema: OvertimeRequestsResponseSchema } },
      description: 'Overtime request list',
    },
  },
});

export const changeOvertimeRequestStatusRoute = createRoute({
  method: 'post',
  path: '/overtime-requests/{id}/status',
  tags: ['Core', 'Overtime Requests'],
  summary: 'Approve or Reject Overtime Request',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: ChangeOvertimeRequestStatusRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: OvertimeRequestResponseSchema } },
      description: 'Updated overtime request status',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

overtimeRequestsApp.post('/overtime-requests', createOvertimeRequestHandler);
overtimeRequestsApp.get('/overtime-requests', getOvertimeRequestsHandler);
overtimeRequestsApp.post('/overtime-requests/:id/status', changeOvertimeRequestStatusHandler);

openApiApp
  .openapi(createOvertimeRequestRoute, createOvertimeRequestHandler as any)
  .openapi(getOvertimeRequestsRoute, getOvertimeRequestsHandler as any)
  .openapi(changeOvertimeRequestStatusRoute, changeOvertimeRequestStatusHandler as any);

export default overtimeRequestsApp;
