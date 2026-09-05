import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import {
  AttendanceApprovalBatchRequestSchema,
  AttendanceApprovalBatchResponseSchema,
  AttendanceDailyRecordResponseSchema,
  AttendanceDailyRecordsResponseSchema,
  GenerateAttendanceDailyRecordsResponseSchema,
  ReturnAttendanceDailyRecordRequestSchema,
  UpdateAttendanceDailyRecordPayrollRequestSchema,
} from '../../../schemas/core.schema';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { openApiApp } from '../../../lib/openapi';
import {
  generateAttendanceDailyRecordsHandler,
  getHrAttendanceDailyRecordsHandler,
  getSupervisorAttendanceDailyRecordsHandler,
  hrApproveAttendanceDailyRecordsHandler,
  hrApproveAttendanceDailyRecordHandler,
  returnAttendanceDailyRecordHandler,
  supervisorApproveAttendanceDailyRecordHandler,
  supervisorApproveAttendanceDailyRecordsHandler,
  updateSupervisorAttendanceDailyRecordPayrollHandler,
} from './handlers/attendanceApprovals';

const attendanceApprovalsApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

const ymdDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const dateRangeQuery = z.object({
  date: ymdDate.optional().openapi({ example: '2026-06-09' }),
  dateFrom: ymdDate.optional().openapi({ example: '2026-06-01' }),
  dateTo: ymdDate.optional().openapi({ example: '2026-06-30' }),
});

export const generateAttendanceDailyRecordsRoute = createRoute({
  method: 'post',
  path: '/attendance-approvals/generate',
  tags: ['Core', 'Attendance Approvals'],
  summary: 'Generate Attendance Daily Records',
  request: { query: dateRangeQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: GenerateAttendanceDailyRecordsResponseSchema } },
      description: 'Generated attendance daily records',
    },
  },
});

export const getSupervisorAttendanceDailyRecordsRoute = createRoute({
  method: 'get',
  path: '/attendance-approvals/supervisor',
  tags: ['Core', 'Attendance Approvals'],
  summary: 'Get Supervisor Attendance Approvals',
  request: { query: dateRangeQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: AttendanceDailyRecordsResponseSchema } },
      description: 'Supervisor attendance approvals',
    },
  },
});

export const getHrAttendanceDailyRecordsRoute = createRoute({
  method: 'get',
  path: '/attendance-approvals/hr',
  tags: ['Core', 'Attendance Approvals'],
  summary: 'Get HR Attendance Approvals',
  request: { query: dateRangeQuery },
  responses: {
    200: {
      content: { 'application/json': { schema: AttendanceDailyRecordsResponseSchema } },
      description: 'HR attendance approvals',
    },
  },
});

export const supervisorApproveAttendanceDailyRecordRoute = createRoute({
  method: 'post',
  path: '/attendance-approvals/{id}/supervisor-approve',
  tags: ['Core', 'Attendance Approvals'],
  summary: 'Supervisor Approve Attendance',
  request: { params: uuidParam },
  responses: {
    200: {
      content: { 'application/json': { schema: AttendanceDailyRecordResponseSchema } },
      description: 'Supervisor-approved attendance daily record',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Attendance daily record not found',
    },
  },
});

export const supervisorApproveAttendanceDailyRecordsRoute = createRoute({
  method: 'post',
  path: '/attendance-approvals/supervisor/batch',
  tags: ['Core', 'Attendance Approvals'],
  summary: 'Supervisor Approve Attendance Batch',
  request: { body: { content: { 'application/json': { schema: AttendanceApprovalBatchRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: AttendanceApprovalBatchResponseSchema } }, description: 'Supervisor-approved attendance batch' } },
});

export const updateSupervisorAttendanceDailyRecordPayrollRoute = createRoute({
  method: 'post',
  path: '/attendance-approvals/{id}/supervisor-edit',
  tags: ['Core', 'Attendance Approvals'],
  summary: 'Supervisor Edit Attendance Payroll Values',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateAttendanceDailyRecordPayrollRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AttendanceDailyRecordResponseSchema } },
      description: 'Updated attendance daily record',
    },
  },
});

export const hrApproveAttendanceDailyRecordRoute = createRoute({
  method: 'post',
  path: '/attendance-approvals/{id}/hr-approve',
  tags: ['Core', 'Attendance Approvals'],
  summary: 'HR Approve Attendance',
  request: { params: uuidParam },
  responses: {
    200: {
      content: { 'application/json': { schema: AttendanceDailyRecordResponseSchema } },
      description: 'HR-approved attendance daily record',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Attendance daily record not found',
    },
  },
});

export const hrApproveAttendanceDailyRecordsRoute = createRoute({
  method: 'post',
  path: '/attendance-approvals/hr/batch',
  tags: ['Core', 'Attendance Approvals'],
  summary: 'HR Approve Attendance Batch',
  request: { body: { content: { 'application/json': { schema: AttendanceApprovalBatchRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: AttendanceApprovalBatchResponseSchema } }, description: 'HR-approved attendance batch' } },
});

export const returnAttendanceDailyRecordRoute = createRoute({
  method: 'post',
  path: '/attendance-approvals/{id}/return',
  tags: ['Core', 'Attendance Approvals'],
  summary: 'Return Attendance',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: ReturnAttendanceDailyRecordRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: AttendanceDailyRecordResponseSchema } },
      description: 'Returned attendance daily record',
    },
  },
});

attendanceApprovalsApp.post('/attendance-approvals/generate', generateAttendanceDailyRecordsHandler);
attendanceApprovalsApp.get('/attendance-approvals/supervisor', getSupervisorAttendanceDailyRecordsHandler);
attendanceApprovalsApp.get('/attendance-approvals/hr', getHrAttendanceDailyRecordsHandler);
attendanceApprovalsApp.post('/attendance-approvals/supervisor/batch', supervisorApproveAttendanceDailyRecordsHandler);
attendanceApprovalsApp.post('/attendance-approvals/hr/batch', hrApproveAttendanceDailyRecordsHandler);
attendanceApprovalsApp.post('/attendance-approvals/:id/supervisor-approve', supervisorApproveAttendanceDailyRecordHandler);
attendanceApprovalsApp.post('/attendance-approvals/:id/supervisor-edit', updateSupervisorAttendanceDailyRecordPayrollHandler);
attendanceApprovalsApp.post('/attendance-approvals/:id/hr-approve', hrApproveAttendanceDailyRecordHandler);
attendanceApprovalsApp.post('/attendance-approvals/:id/return', returnAttendanceDailyRecordHandler);

openApiApp
  .openapi(generateAttendanceDailyRecordsRoute, generateAttendanceDailyRecordsHandler as any)
  .openapi(getSupervisorAttendanceDailyRecordsRoute, getSupervisorAttendanceDailyRecordsHandler as any)
  .openapi(getHrAttendanceDailyRecordsRoute, getHrAttendanceDailyRecordsHandler as any)
  .openapi(supervisorApproveAttendanceDailyRecordsRoute, supervisorApproveAttendanceDailyRecordsHandler as any)
  .openapi(hrApproveAttendanceDailyRecordsRoute, hrApproveAttendanceDailyRecordsHandler as any)
  .openapi(supervisorApproveAttendanceDailyRecordRoute, supervisorApproveAttendanceDailyRecordHandler as any)
  .openapi(updateSupervisorAttendanceDailyRecordPayrollRoute, updateSupervisorAttendanceDailyRecordPayrollHandler as any)
  .openapi(hrApproveAttendanceDailyRecordRoute, hrApproveAttendanceDailyRecordHandler as any)
  .openapi(returnAttendanceDailyRecordRoute, returnAttendanceDailyRecordHandler as any);

export default attendanceApprovalsApp;
