'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDate, getDayOfWeek } from '@internationalized/date';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  ethiopianToGregorian,
  formatCalendarDate,
  formatEthiopianInput,
  getEthiopicCalendar,
  gregorianToEthiopian,
  parseEthiopianDate,
} from '@/lib/calendar';
import { cn } from '@/lib/utils';

type DualCalendarDateFieldProps = {
  id: string;
  value: string;
  onChange: (gregorianDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

const ethiopicCalendar = getEthiopicCalendar();

export function DualCalendarDateField({
  id,
  value,
  onChange,
  required,
  disabled,
  className,
}: DualCalendarDateFieldProps) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const [ethiopianInput, setEthiopianInput] = useState(() => formatEthiopianInput(value));
  const [invalid, setInvalid] = useState(false);
  const ethiopianInputRef = useRef<HTMLInputElement>(null);
  const selectedEthiopian = useMemo(() => gregorianToEthiopian(value), [value]);

  useEffect(() => {
    setEthiopianInput(formatEthiopianInput(value));
    setInvalid(false);
  }, [value]);

  useEffect(() => {
    ethiopianInputRef.current?.setCustomValidity(invalid ? t('invalidEthiopianDate') : '');
  }, [invalid, t]);

  const commitEthiopianInput = (input: string) => {
    if (!input) {
      setInvalid(false);
      onChange('');
      return;
    }

    const parsed = parseEthiopianDate(input);
    if (!parsed) {
      setInvalid(true);
      return;
    }

    const gregorian = ethiopianToGregorian(parsed.year, parsed.month, parsed.day);
    if (!gregorian) {
      setInvalid(true);
      return;
    }

    setInvalid(false);
    onChange(gregorian);
  };

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-xs text-muted-foreground">{t('gregorianShort')}</Label>
        <Input
          id={id}
          type="date"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-ethiopian`} className="text-xs text-muted-foreground">{t('ethiopianShort')}</Label>
        <div className="flex gap-1">
          <Input
            ref={ethiopianInputRef}
            id={`${id}-ethiopian`}
            type="text"
            inputMode="numeric"
            placeholder="YYYY-MM-DD"
            value={ethiopianInput}
            onChange={(event) => {
              const next = event.target.value;
              setEthiopianInput(next);
              if (!next || /^\d{4}-\d{2}-\d{2}$/.test(next)) commitEthiopianInput(next);
              else setInvalid(false);
            }}
            onBlur={() => commitEthiopianInput(ethiopianInput)}
            aria-invalid={invalid}
            aria-describedby={invalid ? `${id}-ethiopian-error` : undefined}
            disabled={disabled}
          />
          <EthiopianCalendarPicker
            value={selectedEthiopian}
            locale={locale}
            disabled={disabled}
            onChange={(date) => {
              const gregorian = ethiopianToGregorian(date.year, date.month, date.day);
              if (gregorian) onChange(gregorian);
            }}
          />
        </div>
        {invalid ? <p id={`${id}-ethiopian-error`} className="text-xs text-destructive">{t('invalidEthiopianDate')}</p> : null}
      </div>
    </div>
  );
}

function EthiopianCalendarPicker({
  value,
  locale,
  disabled,
  onChange,
}: {
  value: CalendarDate | null;
  locale: string;
  disabled?: boolean;
  onChange: (date: CalendarDate) => void;
}) {
  const t = useTranslations('calendar');
  const todayEthiopian = useMemo(() => {
    const now = new Date();
    const gregorian = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return gregorianToEthiopian(gregorian) ?? new CalendarDate(ethiopicCalendar, 2018, 1, 1);
  }, []);
  const [displayMonth, setDisplayMonth] = useState(() => (value ?? todayEthiopian).set({ day: 1 }));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (value) setDisplayMonth(value.set({ day: 1 }));
  }, [value]);

  const firstWeekday = getDayOfWeek(displayMonth, 'en-US');
  const daysInMonth = ethiopicCalendar.getDaysInMonth(displayMonth);

  // CalendarDate#toDate converts the represented absolute day correctly even though
  // the value itself uses the Ethiopic calendar.
  const monthLabel = formatCalendarDate(displayMonth.toDate('UTC'), locale, 'ethiopic', {
    month: 'long',
    year: 'numeric',
    day: undefined,
    timeZone: 'UTC',
  });
  const weekdayLabels = useMemo(() => Array.from({ length: 7 }, (_, index) => (
    new Intl.DateTimeFormat(locale.startsWith('am') ? 'am-ET' : 'en-ET', { weekday: 'narrow', timeZone: 'UTC' })
      .format(new Date(Date.UTC(2024, 0, 7 + index)))
  )), [locale]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" aria-label={t('openPicker')} disabled={disabled}>
          <CalendarDays className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="mb-3 flex items-center justify-between">
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t('previousMonth')} onClick={() => setDisplayMonth((current) => current.subtract({ months: 1 }).set({ day: 1 }))}>
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-sm font-semibold">{monthLabel}</p>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={t('nextMonth')} onClick={() => setDisplayMonth((current) => current.add({ months: 1 }).set({ day: 1 }))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekdayLabels.map((label, index) => <span key={`${label}-${index}`} className="py-1 text-xs font-medium text-muted-foreground">{label}</span>)}
          {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: daysInMonth }, (_, index) => {
            const day = index + 1;
            const selected = value?.year === displayMonth.year && value.month === displayMonth.month && value.day === day;
            const isToday = todayEthiopian.year === displayMonth.year && todayEthiopian.month === displayMonth.month && todayEthiopian.day === day;
            return (
              <Button
                key={day}
                type="button"
                variant={selected ? 'default' : 'ghost'}
                size="icon-sm"
                className={cn('size-8 text-xs', isToday && !selected && 'border border-primary')}
                aria-label={`${monthLabel} ${day}`}
                onClick={() => {
                  onChange(displayMonth.set({ day }));
                  setOpen(false);
                }}
              >
                {day}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
