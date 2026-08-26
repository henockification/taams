import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-development');

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export class EmailService {
  private static instance: EmailService;

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  public async sendOrderPlacedEmail(
    userFirstname: string,
    email: string,
    orderNumber: string,
    viewOrderLink: string
  ): Promise<boolean> {
    try {
      const emailHtml = `
        <p>Hi ${escapeHtml(userFirstname)},</p>
        <p>Your order #${escapeHtml(orderNumber)} has been placed.</p>
        <p><a href="${escapeHtml(viewOrderLink)}">View your order</a></p>
      `;

      await resend.emails.send({
        from: 'Tams <orders@taams.com>',
        to: email,
        subject: `Your order #${orderNumber} has been placed`,
        html: emailHtml,
      });
      return true;
    } catch (error) {
      console.error('Error sending order placed email:', error);
      return false;
    }
  }

  public async sendOrderPlacedAdminEmail(
    adminEmail: string,
    orderNumber: string,
    customerName: string | null,
    customerEmail: string,
    viewOrderLink: string
  ): Promise<boolean> {
    try {
      const emailHtml = `
        <p>New order #${escapeHtml(orderNumber)} needs attention.</p>
        <p>Customer: ${escapeHtml(customerName ?? 'Unknown')}</p>
        <p>Email: ${escapeHtml(customerEmail)}</p>
        <p><a href="${escapeHtml(viewOrderLink)}">View order</a></p>
      `;

      await resend.emails.send({
        from: 'Tams <orders@taams.com>',
        to: adminEmail,
        subject: `New order #${orderNumber} - action required`,
        html: emailHtml,
      });
      return true;
    } catch (error) {
      console.error('Error sending order placed admin email:', error);
      return false;
    }
  }
}

export const emailService = EmailService.getInstance();
