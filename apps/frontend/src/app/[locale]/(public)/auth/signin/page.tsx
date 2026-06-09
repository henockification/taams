'use client';

import { useTranslations } from 'next-intl';
import { AuthShell } from '@/components/auth/AuthShell';
import { SignInForm } from '@/components/auth/SignInForm';

export default function SignInPage() {
  const t = useTranslations('auth');

  return (
    <AuthShell
      eyebrow={t('brandEyebrow')}
      title={t('signInTitle')}
      description={t('signInDescription')}
      footer={t('signInFooter')}
    >
      <SignInForm />
    </AuthShell>
  );
}
