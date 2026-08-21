import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../../schemas/shared';
import {
  CreateHolidayRequestSchema,
  HolidayResponseSchema,
  HolidaysResponseSchema,
  UpdateHolidayRequestSchema,
} from '../../../schemas/core.schema';
import { openApiApp } from '../../../lib/openapi';
import {
  createHolidayHandler,
  getHolidaysHandler,
  updateHolidayHandler,
} from './handlers/holidays';

const holidaysApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const getHolidaysRoute = createRoute({
  method: 'get',
  path: '/holidays',
  tags: ['Core', 'Holidays'],
  summary: 'Get Holidays and Off Days',
  responses: { 200: { content: { 'application/json': { schema: HolidaysResponseSchema } }, description: 'Holiday/off-day list' } },
});

export const createHolidayRoute = createRoute({
  method: 'post',
  path: '/holidays',
  tags: ['Core', 'Holidays'],
  summary: 'Create Holiday or Off Day',
  request: { body: { content: { 'application/json': { schema: CreateHolidayRequestSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: HolidayResponseSchema } }, description: 'Created holiday/off day' },
    400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Invalid request' },
  },
});

export const updateHolidayRoute = createRoute({
  method: 'put',
  path: '/holidays/{id}',
  tags: ['Core', 'Holidays'],
  summary: 'Update Holiday or Off Day',
  request: { params: uuidParam, body: { content: { 'application/json': { schema: UpdateHolidayRequestSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: HolidayResponseSchema } }, description: 'Updated holiday/off day' },
    404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Holiday/off day not found' },
  },
});

holidaysApp.get('/holidays', getHolidaysHandler);
holidaysApp.post('/holidays', createHolidayHandler);
holidaysApp.put('/holidays/:id', updateHolidayHandler);

openApiApp
  .openapi(getHolidaysRoute, getHolidaysHandler as any)
  .openapi(createHolidayRoute, createHolidayHandler as any)
  .openapi(updateHolidayRoute, updateHolidayHandler as any);

export default holidaysApp;
