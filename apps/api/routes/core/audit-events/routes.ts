import { Hono } from 'hono';
import { auditActionLabel, listAuditEvents } from '../../../db/orm/core/manageAuditEvents';
import { userHasPermission } from '../../../db/orm/rbac/manageRbac';
import { summarizeChanges, type AuditChanges } from '../../../lib/audit';

const auditEventsApp = new Hono();

auditEventsApp.get('/audit-events', async (c) => {
  const user = c.user ?? c.get('user');
  if (!user?.id) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const roles = (user.role ?? []).map((role: string) => role.toLowerCase());
  const unrestricted = roles.some((role: string) => ['super_admin', 'superadmin', 'admin'].includes(role));
  if (!unrestricted && !(await userHasPermission(user.id, 'reports-audit:read'))) {
    return c.json({ success: false, error: 'Permission denied' }, 403);
  }

  const query = c.req.query();
  const events = await listAuditEvents({
    resourceType: query.resourceType || null,
    resourceId: query.resourceId || null,
    employeeId: query.employeeId || null,
    limit: query.limit ? Number(query.limit) : 100,
  });

  return c.json({
    success: true,
    auditEvents: events.map((event) => ({
      id: event.id,
      occurredAt: event.occurredAt,
      actorName: event.actorName,
      actorEmail: event.actorEmail,
      actorType: event.actorType,
      action: event.action,
      actionLabel: auditActionLabel(event.action),
      outcome: event.outcome,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      resourceLabel: event.resourceLabel,
      employeeName: event.employee
        ? [event.employee.firstNameEn, event.employee.lastNameEn].filter(Boolean).join(' ')
        : '',
      employeeCode: event.employee?.employeeCode ?? '',
      department: event.department?.nameEn ?? '',
      delegated: Boolean(event.supervisorDelegationId),
      changesSummary: summarizeChanges(event.changes as AuditChanges | null),
      changes: event.changes,
      metadata: event.metadata,
    })),
  });
});

export default auditEventsApp;
