import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import {
  CreateWorkScheduleDayRequestSchema,
  CreateWorkScheduleRequestSchema,
  UpdateWorkScheduleDayRequestSchema,
  UpdateWorkScheduleRequestSchema,
  WorkScheduleDayResponseSchema,
  WorkScheduleDaysResponseSchema,
  WorkScheduleResponseSchema,
  WorkSchedulesResponseSchema,
} from '../../../schemas/core.schema';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { openApiApp } from '../../../lib/openapi';
import {
  createWorkScheduleDayHandler,
  getWorkScheduleDaysHandler,
  updateWorkScheduleDayHandler,
} from './handlers/workScheduleDays';
import {
  createWorkScheduleHandler,
  getWorkScheduleHandler,
  getWorkSchedulesHandler,
  updateWorkScheduleHandler,
} from './handlers/workSchedules';

const workSchedulesApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const createWorkScheduleRoute = createRoute({
  method: 'post',
  path: '/work-schedules',
  tags: ['Core', 'Work Schedules'],
  summary: 'Create Work Schedule',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateWorkScheduleRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: WorkScheduleResponseSchema } },
      description: 'Created work schedule',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getWorkSchedulesRoute = createRoute({
  method: 'get',
  path: '/work-schedules',
  tags: ['Core', 'Work Schedules'],
  summary: 'Get Work Schedules',
  responses: {
    200: {
      content: { 'application/json': { schema: WorkSchedulesResponseSchema } },
      description: 'Work schedule list',
    },
  },
});

export const getWorkScheduleRoute = createRoute({
  method: 'get',
  path: '/work-schedules/{id}',
  tags: ['Core', 'Work Schedules'],
  summary: 'Get Work Schedule',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: WorkScheduleResponseSchema } },
      description: 'Work schedule detail',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Work schedule not found',
    },
  },
});

export const updateWorkScheduleRoute = createRoute({
  method: 'put',
  path: '/work-schedules/{id}',
  tags: ['Core', 'Work Schedules'],
  summary: 'Update Work Schedule',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateWorkScheduleRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: WorkScheduleResponseSchema } },
      description: 'Updated work schedule',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Work schedule not found',
    },
  },
});

export const createWorkScheduleDayRoute = createRoute({
  method: 'post',
  path: '/work-schedules/{id}/days',
  tags: ['Core', 'Work Schedules'],
  summary: 'Create Work Schedule Day',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: CreateWorkScheduleDayRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: WorkScheduleDayResponseSchema } },
      description: 'Created work schedule day',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getWorkScheduleDaysRoute = createRoute({
  method: 'get',
  path: '/work-schedules/{id}/days',
  tags: ['Core', 'Work Schedules'],
  summary: 'Get Work Schedule Days',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: WorkScheduleDaysResponseSchema } },
      description: 'Work schedule day list',
    },
  },
});

export const updateWorkScheduleDayRoute = createRoute({
  method: 'put',
  path: '/work-schedule-days/{id}',
  tags: ['Core', 'Work Schedules'],
  summary: 'Update Work Schedule Day',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateWorkScheduleDayRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: WorkScheduleDayResponseSchema } },
      description: 'Updated work schedule day',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Work schedule day not found',
    },
  },
});

workSchedulesApp.post('/work-schedules', createWorkScheduleHandler);
workSchedulesApp.get('/work-schedules', getWorkSchedulesHandler);
workSchedulesApp.get('/work-schedules/:id', getWorkScheduleHandler);
workSchedulesApp.put('/work-schedules/:id', updateWorkScheduleHandler);
workSchedulesApp.post('/work-schedules/:id/days', createWorkScheduleDayHandler);
workSchedulesApp.get('/work-schedules/:id/days', getWorkScheduleDaysHandler);
workSchedulesApp.put('/work-schedule-days/:id', updateWorkScheduleDayHandler);

openApiApp
  .openapi(createWorkScheduleRoute, createWorkScheduleHandler as any)
  .openapi(getWorkSchedulesRoute, getWorkSchedulesHandler as any)
  .openapi(getWorkScheduleRoute, getWorkScheduleHandler as any)
  .openapi(updateWorkScheduleRoute, updateWorkScheduleHandler as any)
  .openapi(createWorkScheduleDayRoute, createWorkScheduleDayHandler as any)
  .openapi(getWorkScheduleDaysRoute, getWorkScheduleDaysHandler as any)
  .openapi(updateWorkScheduleDayRoute, updateWorkScheduleDayHandler as any);

export default workSchedulesApp;
