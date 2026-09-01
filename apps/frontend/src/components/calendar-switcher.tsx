'use client';

import { CalendarDays, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const options = [
  { value: 'gregory', shortLabel: 'GC', labelKey: 'gregorian' },
  { value: 'ethiopic', shortLabel: 'EC', labelKey: 'ethiopian' },
] as const;

export function CalendarSwitcher({ className }: { className?: string }) {
  const t = useTranslations('calendar');
  const { calendar, setCalendar } = useCalendarPreference();
  const active = options.find((option) => option.value === calendar) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="sm" className={cn('h-9 gap-2', className)} aria-label={t('calendarSystem')}>
          <CalendarDays className="size-4" />
          <span>{active.shortLabel}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {options.map((option) => (
          <DropdownMenuItem key={option.value} onSelect={() => setCalendar(option.value)} className="flex items-center justify-between">
            <span>{t(option.labelKey)}</span>
            <Check className={cn('size-4 text-primary', calendar === option.value ? 'opacity-100' : 'opacity-0')} />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

