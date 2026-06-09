'use client';

import { Check, Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Link, usePathname } from '@/i18n';
import { cn } from '@/lib/utils';

const localeOptions = [
  { value: 'en', labelKey: 'languageEnglish', shortLabel: 'EN' },
  { value: 'am', labelKey: 'languageAmharic', shortLabel: 'AM' },
] as const;

type LanguageSwitcherProps = {
  variant?: 'outline' | 'ghost';
  className?: string;
};

export function LanguageSwitcher({
  variant = 'outline',
  className,
}: LanguageSwitcherProps) {
  const locale = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations('auth');
  const query = searchParams.toString();
  const href = query ? `${pathname}?${query}` : pathname;
  const activeOption = localeOptions.find((option) => option.value === locale) ?? localeOptions[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="sm"
          className={cn('h-9 gap-2', className)}
          aria-label={t('language')}
        >
          <Languages className="size-4" />
          <span>{activeOption.shortLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {localeOptions.map((option) => (
          <DropdownMenuItem key={option.value} asChild>
            <Link
              href={href}
              locale={option.value}
              className="flex w-full items-center justify-between"
            >
              <span>{t(option.labelKey)}</span>
              <Check
                className={cn(
                  'size-4 text-primary',
                  locale === option.value ? 'opacity-100' : 'opacity-0'
                )}
              />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
