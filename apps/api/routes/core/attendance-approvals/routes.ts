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
  AttendanceOvertimeExceptionsResponseSchema,
  ReviewAttendanceOvertimeExceptionRequestSchema,
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
  getAttendanceOvertimeExceptionsHandler,
  dismissAttendanceOvertimeExceptionHandler,
  convertAttendanceOvertimeExceptionHandler,
} from './handlers/attendanceApprovals';
import { requirePermission, requirePermissionOrDelegation } from '../../../middleware/rbac';
import { completeIsmisLeaveVerification, getLatestIsmisLeaveImport, importIsmisLeaveWorkbook } from '../../../db/orm/core/manageIsmisLeave';

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

export const getAttendanceOvertimeExceptionsRoute = createRoute({
  method: 'get', path: '/attendance-approvals/overtime-exceptions', tags: ['Core', 'Attendance Approvals'],
  summary: 'Get detected unapproved overtime exceptions', request: { query: dateRangeQuery },
  responses: { 200: { content: { 'application/json': { schema: AttendanceOvertimeExceptionsResponseSchema } }, description: 'Overtime exceptions' } },
});

export const dismissAttendanceOvertimeExceptionRoute = createRoute({
  method: 'post', path: '/attendance-approvals/overtime-exceptions/{id}/dismiss', tags: ['Core', 'Attendance Approvals'],
  summary: 'Dismiss an overtime exception', request: { params: uuidParam, body: { content: { 'application/json': { schema: ReviewAttendanceOvertimeExceptionRequestSchema } } } },
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Dismissed overtime exception' } },
});

export const convertAttendanceOvertimeExceptionRoute = createRoute({
  method: 'post', path: '/attendance-approvals/overtime-exceptions/{id}/convert', tags: ['Core', 'Attendance Approvals'],
  summary: 'Convert an overtime exception to an assignment', request: { params: uuidParam },
  responses: { 200: { content: { 'application/json': { schema: z.any() } }, description: 'Created overtime assignment' } },
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

attendanceApprovalsApp.post('/attendance-approvals/generate', requirePermissionOrDelegation('attendance-approvals:approve', 'hr-attendance-approvals:approve'), generateAttendanceDailyRecordsHandler);
attendanceApprovalsApp.get('/attendance-approvals/ismis-leave', requirePermission('hr-attendance-approvals:approve'), async (c) => c.json({ success: true, batch: await getLatestIsmisLeaveImport() }));
attendanceApprovalsApp.post('/attendance-approvals/ismis-leave/import', requirePermission('hr-attendance-approvals:approve'), async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file');
    if (!file || typeof file === 'string' || typeof (file as any).arrayBuffer !== 'function') return c.json({ success: false, error: 'An ISMIS .xlsx file is required' }, 400);
    const user = c.get('user');
    const result = await importIsmisLeaveWorkbook(Buffer.from(await (file as File).arrayBuffer()), (file as File).name, user.id);
    return c.json({ success: true, ...result });
  } catch (error) { return c.json({ success: false, error: error instanceof Error ? error.message : 'ISMIS leave import failed' }, 400); }
});
attendanceApprovalsApp.post('/attendance-approvals/ismis-leave/complete', requirePermission('hr-attendance-approvals:approve'), async (c) => {
  try {
    const body = await c.req.json();
    const user = c.get('user');
    const result = await completeIsmisLeaveVerification(String(body.batchId), String(body.dateFrom), String(body.dateTo), user.id);
    return c.json({ success: true, verification: result });
  } catch (error) { return c.json({ success: false, error: error instanceof Error ? error.message : 'ISMIS leave verification failed' }, 400); }
});
attendanceApprovalsApp.get('/attendance-approvals/supervisor', requirePermissionOrDelegation('attendance-approvals:approve'), getSupervisorAttendanceDailyRecordsHandler);
attendanceApprovalsApp.get('/attendance-approvals/hr', requirePermission('hr-attendance-approvals:approve'), getHrAttendanceDailyRecordsHandler);
attendanceApprovalsApp.get('/attendance-approvals/overtime-exceptions', requirePermissionOrDelegation('attendance-approvals:approve', 'hr-attendance-approvals:approve'), getAttendanceOvertimeExceptionsHandler);
attendanceApprovalsApp.post('/attendance-approvals/overtime-exceptions/:id/dismiss', requirePermissionOrDelegation('attendance-approvals:approve', 'hr-attendance-approvals:approve'), dismissAttendanceOvertimeExceptionHandler);
attendanceApprovalsApp.post('/attendance-approvals/overtime-exceptions/:id/convert', requirePermissionOrDelegation('attendance-approvals:approve', 'hr-attendance-approvals:approve'), convertAttendanceOvertimeExceptionHandler);
attendanceApprovalsApp.post('/attendance-approvals/supervisor/batch', requirePermissionOrDelegation('attendance-approvals:approve'), supervisorApproveAttendanceDailyRecordsHandler);
attendanceApprovalsApp.post('/attendance-approvals/hr/batch', requirePermission('hr-attendance-approvals:approve'), hrApproveAttendanceDailyRecordsHandler);
attendanceApprovalsApp.post('/attendance-approvals/:id/supervisor-approve', requirePermissionOrDelegation('attendance-approvals:approve'), supervisorApproveAttendanceDailyRecordHandler);
attendanceApprovalsApp.post('/attendance-approvals/:id/supervisor-edit', requirePermissionOrDelegation('attendance-approvals:approve'), updateSupervisorAttendanceDailyRecordPayrollHandler);
attendanceApprovalsApp.post('/attendance-approvals/:id/hr-approve', requirePermission('hr-attendance-approvals:approve'), hrApproveAttendanceDailyRecordHandler);
attendanceApprovalsApp.post('/attendance-approvals/:id/return', requirePermissionOrDelegation('attendance-approvals:approve', 'hr-attendance-approvals:approve'), returnAttendanceDailyRecordHandler);

openApiApp
  .openapi(generateAttendanceDailyRecordsRoute, generateAttendanceDailyRecordsHandler as any)
  .openapi(getSupervisorAttendanceDailyRecordsRoute, getSupervisorAttendanceDailyRecordsHandler as any)
  .openapi(getHrAttendanceDailyRecordsRoute, getHrAttendanceDailyRecordsHandler as any)
  .openapi(getAttendanceOvertimeExceptionsRoute, getAttendanceOvertimeExceptionsHandler as any)
  .openapi(dismissAttendanceOvertimeExceptionRoute, dismissAttendanceOvertimeExceptionHandler as any)
  .openapi(convertAttendanceOvertimeExceptionRoute, convertAttendanceOvertimeExceptionHandler as any)
  .openapi(supervisorApproveAttendanceDailyRecordsRoute, supervisorApproveAttendanceDailyRecordsHandler as any)
  .openapi(hrApproveAttendanceDailyRecordsRoute, hrApproveAttendanceDailyRecordsHandler as any)
  .openapi(supervisorApproveAttendanceDailyRecordRoute, supervisorApproveAttendanceDailyRecordHandler as any)
  .openapi(updateSupervisorAttendanceDailyRecordPayrollRoute, updateSupervisorAttendanceDailyRecordPayrollHandler as any)
  .openapi(hrApproveAttendanceDailyRecordRoute, hrApproveAttendanceDailyRecordHandler as any)
  .openapi(returnAttendanceDailyRecordRoute, returnAttendanceDailyRecordHandler as any);

export default attendanceApprovalsApp;
