import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../../schemas/shared';
import {
  CreateTemporaryDepartmentAssignmentRequestSchema,
  TemporaryDepartmentAssignmentResponseSchema,
  TemporaryDepartmentAssignmentsResponseSchema,
  UpdateTemporaryDepartmentAssignmentRequestSchema,
} from '../../../schemas/core.schema';
import { openApiApp } from '../../../lib/openapi';
import {
  createTemporaryDepartmentAssignmentHandler,
  deactivateTemporaryDepartmentAssignmentHandler,
  getTemporaryDepartmentAssignmentsHandler,
  updateTemporaryDepartmentAssignmentHandler,
} from './handlers/temporaryDepartmentAssignments';

const temporaryDepartmentAssignmentsApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const getTemporaryDepartmentAssignmentsRoute = createRoute({
  method: 'get',
  path: '/temporary-department-assignments',
  tags: ['Core', 'Temporary Department Assignments'],
  summary: 'Get Temporary Department Assignments',
  responses: {
    200: {
      content: { 'application/json': { schema: TemporaryDepartmentAssignmentsResponseSchema } },
      description: 'Temporary department assignments',
    },
  },
});

export const createTemporaryDepartmentAssignmentRoute = createRoute({
  method: 'post',
  path: '/temporary-department-assignments',
  tags: ['Core', 'Temporary Department Assignments'],
  summary: 'Create Temporary Department Assignment',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateTemporaryDepartmentAssignmentRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: TemporaryDepartmentAssignmentResponseSchema } },
      description: 'Created temporary department assignment',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const updateTemporaryDepartmentAssignmentRoute = createRoute({
  method: 'put',
  path: '/temporary-department-assignments/{id}',
  tags: ['Core', 'Temporary Department Assignments'],
  summary: 'Update Temporary Department Assignment',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateTemporaryDepartmentAssignmentRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: TemporaryDepartmentAssignmentResponseSchema } },
      description: 'Updated temporary department assignment',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Assignment not found',
    },
  },
});

export const deactivateTemporaryDepartmentAssignmentRoute = createRoute({
  method: 'post',
  path: '/temporary-department-assignments/{id}/deactivate',
  tags: ['Core', 'Temporary Department Assignments'],
  summary: 'Deactivate Temporary Department Assignment',
  request: { params: uuidParam },
  responses: {
    200: {
      content: { 'application/json': { schema: TemporaryDepartmentAssignmentResponseSchema } },
      description: 'Deactivated temporary department assignment',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Assignment not found',
    },
  },
});

temporaryDepartmentAssignmentsApp.get('/temporary-department-assignments', getTemporaryDepartmentAssignmentsHandler);
temporaryDepartmentAssignmentsApp.post('/temporary-department-assignments', createTemporaryDepartmentAssignmentHandler);
temporaryDepartmentAssignmentsApp.put('/temporary-department-assignments/:id', updateTemporaryDepartmentAssignmentHandler);
temporaryDepartmentAssignmentsApp.post('/temporary-department-assignments/:id/deactivate', deactivateTemporaryDepartmentAssignmentHandler);

openApiApp
  .openapi(getTemporaryDepartmentAssignmentsRoute, getTemporaryDepartmentAssignmentsHandler as any)
  .openapi(createTemporaryDepartmentAssignmentRoute, createTemporaryDepartmentAssignmentHandler as any)
  .openapi(updateTemporaryDepartmentAssignmentRoute, updateTemporaryDepartmentAssignmentHandler as any)
  .openapi(deactivateTemporaryDepartmentAssignmentRoute, deactivateTemporaryDepartmentAssignmentHandler as any);

export default temporaryDepartmentAssignmentsApp;
