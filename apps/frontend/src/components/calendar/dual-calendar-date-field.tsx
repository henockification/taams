'use client';

import { useTranslations } from 'next-intl';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { clampDateValue, EthiopianDateField } from '@/components/calendar/ethiopian-date-field';
import { cn } from '@/lib/utils';

type DualCalendarDateFieldProps = {
  id: string;
  value: string;
  onChange: (gregorianDate: string) => void;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  className?: string;
};

export function DualCalendarDateField({
  id,
  value,
  onChange,
  required,
  disabled,
  min,
  max,
  className,
}: DualCalendarDateFieldProps) {
  const t = useTranslations('calendar');
  const emitChange = (nextValue: string) => {
    onChange(clampDateValue(nextValue, min, max));
  };

  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', className)}>
      <div className="space-y-1.5">
        <Label htmlFor={id} className="text-xs text-muted-foreground">{t('gregorianShort')}</Label>
        <Input
          id={id}
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(event) => emitChange(event.target.value)}
          required={required}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-ethiopian`} className="text-xs text-muted-foreground">{t('ethiopianShort')}</Label>
        <EthiopianDateField
          id={`${id}-ethiopian`}
          value={value}
          onChange={emitChange}
          disabled={disabled}
          min={min}
          max={max}
        />
      </div>
    </div>
  );
}
