import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import {
  AttendancePunchesResponseSchema,
  AttendancePunchResponseSchema,
  CreateAttendancePunchRequestSchema,
} from '../../../schemas/core.schema';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { openApiApp } from '../../../lib/openapi';
import {
  createAttendancePunchHandler,
  getAttendancePunchesByEmployeeHandler,
  getAttendancePunchesHandler,
  getAttendancePunchesPaginatedHandler,
  getUnprocessedAttendancePunchesHandler,
} from './handlers/attendancePunches';

const attendancePunchesApp = new Hono();

const employeeParam = z.object({
  employeeId: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const createAttendancePunchRoute = createRoute({
  method: 'post',
  path: '/attendance-punches',
  tags: ['Core', 'Attendance Punches'],
  summary: 'Create Attendance Punch',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateAttendancePunchRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: AttendancePunchResponseSchema } },
      description: 'Created attendance punch',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getAttendancePunchesRoute = createRoute({
  method: 'get',
  path: '/attendance-punches',
  tags: ['Core', 'Attendance Punches'],
  summary: 'Get Attendance Punches',
  responses: {
    200: {
      content: { 'application/json': { schema: AttendancePunchesResponseSchema } },
      description: 'Attendance punch list',
    },
  },
});

export const getAttendancePunchesPaginatedRoute = createRoute({
  method: 'get',
  path: '/attendance-punches/paginated',
  tags: ['Core', 'Attendance Punches'],
  summary: 'Get Attendance Punches Paginated',
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional(),
      pageSize: z.coerce.number().int().positive().optional(),
      employeeId: z.string().uuid().optional(),
      deviceId: z.string().uuid().optional(),
      status: z.enum(['processed', 'unprocessed']).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AttendancePunchesResponseSchema } },
      description: 'Attendance punch list with pagination',
    },
  },
});

export const getAttendancePunchesByEmployeeRoute = createRoute({
  method: 'get',
  path: '/attendance-punches/employee/{employeeId}',
  tags: ['Core', 'Attendance Punches'],
  summary: 'Get Attendance Punches By Employee',
  request: {
    params: employeeParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AttendancePunchesResponseSchema } },
      description: 'Employee attendance punches',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Employee not found',
    },
  },
});

export const getUnprocessedAttendancePunchesRoute = createRoute({
  method: 'get',
  path: '/attendance-punches/unprocessed',
  tags: ['Core', 'Attendance Punches'],
  summary: 'Get Unprocessed Attendance Punches',
  responses: {
    200: {
      content: { 'application/json': { schema: AttendancePunchesResponseSchema } },
      description: 'Unprocessed attendance punches',
    },
  },
});

attendancePunchesApp.post('/attendance-punches', createAttendancePunchHandler);
attendancePunchesApp.get('/attendance-punches', getAttendancePunchesHandler);
attendancePunchesApp.get('/attendance-punches/paginated', getAttendancePunchesPaginatedHandler);
attendancePunchesApp.get('/attendance-punches/unprocessed', getUnprocessedAttendancePunchesHandler);
attendancePunchesApp.get('/attendance-punches/employee/:employeeId', getAttendancePunchesByEmployeeHandler);

openApiApp
  .openapi(createAttendancePunchRoute, createAttendancePunchHandler as any)
  .openapi(getAttendancePunchesRoute, getAttendancePunchesHandler as any)
  .openapi(getAttendancePunchesPaginatedRoute, getAttendancePunchesPaginatedHandler as any)
  .openapi(getUnprocessedAttendancePunchesRoute, getUnprocessedAttendancePunchesHandler as any)
  .openapi(getAttendancePunchesByEmployeeRoute, getAttendancePunchesByEmployeeHandler as any);

export default attendancePunchesApp;
