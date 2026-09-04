'use client';

import { useId } from 'react';

import { Input } from '@/components/ui/input';
import { clampDateValue, EthiopianDateField } from '@/components/calendar/ethiopian-date-field';
import { cn } from '@/lib/utils';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type CalendarDateFieldProps = {
  id?: string;
  value: string;
  onChange: (gregorianDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
  'aria-label'?: string;
};

export function CalendarDateField({
  id,
  value,
  onChange,
  required,
  disabled,
  min,
  max,
  className,
  'aria-label': ariaLabel,
}: CalendarDateFieldProps) {
  const { calendar } = useCalendarPreference();
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const emitChange = (nextValue: string) => {
    onChange(clampDateValue(nextValue, min, max));
  };

  if (calendar === 'ethiopic') {
    return (
      <EthiopianDateField
        id={fieldId}
        value={value}
        onChange={emitChange}
        required={required}
        disabled={disabled}
        min={min}
        max={max}
        className={className}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <Input
      id={fieldId}
      type="date"
      value={value}
      min={min}
      max={max}
      onChange={(event) => emitChange(event.target.value)}
      required={required}
      disabled={disabled}
      className={className}
      aria-label={ariaLabel}
    />
  );
}

type CalendarDateTimeFieldProps = {
  id?: string;
  value: string;
  onChange: (dateTimeLocal: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function CalendarDateTimeField({
  id,
  value,
  onChange,
  required,
  disabled,
  className,
}: CalendarDateTimeFieldProps) {
  const generatedId = useId();
  const { date, time } = splitDateTimeLocal(value);
  const dateId = id ? `${id}-date` : `${generatedId}-date`;
  const timeId = id ? `${id}-time` : `${generatedId}-time`;

  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-1', className)}>
      <CalendarDateField
        id={dateId}
        value={date}
        onChange={(nextDate) => onChange(joinDateTimeLocal(nextDate, time))}
        required={required}
        disabled={disabled}
      />
      <Input
        id={timeId}
        type="time"
        value={time}
        onChange={(event) => onChange(joinDateTimeLocal(date, event.target.value))}
        required={required}
        disabled={disabled}
        className="w-34"
      />
    </div>
  );
}

export function splitDateTimeLocal(value: string) {
  if (!value) return { date: '', time: '' };
  const [date = '', timePart = ''] = value.split('T');
  return { date, time: timePart.slice(0, 5) };
}

export function joinDateTimeLocal(date: string, time: string) {
  if (!date) return '';
  return `${date}T${time || '00:00'}`;
}
