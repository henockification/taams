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
        <div className="grid max-w-md grid-cols-2 gap-2 text-sm font-medium text-white/86">
          {[
            t('coverageEmployees'),
            t('coverageAttendance'),
            t('coverageLeave'),
            t('coverageRoleAccess'),
            t('coverageReports'),
            t('coverageDeviceSync'),
          ].map((item) => (
            <div key={item} className="rounded-md border border-white/18 bg-white/9 px-3 py-2">
              {item}
            </div>
          ))}
        </div>
      }
      sideFooter={<div />}
    >
      <SignInForm />
    </AuthShell>
  );
}
