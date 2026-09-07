'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export type LoginMethod = 'email' | 'phone';

export function LoginMethodToggle({
  method,
  onChange,
}: {
  method: LoginMethod;
  onChange: (method: LoginMethod) => void;
}) {
  const t = useTranslations('auth');

  return (
    <div className="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant={method === 'email' ? 'default' : 'outline'}
        onClick={() => onChange('email')}
      >
        {t('email')}
      </Button>
      <Button
        type="button"
        variant={method === 'phone' ? 'default' : 'outline'}
        onClick={() => onChange('phone')}
      >
        {t('phone')}
      </Button>
    </div>
  );
}
