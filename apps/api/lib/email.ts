import { Resend } from 'resend';
import { render } from '@react-email/render';
import VerifyEmail from '../templates/verify-email';
import ResetPasswordEmail from '../templates/reset-password';

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key-for-development');

export class EmailService {
  private static instance: EmailService;

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  public async sendVerifyEmail(email: string, verificationCode: string): Promise<boolean> {
    try {
      const emailHtml = await render(VerifyEmail({
        verificationCode
      }));

      await resend.emails.send({
        from: 'Taams <accounts@taams.com>',
        to: email,
        subject: 'Verify Your Account Registration',
        html: emailHtml,
      });
      console.log('Verify email sent successfully:');
      return true;
    } catch (error) {
      console.error('Error sending verify email:', error);
      return false;
    }
  }

  public async sendResetPasswordEmail(firstName: string, email: string, url: string): Promise<boolean> {
    try {
      const emailHtml = await render(ResetPasswordEmail({
        userFirstname: firstName,
        resetPasswordLink: url
      }));

      await resend.emails.send({
        from: 'Taams <accounts@taams.com>',
        to: email,
        subject: 'Reset Your Password',
        html: emailHtml,
      });
      return true;
    } catch (error) {
      console.error('Error sending reset password email:', error);
      return false;
    }
  }
}

export const emailService = EmailService.getInstance();
