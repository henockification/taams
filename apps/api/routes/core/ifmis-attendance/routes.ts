import { Hono } from 'hono';
import { createRoute } from '@hono/zod-openapi';
import {
  IfmisAttendancePeriodSchema,
  IfmisAttendancePreviewResponseSchema,
  IfmisAttendancePushResponseSchema,
} from '../../../schemas/core.schema';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { openApiApp } from '../../../lib/openapi';
import { requirePermission } from '../../../middleware/rbac';
import { getIfmisAttendancePreview, IfmisExportError, pushIfmisAttendance } from '../../../db/orm/core/manageIfmisAttendance';

const ifmisAttendanceApp = new Hono();

const previewRoute = createRoute({
  method: 'get',
  path: '/ifmis/attendance',
  tags: ['Core', 'IFMIS'],
  summary: 'Preview monthly HR-approved attendance for IFMIS',
  request: { query: IfmisAttendancePeriodSchema },
  responses: {
    200: { content: { 'application/json': { schema: IfmisAttendancePreviewResponseSchema } }, description: 'IFMIS attendance preview' },
    400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Invalid payroll period' },
  },
});

const pushRoute = createRoute({
  method: 'post',
  path: '/ifmis/attendance/push',
  tags: ['Core', 'IFMIS'],
  summary: 'Push a complete monthly attendance batch to IFMIS',
  request: { body: { content: { 'application/json': { schema: IfmisAttendancePeriodSchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: IfmisAttendancePushResponseSchema } }, description: 'Committed IFMIS attendance batch' },
    400: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Invalid or incomplete payroll period' },
    409: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Payroll period already exported' },
  },
});

export async function previewIfmisAttendanceHandler(c: any) {
  const parsed = IfmisAttendancePeriodSchema.safeParse(c.req.query());
  if (!parsed.success) return c.json({ success: false, error: 'Invalid payroll period' }, 400);
  try {
    const preview = await getIfmisAttendancePreview(parsed.data.payMonth, parsed.data.payYear);
    return c.json({ success: true, ...preview });
  } catch {
    return c.json({ success: false, error: 'Failed to prepare IFMIS attendance preview' }, 500);
  }
}

export async function pushIfmisAttendanceHandler(c: any) {
  const parsed = IfmisAttendancePeriodSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ success: false, error: 'Invalid payroll period' }, 400);
  try {
    const user = c.get('user');
    const batch = await pushIfmisAttendance(parsed.data.payMonth, parsed.data.payYear, user.id);
    return c.json({ success: true, batch });
  } catch (error) {
    if (error instanceof IfmisExportError) {
      const status = error.code === 'ALREADY_EXPORTED' ? 409 : error.code === 'NOT_READY' ? 400 : 502;
      return c.json({ success: false, error: error.message, issues: error.issues }, status);
    }
    return c.json({ success: false, error: 'IFMIS attendance export failed' }, 500);
  }
}

ifmisAttendanceApp.get('/ifmis/attendance', requirePermission('ifmis-attendance:read'), previewIfmisAttendanceHandler);
ifmisAttendanceApp.post('/ifmis/attendance/push', requirePermission('ifmis-attendance:push'), pushIfmisAttendanceHandler);

openApiApp
  .openapi(previewRoute, previewIfmisAttendanceHandler as any)
  .openapi(pushRoute, pushIfmisAttendanceHandler as any);

export default ifmisAttendanceApp;
