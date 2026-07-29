import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../../schemas/shared';
import {
  BulkUpsertLeaveBalancesRequestSchema,
  ChangeLeaveRequestStatusRequestSchema,
  CreateLeaveFiscalYearRequestSchema,
  CreateLeaveRequestRequestSchema,
  CreateLeaveTypeRequestSchema,
  LeaveBalanceResponseSchema,
  LeaveBalancesResponseSchema,
  LeaveBalanceTransferResponseSchema,
  LeaveFiscalYearResponseSchema,
  LeaveFiscalYearsResponseSchema,
  LeaveRequestResponseSchema,
  LeaveRequestsResponseSchema,
  LeaveTypeResponseSchema,
  LeaveTypesResponseSchema,
  TransferLeaveBalanceRequestSchema,
  UpdateLeaveFiscalYearRequestSchema,
  UpdateLeaveTypeRequestSchema,
  UpsertLeaveBalanceRequestSchema,
} from '../../../schemas/core.schema';
import { openApiApp } from '../../../lib/openapi';
import {
  bulkUpsertLeaveBalancesHandler,
  changeLeaveRequestStatusHandler,
  createLeaveFiscalYearHandler,
  createLeaveRequestHandler,
  createLeaveTypeHandler,
  getLeaveBalancesHandler,
  getLeaveFiscalYearsHandler,
  getLeaveRequestsHandler,
  getLeaveTypesHandler,
  setActiveLeaveFiscalYearHandler,
  transferLeaveBalanceHandler,
  updateLeaveFiscalYearHandler,
  updateLeaveTypeHandler,
  upsertLeaveBalanceHandler,
} from './handlers/leaveManagement';

const leaveManagementApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const getLeaveFiscalYearsRoute = createRoute({
  method: 'get',
  path: '/leave/fiscal-years',
  tags: ['Core', 'Leave Management'],
  summary: 'Get Leave Fiscal Years',
  responses: { 200: { content: { 'application/json': { schema: LeaveFiscalYearsResponseSchema } }, description: 'Leave fiscal years' } },
});

export const createLeaveFiscalYearRoute = createRoute({
  method: 'post',
  path: '/leave/fiscal-years',
  tags: ['Core', 'Leave Management'],
  summary: 'Create Leave Fiscal Year',
  request: { body: { content: { 'application/json': { schema: CreateLeaveFiscalYearRequestSchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: LeaveFiscalYearResponseSchema } }, description: 'Created leave fiscal year' },
    400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Invalid request' },
  },
});

export const updateLeaveFiscalYearRoute = createRoute({
  method: 'put',
  path: '/leave/fiscal-years/{id}',
  tags: ['Core', 'Leave Management'],
  summary: 'Update Leave Fiscal Year',
  request: { params: uuidParam, body: { content: { 'application/json': { schema: UpdateLeaveFiscalYearRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: LeaveFiscalYearResponseSchema } }, description: 'Updated leave fiscal year' } },
});

export const setActiveLeaveFiscalYearRoute = createRoute({
  method: 'post',
  path: '/leave/fiscal-years/{id}/active',
  tags: ['Core', 'Leave Management'],
  summary: 'Set Active Leave Fiscal Year',
  request: { params: uuidParam },
  responses: { 200: { content: { 'application/json': { schema: LeaveFiscalYearResponseSchema } }, description: 'Active leave fiscal year' } },
});

export const getLeaveTypesRoute = createRoute({
  method: 'get',
  path: '/leave/types',
  tags: ['Core', 'Leave Management'],
  summary: 'Get Leave Types',
  responses: { 200: { content: { 'application/json': { schema: LeaveTypesResponseSchema } }, description: 'Leave types' } },
});

export const createLeaveTypeRoute = createRoute({
  method: 'post',
  path: '/leave/types',
  tags: ['Core', 'Leave Management'],
  summary: 'Create Leave Type',
  request: { body: { content: { 'application/json': { schema: CreateLeaveTypeRequestSchema } } } },
  responses: { 201: { content: { 'application/json': { schema: LeaveTypeResponseSchema } }, description: 'Created leave type' } },
});

export const updateLeaveTypeRoute = createRoute({
  method: 'put',
  path: '/leave/types/{id}',
  tags: ['Core', 'Leave Management'],
  summary: 'Update Leave Type',
  request: { params: uuidParam, body: { content: { 'application/json': { schema: UpdateLeaveTypeRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: LeaveTypeResponseSchema } }, description: 'Updated leave type' } },
});

export const getLeaveBalancesRoute = createRoute({
  method: 'get',
  path: '/leave/balances',
  tags: ['Core', 'Leave Management'],
  summary: 'Get Leave Balances',
  responses: { 200: { content: { 'application/json': { schema: LeaveBalancesResponseSchema } }, description: 'Leave balances' } },
});

export const upsertLeaveBalanceRoute = createRoute({
  method: 'post',
  path: '/leave/balances',
  tags: ['Core', 'Leave Management'],
  summary: 'Create or Update Initial Leave Balance',
  request: { body: { content: { 'application/json': { schema: UpsertLeaveBalanceRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: LeaveBalanceResponseSchema } }, description: 'Saved leave balance' } },
});

export const bulkUpsertLeaveBalancesRoute = createRoute({
  method: 'post',
  path: '/leave/balances/bulk',
  tags: ['Core', 'Leave Management'],
  summary: 'Bulk Create or Update Initial Leave Balances',
  request: { body: { content: { 'application/json': { schema: BulkUpsertLeaveBalancesRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: LeaveBalancesResponseSchema } }, description: 'Saved leave balances' } },
});

export const transferLeaveBalanceRoute = createRoute({
  method: 'post',
  path: '/leave/balances/transfer',
  tags: ['Core', 'Leave Management'],
  summary: 'Transfer Annual Leave Balance',
  request: { body: { content: { 'application/json': { schema: TransferLeaveBalanceRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: LeaveBalanceTransferResponseSchema } }, description: 'Transferred leave balance' } },
});

export const getLeaveRequestsRoute = createRoute({
  method: 'get',
  path: '/leave/requests',
  tags: ['Core', 'Leave Management'],
  summary: 'Get Leave Requests',
  responses: { 200: { content: { 'application/json': { schema: LeaveRequestsResponseSchema } }, description: 'Leave requests' } },
});

export const createLeaveRequestRoute = createRoute({
  method: 'post',
  path: '/leave/requests',
  tags: ['Core', 'Leave Management'],
  summary: 'Create Leave Request',
  request: { body: { content: { 'application/json': { schema: CreateLeaveRequestRequestSchema } } } },
  responses: { 201: { content: { 'application/json': { schema: LeaveRequestResponseSchema } }, description: 'Created leave request' } },
});

export const changeLeaveRequestStatusRoute = createRoute({
  method: 'post',
  path: '/leave/requests/{id}/status',
  tags: ['Core', 'Leave Management'],
  summary: 'Approve or Reject Leave Request',
  request: { params: uuidParam, body: { content: { 'application/json': { schema: ChangeLeaveRequestStatusRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: LeaveRequestResponseSchema } }, description: 'Updated leave request' } },
});

leaveManagementApp.get('/leave/fiscal-years', getLeaveFiscalYearsHandler);
leaveManagementApp.post('/leave/fiscal-years', createLeaveFiscalYearHandler);
leaveManagementApp.put('/leave/fiscal-years/:id', updateLeaveFiscalYearHandler);
leaveManagementApp.post('/leave/fiscal-years/:id/active', setActiveLeaveFiscalYearHandler);
leaveManagementApp.get('/leave/types', getLeaveTypesHandler);
leaveManagementApp.post('/leave/types', createLeaveTypeHandler);
leaveManagementApp.put('/leave/types/:id', updateLeaveTypeHandler);
leaveManagementApp.get('/leave/balances', getLeaveBalancesHandler);
leaveManagementApp.post('/leave/balances', upsertLeaveBalanceHandler);
leaveManagementApp.post('/leave/balances/bulk', bulkUpsertLeaveBalancesHandler);
leaveManagementApp.post('/leave/balances/transfer', transferLeaveBalanceHandler);
leaveManagementApp.get('/leave/requests', getLeaveRequestsHandler);
leaveManagementApp.post('/leave/requests', createLeaveRequestHandler);
leaveManagementApp.post('/leave/requests/:id/status', changeLeaveRequestStatusHandler);

openApiApp
  .openapi(getLeaveFiscalYearsRoute, getLeaveFiscalYearsHandler as any)
  .openapi(createLeaveFiscalYearRoute, createLeaveFiscalYearHandler as any)
  .openapi(updateLeaveFiscalYearRoute, updateLeaveFiscalYearHandler as any)
  .openapi(setActiveLeaveFiscalYearRoute, setActiveLeaveFiscalYearHandler as any)
  .openapi(getLeaveTypesRoute, getLeaveTypesHandler as any)
  .openapi(createLeaveTypeRoute, createLeaveTypeHandler as any)
  .openapi(updateLeaveTypeRoute, updateLeaveTypeHandler as any)
  .openapi(getLeaveBalancesRoute, getLeaveBalancesHandler as any)
  .openapi(upsertLeaveBalanceRoute, upsertLeaveBalanceHandler as any)
  .openapi(bulkUpsertLeaveBalancesRoute, bulkUpsertLeaveBalancesHandler as any)
  .openapi(transferLeaveBalanceRoute, transferLeaveBalanceHandler as any)
  .openapi(getLeaveRequestsRoute, getLeaveRequestsHandler as any)
  .openapi(createLeaveRequestRoute, createLeaveRequestHandler as any)
  .openapi(changeLeaveRequestStatusRoute, changeLeaveRequestStatusHandler as any);

export default leaveManagementApp;
