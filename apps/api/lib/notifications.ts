import {
  createNotificationLog,
  getEmployeeNotificationRecipient,
  getHrNotificationRecipients,
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
  | 'LEAVE_REQUEST_REJECTED'
  | 'OVERTIME_REQUEST_SUBMITTED'
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
  metadata?: Record<string, unknown>;
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
    return isTruthy(process.env.NOTIFICATIONS_EMAIL_ENABLED);
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
          subject: input.subject ?? 'TAAMS notification',
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
    return isTruthy(process.env.NOTIFICATIONS_SMS_ENABLED);
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

  async enqueueWorkflowNotification(eventType: WorkflowNotificationEvent, payload: WorkflowNotificationPayload) {
    const recipients = await this.resolveRecipients(eventType, payload);
    const rendered = renderWorkflowNotification(eventType, payload);
    const relatedEntityType = payload.entityType ?? inferEntityType(eventType);

    await Promise.all(recipients.map((recipient) => this.enqueueForRecipient({
      eventType,
      recipient,
      rendered,
      relatedEntityType,
      relatedEntityId: payload.entityId,
      metadata: payload.metadata ?? null,
    })));
  }

  private async enqueueForRecipient(input: {
    eventType: WorkflowNotificationEvent;
    recipient: NotificationRecipient;
    rendered: RenderedNotification;
    relatedEntityType: string;
    relatedEntityId: string;
    metadata: Record<string, unknown> | null;
  }) {
    await Promise.all([
      this.enqueueChannel('EMAIL', input.recipient, input.rendered, input),
      this.enqueueChannel('SMS', input.recipient, input.rendered, input),
    ]);
  }

  private async enqueueChannel(
    channel: NotificationChannel,
    recipient: NotificationRecipient,
    rendered: RenderedNotification,
    input: {
      eventType: WorkflowNotificationEvent;
      relatedEntityType: string;
      relatedEntityId: string;
      metadata: Record<string, unknown> | null;
    },
  ) {
    const destination = channel === 'EMAIL' ? recipient.email : normalizeEthiopianPhone(recipient.phoneNumber);
    const log = await createNotificationLog({
      eventType: input.eventType,
      channel,
      recipient,
      destination,
      subject: channel === 'EMAIL' ? rendered.subject : null,
      message: rendered.message,
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
      await markNotificationLogSent(log.id, result.providerResponse ?? null, result.providerMessageId ?? null);
    } catch (error) {
      await markNotificationLogFailed(log.id, error instanceof Error ? error.message : String(error));
    }
  }

  private async resolveRecipients(eventType: WorkflowNotificationEvent, payload: WorkflowNotificationPayload) {
    const employeeId = payload.employeeId;
    if (!employeeId) return [];

    if (eventType.endsWith('_SUBMITTED')) {
      if (eventType === 'ATTENDANCE_CORRECTION_SUBMITTED') return getHrNotificationRecipients();
      return getSupervisorNotificationRecipients(employeeId);
    }

    if (eventType === 'ATTENDANCE_CORRECTION_HR_REVIEWED' || eventType === 'ATTENDANCE_SUPERVISOR_APPROVED') {
      return eventType === 'ATTENDANCE_SUPERVISOR_APPROVED'
        ? getHrNotificationRecipients()
        : getSupervisorNotificationRecipients(employeeId);
    }

    if (eventType === 'ATTENDANCE_HR_APPROVED' || eventType === 'ATTENDANCE_RETURNED') {
      return getSupervisorNotificationRecipients(employeeId);
    }

    const employee = await getEmployeeNotificationRecipient(employeeId);
    return employee ? [employee] : [];
  }
}

export const notificationService = new NotificationService();

export async function safeEnqueueWorkflowNotification(eventType: WorkflowNotificationEvent, payload: WorkflowNotificationPayload) {
  try {
    await notificationService.enqueueWorkflowNotification(eventType, payload);
  } catch (error) {
    console.error('Workflow notification failed safely:', {
      eventType,
      entityId: payload.entityId,
      error,
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

function renderWorkflowNotification(eventType: WorkflowNotificationEvent, payload: WorkflowNotificationPayload): RenderedNotification {
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
    LEAVE_REQUEST_REJECTED: {
      subject: 'Leave request rejected',
      message: `Your leave request${datePart} has been rejected.${reasonPart}`,
    },
    OVERTIME_REQUEST_SUBMITTED: {
      subject: 'Overtime request submitted',
      message: `An overtime request${datePart} is waiting for your review.${reasonPart}`,
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
    ATTENDANCE_SUPERVISOR_APPROVED: {
      subject: 'Attendance approved by supervisor',
      message: `A daily attendance record${datePart} has been supervisor approved and is ready for HR review.`,
    },
    ATTENDANCE_HR_APPROVED: {
      subject: 'Attendance approved by HR',
      message: `A daily attendance record${datePart} has been approved by HR for payroll readiness.`,
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
  if (eventType.startsWith('ATTENDANCE_CORRECTION_')) return 'manual_punch_request';
  if (eventType.startsWith('BIOMETRIC_EXEMPTION_')) return 'biometric_exemption';
  return 'attendance_daily_record';
}

function humanizeEventType(eventType: string) {
  return eventType.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function isTruthy(value?: string | null) {
  return ['1', 'true', 'yes', 'on'].includes((value ?? '').trim().toLowerCase());
}

function extractProviderMessageId(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const messageId = record.messageId ?? record.message_id ?? record.id ?? record.reference;
  return typeof messageId === 'string' ? messageId : null;
}
