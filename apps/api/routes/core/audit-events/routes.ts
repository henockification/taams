import { Hono } from 'hono';
import { auditActionLabel, listAuditEvents } from '../../../db/orm/core/manageAuditEvents';
import { summarizeChanges, type AuditChanges } from '../../../lib/audit';
import { requirePermission } from '../../../middleware/rbac';

const auditEventsApp = new Hono();

auditEventsApp.get('/audit-events', requirePermission('reports-audit:read'), async (c) => {
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
