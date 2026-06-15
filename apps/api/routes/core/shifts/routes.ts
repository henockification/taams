import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import {
  CreateShiftBreakRequestSchema,
  CreateShiftRequestSchema,
  CreateShiftSegmentRequestSchema,
  ShiftBreakResponseSchema,
  ShiftBreaksResponseSchema,
  ShiftResponseSchema,
  ShiftSegmentResponseSchema,
  ShiftSegmentsResponseSchema,
  ShiftsResponseSchema,
  UpdateShiftBreakRequestSchema,
  UpdateShiftRequestSchema,
  UpdateShiftSegmentRequestSchema,
} from '../../../schemas/core.schema';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { openApiApp } from '../../../lib/openapi';
import {
  createShiftBreakHandler,
  getShiftBreaksHandler,
  updateShiftBreakHandler,
} from './handlers/shiftBreaks';
import {
  createShiftHandler,
  getShiftHandler,
  getShiftsHandler,
  updateShiftHandler,
} from './handlers/shifts';
import {
  createShiftSegmentHandler,
  getShiftSegmentsHandler,
  updateShiftSegmentHandler,
} from './handlers/shiftSegments';

const shiftsApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const createShiftRoute = createRoute({
  method: 'post',
  path: '/shifts',
  tags: ['Core', 'Shifts'],
  summary: 'Create Shift',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateShiftRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ShiftResponseSchema } },
      description: 'Created shift',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getShiftsRoute = createRoute({
  method: 'get',
  path: '/shifts',
  tags: ['Core', 'Shifts'],
  summary: 'Get Shifts',
  responses: {
    200: {
      content: { 'application/json': { schema: ShiftsResponseSchema } },
      description: 'Shift list',
    },
  },
});

export const getShiftRoute = createRoute({
  method: 'get',
  path: '/shifts/{id}',
  tags: ['Core', 'Shifts'],
  summary: 'Get Shift',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ShiftResponseSchema } },
      description: 'Shift detail',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Shift not found',
    },
  },
});

export const updateShiftRoute = createRoute({
  method: 'put',
  path: '/shifts/{id}',
  tags: ['Core', 'Shifts'],
  summary: 'Update Shift',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateShiftRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ShiftResponseSchema } },
      description: 'Updated shift',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Shift not found',
    },
  },
});

export const createShiftSegmentRoute = createRoute({
  method: 'post',
  path: '/shifts/{id}/segments',
  tags: ['Core', 'Shifts'],
  summary: 'Create Shift Segment',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: CreateShiftSegmentRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ShiftSegmentResponseSchema } },
      description: 'Created shift segment',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getShiftSegmentsRoute = createRoute({
  method: 'get',
  path: '/shifts/{id}/segments',
  tags: ['Core', 'Shifts'],
  summary: 'Get Shift Segments',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ShiftSegmentsResponseSchema } },
      description: 'Shift segments list',
    },
  },
});

export const updateShiftSegmentRoute = createRoute({
  method: 'put',
  path: '/shift-segments/{id}',
  tags: ['Core', 'Shifts'],
  summary: 'Update Shift Segment',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateShiftSegmentRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ShiftSegmentResponseSchema } },
      description: 'Updated shift segment',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Shift segment not found',
    },
  },
});

export const createShiftBreakRoute = createRoute({
  method: 'post',
  path: '/shifts/{id}/breaks',
  tags: ['Core', 'Shifts'],
  summary: 'Create Shift Break',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: CreateShiftBreakRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ShiftBreakResponseSchema } },
      description: 'Created shift break',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getShiftBreaksRoute = createRoute({
  method: 'get',
  path: '/shifts/{id}/breaks',
  tags: ['Core', 'Shifts'],
  summary: 'Get Shift Breaks',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ShiftBreaksResponseSchema } },
      description: 'Shift breaks list',
    },
  },
});

export const updateShiftBreakRoute = createRoute({
  method: 'put',
  path: '/shift-breaks/{id}',
  tags: ['Core', 'Shifts'],
  summary: 'Update Shift Break',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateShiftBreakRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ShiftBreakResponseSchema } },
      description: 'Updated shift break',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Shift break not found',
    },
  },
});

shiftsApp.post('/shifts', createShiftHandler);
shiftsApp.get('/shifts', getShiftsHandler);
shiftsApp.get('/shifts/:id', getShiftHandler);
shiftsApp.put('/shifts/:id', updateShiftHandler);
shiftsApp.post('/shifts/:id/segments', createShiftSegmentHandler);
shiftsApp.get('/shifts/:id/segments', getShiftSegmentsHandler);
shiftsApp.put('/shift-segments/:id', updateShiftSegmentHandler);
shiftsApp.post('/shifts/:id/breaks', createShiftBreakHandler);
shiftsApp.get('/shifts/:id/breaks', getShiftBreaksHandler);
shiftsApp.put('/shift-breaks/:id', updateShiftBreakHandler);

openApiApp
  .openapi(createShiftRoute, createShiftHandler as any)
  .openapi(getShiftsRoute, getShiftsHandler as any)
  .openapi(getShiftRoute, getShiftHandler as any)
  .openapi(updateShiftRoute, updateShiftHandler as any)
  .openapi(createShiftSegmentRoute, createShiftSegmentHandler as any)
  .openapi(getShiftSegmentsRoute, getShiftSegmentsHandler as any)
  .openapi(updateShiftSegmentRoute, updateShiftSegmentHandler as any)
  .openapi(createShiftBreakRoute, createShiftBreakHandler as any)
  .openapi(getShiftBreaksRoute, getShiftBreaksHandler as any)
  .openapi(updateShiftBreakRoute, updateShiftBreakHandler as any);

export default shiftsApp;
