import { Hono } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { TimeOperationsSummaryResponseSchema } from '../../../schemas/core.schema';
import { openApiApp } from '../../../lib/openapi';
import { getTimeOperationsSummaryHandler } from './handlers/timeOperations';
import { requirePermission, requirePermissionOrDelegation } from '../../../middleware/rbac';

const timeOperationsApp = new Hono();

export const getTimeOperationsSummaryRoute = createRoute({
  method: 'get',
  path: '/time-operations/summary',
  tags: ['Core', 'Time Operations'],
  summary: 'Get Time Operations Summary',
  responses: {
    200: {
      content: { 'application/json': { schema: TimeOperationsSummaryResponseSchema } },
      description: 'Time operations workflow summary',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Failed to fetch time operations summary',
    },
  },
});

timeOperationsApp.get('/time-operations/summary', requirePermissionOrDelegation('attendance-approvals:approve', 'leave-request-approvals:approve', 'overtime-requests:approve', 'manual-punch-requests:approve', 'hr-attendance-approvals:approve'), getTimeOperationsSummaryHandler);

openApiApp.openapi(getTimeOperationsSummaryRoute, getTimeOperationsSummaryHandler as any);

export default timeOperationsApp;
