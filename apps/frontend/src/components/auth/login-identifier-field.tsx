'use client';

import type { UseFormRegisterReturn } from 'react-hook-form';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group';
import {
  ETHIOPIA_COUNTRY_CODE,
  isValidLocalEthiopianMobile,
  toLocalEthiopianMobile,
  type LoginMethod,
} from '@/lib/login-identifier';

export function LoginIdentifierField({
  method,
  registration,
  error,
}: {
  method: LoginMethod;
  registration: UseFormRegisterReturn;
  error?: string;
}) {
  const t = useTranslations('auth');
  const { onChange, ...rest } = registration;

  if (method === 'email') {
    return (
      <div className="space-y-2">
        <Label htmlFor="identifier">{t('email')}</Label>
        <Input
          id="identifier"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t('emailPlaceholder')}
          {...rest}
          onChange={onChange}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="identifier">{t('phone')}</Label>
      <InputGroup>
        <InputGroupAddon align="inline-start" className="pointer-events-none border-r border-input pr-3">
          <InputGroupText className="text-muted-foreground">{ETHIOPIA_COUNTRY_CODE}</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id="identifier"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder={t('phonePlaceholder')}
          maxLength={9}
          {...rest}
          onChange={(event) => {
            event.target.value = toLocalEthiopianMobile(event.target.value);
            void onChange(event);
          }}
        />
      </InputGroup>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

export function identifierFieldRules(
  method: LoginMethod,
  t: ReturnType<typeof useTranslations>,
) {
  if (method === 'email') {
    return {
      required: t('validation.emailRequired'),
      validate: (value: string) => /^\S+@\S+$/.test(value) || t('validation.invalidEmail'),
    };
  }

  return {
    required: t('validation.phoneRequired'),
    validate: (value: string) => isValidLocalEthiopianMobile(value) || t('validation.invalidPhone'),
  };
}
