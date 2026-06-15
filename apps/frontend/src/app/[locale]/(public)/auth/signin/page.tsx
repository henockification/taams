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
      sideContent={
        <div className="rounded-lg border border-white/20 bg-white/10 p-4 shadow-sm backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">{t('signInPanelTitle')}</p>
              <p className="mt-1 text-xs leading-5 text-white/70">{t('signInPanelDescription')}</p>
            </div>
            <span className="rounded-md bg-white px-2 py-1 text-xs font-medium text-primary">
              TAAMS
            </span>
          </div>
        </div>
      }
      sideFooter={<div />}
    >
      <SignInForm />
    </AuthShell>
  );
}
