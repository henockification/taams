import { and, desc, eq, gte, ilike, isNotNull, lte, or } from 'drizzle-orm';
import { db } from '../../db';
import { auditEvents } from '../../schema';
import { AUDIT_ACTION_LABELS, type AuditAction } from '../../../lib/audit';

export type ListAuditEventsInput = {
  dateFrom?: string | null;
  dateTo?: string | null;
  actorUserId?: string | null;
  actorSearch?: string | null;
  action?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  employeeId?: string | null;
  departmentId?: string | null;
  outcome?: string | null;
  delegatedOnly?: boolean;
  limit?: number;
};

export async function listAuditEvents(input: ListAuditEventsInput = {}) {
  const limit = Math.min(Math.max(input.limit ?? 2000, 1), 5000);
  const occurredFrom = input.dateFrom ? new Date(`${input.dateFrom}T00:00:00.000Z`) : null;
  const occurredTo = input.dateTo ? new Date(`${input.dateTo}T23:59:59.999Z`) : null;

  const rows = await db.query.auditEvents.findMany({
    where: and(
      occurredFrom ? gte(auditEvents.occurredAt, occurredFrom) : undefined,
      occurredTo ? lte(auditEvents.occurredAt, occurredTo) : undefined,
      input.actorUserId ? eq(auditEvents.actorUserId, input.actorUserId) : undefined,
      input.actorSearch
        ? or(
          ilike(auditEvents.actorName, `%${input.actorSearch.trim()}%`),
          ilike(auditEvents.actorEmail, `%${input.actorSearch.trim()}%`),
        )
        : undefined,
      input.action ? eq(auditEvents.action, input.action) : undefined,
      input.resourceType ? eq(auditEvents.resourceType, input.resourceType) : undefined,
      input.resourceId ? eq(auditEvents.resourceId, input.resourceId) : undefined,
      input.employeeId ? eq(auditEvents.employeeId, input.employeeId) : undefined,
      input.departmentId ? eq(auditEvents.departmentId, input.departmentId) : undefined,
      input.outcome ? eq(auditEvents.outcome, input.outcome) : undefined,
      input.delegatedOnly ? isNotNull(auditEvents.supervisorDelegationId) : undefined,
    ),
    with: {
      employee: {
        columns: {
          id: true,
          employeeCode: true,
          firstNameEn: true,
          lastNameEn: true,
        },
      },
      department: {
        columns: {
          id: true,
          nameEn: true,
        },
      },
    },
    orderBy: [desc(auditEvents.occurredAt)],
    limit,
  });

  return rows;
}

export function auditActionLabel(action: string) {
  return AUDIT_ACTION_LABELS[action as AuditAction] ?? action;
}
