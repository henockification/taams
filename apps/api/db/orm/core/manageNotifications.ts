import { and, desc, eq, gte, ilike, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import {
  employeeSupervisors,
  employees,
  notificationLogs,
  permissions,
  rolePermissions,
  roles,
  user,
  userRoles,
} from '../../schema';

export type NotificationLogStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
export type NotificationChannel = 'EMAIL' | 'SMS';

export type NotificationLogFilters = {
  channel?: NotificationChannel | string | null;
  status?: NotificationLogStatus | string | null;
  eventType?: string | null;
  recipient?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number | null;
};

export type NotificationRecipient = {
  userId: string | null;
  employeeId: string | null;
  name: string;
  email: string | null;
  phoneNumber: string | null;
};

export type CreateNotificationLogInput = {
  eventType: string;
  channel: NotificationChannel;
  status?: NotificationLogStatus;
  recipient: NotificationRecipient;
  destination: string | null;
  subject?: string | null;
  message: string;
  locale?: string;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  metadata?: Record<string, unknown> | null;
  errorMessage?: string | null;
};

export async function createNotificationLog(input: CreateNotificationLogInput) {
  const [log] = await db.insert(notificationLogs).values({
    eventType: input.eventType,
    channel: input.channel,
    status: input.status ?? 'PENDING',
    recipientUserId: input.recipient.userId,
    recipientEmployeeId: input.recipient.employeeId,
    recipientName: input.recipient.name,
    destination: input.destination,
    subject: input.subject ?? null,
    message: input.message,
    locale: input.locale ?? 'en',
    relatedEntityType: input.relatedEntityType ?? null,
    relatedEntityId: input.relatedEntityId ?? null,
    metadata: input.metadata ?? null,
    errorMessage: input.errorMessage ?? null,
    updatedAt: new Date(),
  }).returning();

  return log;
}

export async function markNotificationLogSent(
  id: string,
  providerResponse?: Record<string, unknown> | null,
  providerMessageId?: string | null,
) {
  const [log] = await db.update(notificationLogs).set({
    status: 'SENT',
    attempts: sql`${notificationLogs.attempts} + 1`,
    lastAttemptAt: new Date(),
    nextAttemptAt: null,
    providerResponse: providerResponse ?? null,
    providerMessageId: providerMessageId ?? null,
    errorMessage: null,
    sentAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(notificationLogs.id, id)).returning();

  return log;
}

export async function markNotificationLogFailed(id: string, errorMessage: string, providerResponse?: Record<string, unknown> | null) {
  const [log] = await db.update(notificationLogs).set({
    status: 'FAILED',
    attempts: sql`${notificationLogs.attempts} + 1`,
    lastAttemptAt: new Date(),
    nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000),
    providerResponse: providerResponse ?? null,
    errorMessage,
    updatedAt: new Date(),
  }).where(eq(notificationLogs.id, id)).returning();

  return log;
}

export async function markNotificationLogSkipped(id: string, errorMessage: string) {
  const [log] = await db.update(notificationLogs).set({
    status: 'SKIPPED',
    errorMessage,
    updatedAt: new Date(),
  }).where(eq(notificationLogs.id, id)).returning();

  return log;
}

export async function getNotificationLogs(filters: NotificationLogFilters = {}) {
  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  const where = and(
    isNotificationChannel(filters.channel) ? eq(notificationLogs.channel, filters.channel) : undefined,
    isNotificationLogStatus(filters.status) ? eq(notificationLogs.status, filters.status) : undefined,
    filters.eventType ? eq(notificationLogs.eventType, filters.eventType) : undefined,
    filters.dateFrom ? gte(notificationLogs.createdAt, new Date(filters.dateFrom)) : undefined,
    filters.dateTo ? lte(notificationLogs.createdAt, endOfDate(filters.dateTo)) : undefined,
    filters.recipient
      ? or(
          ilike(notificationLogs.recipientName, `%${filters.recipient}%`),
          ilike(notificationLogs.destination, `%${filters.recipient}%`),
        )
      : undefined,
  );

  return db.query.notificationLogs.findMany({
    where,
    orderBy: [desc(notificationLogs.createdAt)],
    limit,
    with: {
      recipientEmployee: {
        with: {
          department: true,
          position: true,
        },
      },
      recipientUser: true,
    },
  });
}

export async function getEmployeeNotificationRecipient(employeeId: string): Promise<NotificationRecipient | null> {
  const employee = await db.query.employees.findFirst({
    where: eq(employees.id, employeeId),
    with: {
      user: true,
    },
  });

  return employee ? mapEmployeeToRecipient(employee) : null;
}

export async function getSupervisorNotificationRecipients(employeeId: string): Promise<NotificationRecipient[]> {
  const assignments = await db.query.employeeSupervisors.findMany({
    where: and(
      eq(employeeSupervisors.employeeId, employeeId),
      eq(employeeSupervisors.isPrimary, true),
      or(
        sql`${employeeSupervisors.effectiveTo} IS NULL`,
        gte(employeeSupervisors.effectiveTo, currentDateString()),
      ),
    ),
    with: {
      supervisor: {
        with: {
          user: true,
        },
      },
    },
  });

  return uniqueRecipients(assignments.map((assignment) => mapEmployeeToRecipient(assignment.supervisor)).filter(Boolean));
}

export async function getHrNotificationRecipients(): Promise<NotificationRecipient[]> {
  const hrUsers = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
    })
    .from(user)
    .leftJoin(userRoles, eq(userRoles.userId, user.id))
    .leftJoin(roles, eq(roles.id, userRoles.roleId))
    .leftJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(or(
      sql`lower(${roles.name}) IN ('super_admin', 'superadmin', 'admin', 'executive', 'human_resource')`,
      eq(permissions.name, 'hr-attendance-approvals:approve'),
      sql`${permissions.name} LIKE 'hr-%'`,
    ));

  const employeesByUserId = await db.query.employees.findMany({
    where: sql`${employees.userId} IS NOT NULL`,
    with: {
      user: true,
    },
  });
  const employeeByUserId = new Map(employeesByUserId.map((employee) => [employee.userId, employee]));

  return uniqueRecipients(hrUsers.map((hrUser) => {
    const employee = employeeByUserId.get(hrUser.id);
    if (employee) return mapEmployeeToRecipient(employee);
    return {
      userId: hrUser.id,
      employeeId: null,
      name: hrUser.name,
      email: hrUser.email,
      phoneNumber: null,
    };
  }));
}

function mapEmployeeToRecipient(employee: any): NotificationRecipient {
  return {
    userId: employee.userId ?? employee.user?.id ?? null,
    employeeId: employee.id,
    name: [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' '),
    email: employee.email ?? employee.user?.email ?? null,
    phoneNumber: employee.phoneNumber ?? null,
  };
}

function uniqueRecipients(recipients: Array<NotificationRecipient | null | undefined>) {
  const recipientByKey = new Map<string, NotificationRecipient>();
  for (const recipient of recipients) {
    if (!recipient) continue;
    const key = recipient.userId ?? recipient.employeeId ?? `${recipient.email ?? ''}:${recipient.phoneNumber ?? ''}`;
    if (!recipientByKey.has(key)) recipientByKey.set(key, recipient);
  }
  return Array.from(recipientByKey.values());
}

function isNotificationChannel(value: unknown): value is NotificationChannel {
  return value === 'EMAIL' || value === 'SMS';
}

function isNotificationLogStatus(value: unknown): value is NotificationLogStatus {
  return value === 'PENDING' || value === 'SENT' || value === 'FAILED' || value === 'SKIPPED';
}

function currentDateString() {
  return new Date().toISOString().slice(0, 10);
}

function endOfDate(dateString: string) {
  const date = new Date(dateString);
  date.setHours(23, 59, 59, 999);
  return date;
}
