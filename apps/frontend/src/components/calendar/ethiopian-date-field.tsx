'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDate, getDayOfWeek } from '@internationalized/date';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

export function clampDateValue(value: string, min?: string, max?: string) {
  if (!value) return value;
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

type EthiopianDateFieldProps = {
  id: string;
  value: string;
  onChange: (gregorianDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  'aria-label'?: string;
};

const ethiopicCalendar = getEthiopicCalendar();

export function EthiopianDateField({
  id,
  value,
  onChange,
  required,
  disabled,
  min,
  max,
  className,
  'aria-label': ariaLabel,
}: EthiopianDateFieldProps) {
  const t = useTranslations('calendar');
  const locale = useLocale();
  const [ethiopianInput, setEthiopianInput] = useState(() => formatEthiopianInput(value));
  const [invalid, setInvalid] = useState(false);
  const ethiopianInputRef = useRef<HTMLInputElement>(null);
  const selectedEthiopian = useMemo(() => gregorianToEthiopian(value), [value]);
  const emitChange = (nextValue: string) => {
    onChange(clampDateValue(nextValue, min, max));
  };

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
      emitChange('');
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
    emitChange(gregorian);
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex gap-1">
        <Input
          ref={ethiopianInputRef}
          id={id}
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
          aria-describedby={invalid ? `${id}-error` : undefined}
          required={required}
          disabled={disabled}
          aria-label={ariaLabel}
        />
        <EthiopianCalendarPicker
          value={selectedEthiopian}
          locale={locale}
          disabled={disabled}
          min={min}
          max={max}
          onChange={(date) => {
            const gregorian = ethiopianToGregorian(date.year, date.month, date.day);
            if (gregorian) emitChange(gregorian);
          }}
        />
      </div>
      {invalid ? <p id={`${id}-error`} className="text-xs text-destructive">{t('invalidEthiopianDate')}</p> : null}
    </div>
  );
}

export function EthiopianCalendarPicker({
  value,
  locale,
  disabled,
  min,
  max,
  onChange,
}: {
  value: CalendarDate | null;
  locale: string;
  disabled?: boolean;
  min?: string;
  max?: string;
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
  const monthLabel = formatCalendarDate(displayMonth.toDate('UTC'), locale, 'ethiopic', {
    month: 'long',
    year: 'numeric',
    day: undefined,
    timeZone: 'UTC',
  });
  const weekdayLabels = useMemo(() => (
    Array.from({ length: 7 }, (_, index) => (
      new Intl.DateTimeFormat(locale.startsWith('am') ? 'am-ET' : 'en-ET', { weekday: 'narrow', timeZone: 'UTC' })
        .format(new Date(Date.UTC(2024, 0, 7 + index)))
    ))
  ), [locale]);

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
            const gregorian = ethiopianToGregorian(displayMonth.year, displayMonth.month, day);
            const isOutOfRange = Boolean(
              gregorian && ((min && gregorian < min) || (max && gregorian > max)),
            );
            return (
              <Button
                key={day}
                type="button"
                variant={selected ? 'default' : 'ghost'}
                size="icon-sm"
                className={cn('size-8 text-xs', isToday && !selected && 'border border-primary')}
                aria-label={`${monthLabel} ${day}`}
                disabled={isOutOfRange}
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
