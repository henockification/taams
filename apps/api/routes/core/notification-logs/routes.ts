import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { NotificationLogsResponseSchema } from '../../../schemas/core.schema';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { openApiApp } from '../../../lib/openapi';
import { getNotificationLogsHandler } from './handlers/notificationLogs';

const notificationLogsApp = new Hono();

export const getNotificationLogsRoute = createRoute({
  method: 'get',
  path: '/notification-logs',
  tags: ['Core', 'Notifications'],
  summary: 'Get notification logs',
  request: {
    query: z.object({
      channel: z.enum(['EMAIL', 'SMS']).optional(),
      status: z.enum(['PENDING', 'SENT', 'FAILED', 'SKIPPED']).optional(),
      eventType: z.string().optional(),
      recipient: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: NotificationLogsResponseSchema } },
      description: 'Notification logs',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

notificationLogsApp.get('/notification-logs', getNotificationLogsHandler);

openApiApp.openapi(getNotificationLogsRoute, getNotificationLogsHandler as any);

export default notificationLogsApp;
