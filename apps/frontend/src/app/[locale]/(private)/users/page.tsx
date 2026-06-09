'use client';

import UsersTable from '@/components/users/UsersTable';
import { useTranslations } from 'next-intl';

export default function UsersPage() {
  const t = useTranslations('rbac');

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="space-y-2">
        <p className="text-sm font-medium text-primary">{t('securityEyebrow')}</p>
        <h1 className="text-2xl font-semibold tracking-normal text-foreground">
          {t('usersTitle')}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t('usersDescription')}
        </p>
      </div>
      <UsersTable />
    </div>
  );
}
