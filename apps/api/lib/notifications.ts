import {
  createNotificationLog,
  getEmployeeNotificationRecipient,
  getHrNotificationRecipients,
  getNotificationRecipientByEmail,
  getNotificationRecipientsByRole,
  getSupervisorNotificationRecipients,
  markNotificationLogFailed,
  markNotificationLogSent,
  markNotificationLogSkipped,
  type NotificationChannel,
  type NotificationRecipient,
} from '../db/orm/core/manageNotifications';

export type WorkflowNotificationEvent =
  | 'LEAVE_REQUEST_SUBMITTED'
  | 'LEAVE_REQUEST_APPROVED'
  | 'LEAVE_REQUEST_SUPERVISOR_DECISION'
  | 'LEAVE_REQUEST_SUPERVISOR_APPROVED'
  | 'LEAVE_REQUEST_AUTHORIZED'
  | 'LEAVE_REQUEST_AUTHORIZATION_REJECTED'
  | 'LEAVE_INTERRUPTION_SUPERVISOR_APPROVED'
  | 'LEAVE_INTERRUPTION_AUTHORIZED'
  | 'LEAVE_INTERRUPTION_AUTHORIZATION_REJECTED'
  | 'LEAVE_REQUEST_REJECTED'
  | 'OVERTIME_REQUEST_SUBMITTED'
  | 'OVERTIME_ASSIGNED'
  | 'OVERTIME_REQUEST_APPROVED'
  | 'OVERTIME_REQUEST_REJECTED'
  | 'ATTENDANCE_CORRECTION_SUBMITTED'
  | 'ATTENDANCE_CORRECTION_HR_REVIEWED'
  | 'ATTENDANCE_CORRECTION_HR_REJECTED'
  | 'ATTENDANCE_CORRECTION_SUPERVISOR_APPROVED'
  | 'ATTENDANCE_CORRECTION_SUPERVISOR_REJECTED'
  | 'BIOMETRIC_EXEMPTION_SUBMITTED'
  | 'BIOMETRIC_EXEMPTION_APPROVED'
  | 'BIOMETRIC_EXEMPTION_REJECTED'
  | 'SUPERVISOR_DELEGATION_ASSIGNED'
  | 'SUPERVISOR_DELEGATION_REVOKED'
  | 'ATTENDANCE_SUPERVISOR_APPROVED'
  | 'ATTENDANCE_HR_APPROVED'
  | 'ATTENDANCE_RETURNED';

export type WorkflowNotificationPayload = {
  entityId: string;
  entityType?: string;
  employeeId?: string | null;
  date?: string | null;
  status?: string | null;
  reason?: string | null;
  title?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  employeeCount?: number | null;
  recordCount?: number | null;
  leaveType?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  durationMinutes?: number | null;
  delegatingSupervisorName?: string | null;
  metadata?: Record<string, unknown>;
};

export type WorkflowNotificationOptions = {
  channels?: NotificationChannel[];
};

type RenderedNotification = {
  subject: string;
  message: string;
};

type SendResult = {
  providerMessageId?: string | null;
  providerResponse?: Record<string, unknown> | null;
};

interface NotificationProvider {
  isEnabled(): boolean;
  send(input: { destination: string; subject?: string | null; message: string }): Promise<SendResult>;
}

class GraphEmailProvider implements NotificationProvider {
  private token: { accessToken: string; expiresAt: number } | null = null;

  isEnabled() {
    return workflowNotificationsAreEnabled() && isTruthy(process.env.NOTIFICATIONS_EMAIL_ENABLED);
  }

  async send(input: { destination: string; subject?: string | null; message: string }): Promise<SendResult> {
    const senderMailbox = process.env.MS_GRAPH_SENDER_MAILBOX;
    if (!senderMailbox) throw new Error('MS_GRAPH_SENDER_MAILBOX is not configured');

    const accessToken = await this.getAccessToken();
    const saveToSentItems = process.env.MS_GRAPH_SAVE_TO_SENT_ITEMS === 'true';
    const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderMailbox)}/sendMail`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: input.subject ?? 'TAMS notification',
          body: {
            contentType: 'Text',
            content: input.message,
          },
          toRecipients: [
            {
              emailAddress: {
                address: input.destination,
              },
            },
          ],
        },
        saveToSentItems,
      }),
    });

    if (!response.ok && response.status !== 202) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(`Microsoft Graph sendMail failed (${response.status}): ${errorBody || response.statusText}`);
    }

    return {
      providerResponse: {
        status: response.status,
        statusText: response.statusText,
      },
    };
  }

  private async getAccessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) {
      return this.token.accessToken;
    }

    const tenantId = process.env.MS_GRAPH_TENANT_ID;
    const clientId = process.env.MS_GRAPH_CLIENT_ID;
    const clientSecret = process.env.MS_GRAPH_CLIENT_SECRET;
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('Microsoft Graph tenant/client credentials are not configured');
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    });

    const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = await response.json().catch(() => null) as { access_token?: string; expires_in?: number; error_description?: string } | null;
    if (!response.ok || !data?.access_token) {
      throw new Error(`Microsoft Graph token request failed: ${data?.error_description ?? response.statusText}`);
    }

    this.token = {
      accessToken: data.access_token,
      expiresAt: Date.now() + ((data.expires_in ?? 3600) * 1000),
    };
    return data.access_token;
  }
}

class EthioTelecomSmsProvider implements NotificationProvider {
  isEnabled() {
    return workflowNotificationsAreEnabled() && isTruthy(process.env.NOTIFICATIONS_SMS_ENABLED);
  }

  async send(input: { destination: string; message: string }): Promise<SendResult> {
    const baseUrl = process.env.ETHIOTELECOM_SMS_BASE_URL;
    const path = process.env.ETHIOTELECOM_SMS_PATH ?? '/sms/send';
    if (!baseUrl) throw new Error('ETHIOTELECOM_SMS_BASE_URL is not configured');

    const url = new URL(path, baseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const apiKey = process.env.ETHIOTELECOM_SMS_API_KEY;
    if (apiKey) {
      const authHeader = process.env.ETHIOTELECOM_SMS_AUTH_HEADER ?? 'Authorization';
      const authPrefix = process.env.ETHIOTELECOM_SMS_AUTH_PREFIX ?? 'Bearer';
      headers[authHeader] = authPrefix ? `${authPrefix} ${apiKey}` : apiKey;
    }

    const response = await fetch(url, {
      method: process.env.ETHIOTELECOM_SMS_METHOD ?? 'POST',
      headers,
      body: JSON.stringify({
        to: input.destination,
        msisdn: input.destination.replace(/^\+/, ''),
        message: input.message,
        text: input.message,
        sender: process.env.ETHIOTELECOM_SMS_SENDER_ID,
        senderId: process.env.ETHIOTELECOM_SMS_SENDER_ID,
      }),
    });

    const providerResponse = await response.json().catch(async () => ({ raw: await response.text().catch(() => '') }));
    if (!response.ok) {
      throw new Error(`Ethio telecom SMS request failed (${response.status}): ${JSON.stringify(providerResponse)}`);
    }

    return {
      providerMessageId: extractProviderMessageId(providerResponse),
      providerResponse: providerResponse && typeof providerResponse === 'object'
        ? providerResponse as Record<string, unknown>
        : { value: providerResponse },
    };
  }
}

class NotificationService {
  private emailProvider = new GraphEmailProvider();
  private smsProvider = new EthioTelecomSmsProvider();

  async enqueueWorkflowNotification(
    eventType: WorkflowNotificationEvent,
    payload: WorkflowNotificationPayload,
    options: WorkflowNotificationOptions = {},
  ) {
    if (!workflowNotificationsAreEnabled()) return;

    const recipients = await this.resolveRecipients(eventType, payload);
    const rendered = renderWorkflowNotification(eventType, payload);
    const relatedEntityType = payload.entityType ?? inferEntityType(eventType);

    await Promise.all(recipients.map((recipient) => this.enqueueForRecipient({
      eventType,
      recipient,
      rendered,
      relatedEntityType,
      relatedEntityId: payload.entityId,
      metadata: buildNotificationMetadata(payload),
      channels: options.channels ?? ['EMAIL', 'SMS'],
    })));
  }

  async enqueueDirectNotification(input: {
    eventType: string;
    recipientEmail: string;
    subject: string;
    message: string;
    channels?: NotificationChannel[];
    metadata?: Record<string, unknown> | null;
  }) {
    if (!workflowNotificationsAreEnabled()) return;
    const recipient = await getNotificationRecipientByEmail(input.recipientEmail);
    if (!recipient) return;
    await this.enqueueForRecipient({
      eventType: input.eventType,
      recipient,
      rendered: { subject: input.subject, message: input.message },
      relatedEntityType: 'auth_otp',
      relatedEntityId: recipient.employeeId,
      metadata: input.metadata ?? null,
      channels: input.channels ?? ['EMAIL', 'SMS'],
      logMessage: 'A one-time authentication code was sent.',
      redactProviderDetails: true,
    });
  }

  private async enqueueForRecipient(input: {
    eventType: string;
    recipient: NotificationRecipient;
    rendered: RenderedNotification;
    relatedEntityType: string;
    relatedEntityId: string | null;
    metadata: Record<string, unknown> | null;
    channels: NotificationChannel[];
    logMessage?: string;
    redactProviderDetails?: boolean;
  }) {
    await Promise.all(input.channels.map((channel) => this.enqueueChannel(channel, input.recipient, input.rendered, input)));
  }

  private async enqueueChannel(
    channel: NotificationChannel,
    recipient: NotificationRecipient,
    rendered: RenderedNotification,
    input: {
      eventType: string;
      relatedEntityType: string;
      relatedEntityId: string | null;
      metadata: Record<string, unknown> | null;
      logMessage?: string;
      redactProviderDetails?: boolean;
    },
  ) {
    const destination = channel === 'EMAIL' ? recipient.email : normalizeEthiopianPhone(recipient.phoneNumber);
    const log = await createNotificationLog({
      eventType: input.eventType,
      channel,
      recipient,
      destination,
      subject: channel === 'EMAIL' ? rendered.subject : null,
      message: input.logMessage ?? rendered.message,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      metadata: input.metadata,
    });

    const provider = channel === 'EMAIL' ? this.emailProvider : this.smsProvider;
    if (!destination) {
      await markNotificationLogSkipped(log.id, `No ${channel === 'EMAIL' ? 'email address' : 'phone number'} found for recipient`);
      return;
    }

    if (!provider.isEnabled()) {
      await markNotificationLogSkipped(log.id, `${channel} notifications are disabled`);
      return;
    }

    try {
      const result = await provider.send({
        destination,
        subject: rendered.subject,
        message: rendered.message,
      });
      await markNotificationLogSent(
        log.id,
        input.redactProviderDetails ? null : result.providerResponse ?? null,
        result.providerMessageId ?? null,
      );
    } catch (error) {
      await markNotificationLogFailed(
        log.id,
        input.redactProviderDetails
          ? 'Authentication code delivery failed'
          : error instanceof Error
            ? error.message
            : String(error),
      );
    }
  }

  private async resolveRecipients(eventType: WorkflowNotificationEvent, payload: WorkflowNotificationPayload) {
    const employeeId = payload.employeeId;

    if (eventType === 'ATTENDANCE_SUPERVISOR_APPROVED') {
      return getNotificationRecipientsByRole('human_resource');
    }

    if (eventType === 'ATTENDANCE_HR_APPROVED') {
      return getNotificationRecipientsByRole('finance');
    }

    if (!employeeId) return [];

    if (eventType.endsWith('_SUBMITTED')) {
      if (eventType === 'ATTENDANCE_CORRECTION_SUBMITTED') return getHrNotificationRecipients();
      return getSupervisorNotificationRecipients(employeeId);
    }

    if (eventType === 'ATTENDANCE_CORRECTION_HR_REVIEWED') {
      return getSupervisorNotificationRecipients(employeeId);
    }

    if (eventType === 'LEAVE_REQUEST_SUPERVISOR_APPROVED' || eventType === 'LEAVE_INTERRUPTION_SUPERVISOR_APPROVED') {
      return getHrNotificationRecipients();
    }

    if (eventType === 'ATTENDANCE_RETURNED') {
      return getSupervisorNotificationRecipients(employeeId);
    }

    const employee = await getEmployeeNotificationRecipient(employeeId);
    return employee ? [employee] : [];
  }
}

export const notificationService = new NotificationService();

export async function safeEnqueueWorkflowNotification(
  eventType: WorkflowNotificationEvent,
  payload: WorkflowNotificationPayload,
  options: WorkflowNotificationOptions = {},
) {
  try {
    await notificationService.enqueueWorkflowNotification(eventType, payload, options);
  } catch (error) {
    console.error('Workflow notification failed safely:', {
      eventType,
      entityId: payload.entityId,
      error,
    });
  }
}

export async function safeSendDirectNotification(input: {
  eventType: string;
  recipientEmail: string;
  subject: string;
  message: string;
  channels?: NotificationChannel[];
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await notificationService.enqueueDirectNotification(input);
  } catch (error) {
    console.error('Direct notification failed safely:', {
      eventType: input.eventType,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export function normalizeEthiopianPhone(value?: string | null) {
  if (!value) return null;
  const digits = value.replace(/[^\d+]/g, '').replace(/^00/, '+');
  if (digits.startsWith('+251') && digits.length >= 13) return digits;
  const numeric = digits.replace(/\D/g, '');
  if (numeric.startsWith('251') && numeric.length >= 12) return `+${numeric}`;
  if (numeric.startsWith('0') && numeric.length >= 10) return `+251${numeric.slice(1)}`;
  if (numeric.startsWith('9') && numeric.length >= 9) return `+251${numeric}`;
  return null;
}

export function renderWorkflowNotification(eventType: WorkflowNotificationEvent, payload: WorkflowNotificationPayload): RenderedNotification {
  const title = payload.title ?? humanizeEventType(eventType);
  const datePart = payload.date ? ` on ${payload.date}` : '';
  const reasonPart = payload.reason ? ` Reason: ${payload.reason}` : '';

  const messages: Record<WorkflowNotificationEvent, RenderedNotification> = {
    LEAVE_REQUEST_SUBMITTED: {
      subject: 'Leave request submitted',
      message: `A leave request${datePart} is waiting for your review.${reasonPart}`,
    },
    LEAVE_REQUEST_APPROVED: {
      subject: 'Leave request approved',
      message: `Your leave request${datePart} has been approved.`,
    },
    LEAVE_REQUEST_SUPERVISOR_DECISION: {
      subject: payload.status === 'REJECTED' ? 'Leave request rejected by supervisor' : 'Leave request approved by supervisor',
      message: payload.status === 'REJECTED'
        ? `Your ${payload.leaveType ? `${payload.leaveType} ` : ''}leave request${datePart} was rejected by ${payload.actorName ?? 'your supervisor'}.${reasonPart}`
        : `Your ${payload.leaveType ? `${payload.leaveType} ` : ''}leave request${datePart} was approved by ${payload.actorName ?? 'your supervisor'} and is awaiting HR authorization.`,
    },
    LEAVE_REQUEST_SUPERVISOR_APPROVED: {
      subject: 'Leave request awaiting HR authorization',
      message: `A supervisor-approved leave request${datePart} is waiting for HR authorization.`,
    },
    LEAVE_REQUEST_AUTHORIZED: {
      subject: 'Leave request authorized',
      message: `Your leave request${datePart} has been authorized by HR.`,
    },
    LEAVE_REQUEST_AUTHORIZATION_REJECTED: {
      subject: 'Leave authorization rejected',
      message: `HR rejected authorization for your leave request${datePart}.${reasonPart}`,
    },
    LEAVE_INTERRUPTION_SUPERVISOR_APPROVED: {
      subject: 'Leave interruption awaiting HR authorization',
      message: `A supervisor-approved leave interruption${datePart} is waiting for HR authorization.`,
    },
    LEAVE_INTERRUPTION_AUTHORIZED: {
      subject: 'Leave interruption authorized',
      message: `Your leave interruption and continuation pattern${datePart} has been authorized by HR.`,
    },
    LEAVE_INTERRUPTION_AUTHORIZATION_REJECTED: {
      subject: 'Leave interruption authorization rejected',
      message: `HR rejected authorization for your leave interruption${datePart}.${reasonPart}`,
    },
    LEAVE_REQUEST_REJECTED: {
      subject: 'Leave request rejected',
      message: `Your leave request${datePart} has been rejected.${reasonPart}`,
    },
    OVERTIME_REQUEST_SUBMITTED: {
      subject: 'Overtime request submitted',
      message: `An overtime request${datePart} is waiting for your review.${reasonPart}`,
    },
    OVERTIME_ASSIGNED: {
      subject: 'Overtime assigned',
      message: `You have been assigned overtime${datePart} by ${payload.actorName ?? 'your supervisor'}${formatTimeWindow(payload.startAt, payload.endAt)}${formatDuration(payload.durationMinutes)}.${reasonPart}`,
    },
    OVERTIME_REQUEST_APPROVED: {
      subject: 'Overtime request approved',
      message: `Your overtime request${datePart} has been approved.`,
    },
    OVERTIME_REQUEST_REJECTED: {
      subject: 'Overtime request rejected',
      message: `Your overtime request${datePart} has been rejected.${reasonPart}`,
    },
    ATTENDANCE_CORRECTION_SUBMITTED: {
      subject: 'Attendance correction submitted',
      message: `An attendance correction request${datePart} is waiting for HR review.${reasonPart}`,
    },
    ATTENDANCE_CORRECTION_HR_REVIEWED: {
      subject: 'Attendance correction reviewed by HR',
      message: `An attendance correction request${datePart} has passed HR review and is waiting for supervisor approval.`,
    },
    ATTENDANCE_CORRECTION_HR_REJECTED: {
      subject: 'Attendance correction rejected by HR',
      message: `Your attendance correction request${datePart} was rejected by HR.${reasonPart}`,
    },
    ATTENDANCE_CORRECTION_SUPERVISOR_APPROVED: {
      subject: 'Attendance correction approved',
      message: `Your attendance correction request${datePart} has been approved.`,
    },
    ATTENDANCE_CORRECTION_SUPERVISOR_REJECTED: {
      subject: 'Attendance correction rejected',
      message: `Your attendance correction request${datePart} has been rejected.${reasonPart}`,
    },
    BIOMETRIC_EXEMPTION_SUBMITTED: {
      subject: 'Biometric exemption submitted',
      message: `A biometric exemption request is waiting for your approval.${reasonPart}`,
    },
    BIOMETRIC_EXEMPTION_APPROVED: {
      subject: 'Biometric exemption approved',
      message: 'Your biometric exemption request has been approved.',
    },
    BIOMETRIC_EXEMPTION_REJECTED: {
      subject: 'Biometric exemption rejected',
      message: `Your biometric exemption request has been rejected.${reasonPart}`,
    },
    SUPERVISOR_DELEGATION_ASSIGNED: {
      subject: 'Supervisor delegation assigned',
      message: `${payload.actorName ?? 'A supervisor'} delegated supervisor responsibilities to you for ${formatPeriod(payload.dateFrom, payload.dateTo)}.`,
    },
    SUPERVISOR_DELEGATION_REVOKED: {
      subject: 'Supervisor delegation revoked',
      message: `Your supervisor delegation from ${payload.delegatingSupervisorName ?? payload.actorName ?? 'the supervisor'} for ${formatPeriod(payload.dateFrom, payload.dateTo)} has been revoked.`,
    },
    ATTENDANCE_SUPERVISOR_APPROVED: {
      subject: 'Attendance submitted for HR approval',
      message: `Attendance for ${formatPeriod(payload.dateFrom, payload.dateTo)} covering ${formatEmployeeCount(payload.employeeCount)} (${formatRecordCount(payload.recordCount)}) was submitted by ${payload.actorName ?? 'a supervisor'} for HR approval.`,
    },
    ATTENDANCE_HR_APPROVED: {
      subject: 'Attendance ready for Finance',
      message: `Attendance for ${formatPeriod(payload.dateFrom, payload.dateTo)} covering ${formatEmployeeCount(payload.employeeCount)} (${formatRecordCount(payload.recordCount)}) was submitted by ${payload.actorName ?? 'HR'} and is ready for Finance processing.`,
    },
    ATTENDANCE_RETURNED: {
      subject: 'Attendance returned',
      message: `A daily attendance record${datePart} has been returned.${reasonPart}`,
    },
  };

  return messages[eventType] ?? {
    subject: title,
    message: title,
  };
}

function inferEntityType(eventType: WorkflowNotificationEvent) {
  if (eventType.startsWith('LEAVE_')) return 'leave_request';
  if (eventType.startsWith('OVERTIME_')) return 'overtime_request';
  if (eventType.startsWith('SUPERVISOR_DELEGATION_')) return 'supervisor_delegation';
  if (eventType.startsWith('ATTENDANCE_CORRECTION_')) return 'manual_punch_request';
  if (eventType.startsWith('BIOMETRIC_EXEMPTION_')) return 'biometric_exemption';
  return 'attendance_daily_record';
}

function buildNotificationMetadata(payload: WorkflowNotificationPayload) {
  const workflowContext = Object.fromEntries(Object.entries({
    employeeId: payload.employeeId,
    status: payload.status,
    actorUserId: payload.actorUserId,
    actorName: payload.actorName,
    date: payload.date,
    dateFrom: payload.dateFrom,
    dateTo: payload.dateTo,
    employeeCount: payload.employeeCount,
    recordCount: payload.recordCount,
    leaveType: payload.leaveType,
    startAt: payload.startAt,
    endAt: payload.endAt,
    durationMinutes: payload.durationMinutes,
    delegatingSupervisorName: payload.delegatingSupervisorName,
  }).filter(([, value]) => value !== undefined && value !== null));
  const metadata = { ...workflowContext, ...(payload.metadata ?? {}) };
  return Object.keys(metadata).length ? metadata : null;
}

function formatPeriod(dateFrom?: string | null, dateTo?: string | null) {
  if (dateFrom && dateTo) {
    const from = formatGregorianDateTime(dateFrom);
    const to = formatGregorianDateTime(dateTo);
    return dateFrom === dateTo ? from : `${from} to ${to}`;
  }
  return formatGregorianDateTime(dateFrom ?? dateTo) ?? 'the approved period';
}

function formatEmployeeCount(value?: number | null) {
  const count = value ?? 0;
  return `${count} employee${count === 1 ? '' : 's'}`;
}

function formatRecordCount(value?: number | null) {
  const count = value ?? 0;
  return `${count} attendance record${count === 1 ? '' : 's'}`;
}

function formatTimeWindow(startAt?: string | null, endAt?: string | null) {
  if (!startAt || !endAt) return '';
  return ` from ${formatAddisTime(startAt)} to ${formatAddisTime(endAt)}`;
}

function formatDuration(minutes?: number | null) {
  if (!minutes) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  const parts = [hours ? `${hours} hour${hours === 1 ? '' : 's'}` : '', remainder ? `${remainder} minute${remainder === 1 ? '' : 's'}` : ''].filter(Boolean);
  return parts.length ? ` (${parts.join(' ')})` : '';
}

function formatAddisTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Addis_Ababa',
  }).format(date);
}

function formatGregorianDateTime(value?: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Addis_Ababa',
  }).format(date);
}

function humanizeEventType(eventType: string) {
  return eventType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function isTruthy(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

export function workflowNotificationsAreEnabled() {
  return isTruthy(process.env.NOTIFICATIONS_ENABLED);
}

function extractProviderMessageId(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const messageId = record.messageId ?? record.message_id ?? record.id ?? record.reference;
  return typeof messageId === 'string' ? messageId : null;
}
