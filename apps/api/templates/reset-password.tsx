import React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface ResetPasswordEmailProps {
  userFirstname?: string;
  resetPasswordLink?: string;
}

const baseUrl = process.env.FRONT_END_URL || 'http://localhost:3008';

export default function ResetPasswordEmail({
  userFirstname = 'User',
  resetPasswordLink = `${baseUrl}/reset-password`,
}: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Preview>Reset your Taams password</Preview>
        <Container style={container}>
          <Section style={coverSection}>
            <Section style={imageSection}>
              <Img
                src={`${baseUrl}/logo-transparent.png`}
                width="75"
                height="45"
                alt="Taams Logo"
                style={{ display: 'block', margin: '0 auto' }}
              />
            </Section>
            <Section style={upperSection}>
              <Heading style={h1}>Reset Your Password</Heading>
              <Text style={mainText}>Hello {userFirstname},</Text>
              <Text style={mainText}>
                We received a request to reset your password for your Taams account. Click the
                button below to create a new password:
              </Text>
              <Section style={buttonSection}>
                <Button style={button} href={resetPasswordLink}>
                  Reset Password
                </Button>
              </Section>
              <Text style={mainText}>
                If the button doesn't work, you can copy and paste this link into your browser:
              </Text>
              <Text style={linkText}>
                <Link href={resetPasswordLink} style={link}>
                  {resetPasswordLink}
                </Link>
              </Text>
              <Text style={mainText}>This link will expire in 1 hour for security reasons.</Text>
            </Section>
            <Hr />
            <Section style={lowerSection}>
              <Text style={cautionText}>
                If you didn't request a password reset, please ignore this email. Your password
                will remain unchanged.
              </Text>
              <Text style={cautionText}>
                Taams will never contact you by email to request your password, payment card
                information, or banking details. Please do not disclose such information in
                response to any message claiming to represent us.
              </Text>
            </Section>
          </Section>
          <Text style={footerText}>
            This email was sent by Taams, 7519, Republic CT, Alexandria, VA, USA. ©{' '}
            {new Date().getFullYear()} Taams. All rights reserved. Taams is a registered
            trademark of{' '}
            <Link href="https://www.taams.com" target="_blank" style={link}>
              Taams.com
            </Link>
            , Inc. View our{' '}
            <Link href="https://www.taams.com/privacy" target="_blank" style={link}>
              privacy policy
            </Link>
            .
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

ResetPasswordEmail.PreviewProps = {
  userFirstname: 'Alex',
  resetPasswordLink: 'http://localhost:3008/auth/reset-password?token=preview',
} satisfies ResetPasswordEmailProps;

const main = {
  backgroundColor: '#fff',
  color: '#212121',
};

const container = {
  padding: '20px',
  margin: '0 auto',
  backgroundColor: '#eee',
};

const h1 = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '20px',
  fontWeight: 'bold',
  marginBottom: '15px',
};

const link = {
  color: '#ae8942',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  textDecoration: 'underline',
};

const text = {
  color: '#333',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '14px',
  margin: '24px 0',
};

const imageSection = {
  backgroundColor: '#F5F2EA',
  display: 'flex',
  padding: '20px 0',
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  textAlign: 'center' as const,
};

const coverSection = { backgroundColor: '#fff' };

const upperSection = { padding: '25px 35px' };

const lowerSection = { padding: '25px 35px' };

const footerText = {
  ...text,
  fontSize: '12px',
  padding: '0 20px',
};

const mainText = { ...text, marginBottom: '14px' };

const cautionText = { ...text, margin: '0px', fontSize: '12px' };

const buttonSection = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#ae8942',
  borderRadius: '3px',
  color: '#fff',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const linkText = {
  ...text,
  wordBreak: 'break-all' as const,
  margin: '16px 0',
};
