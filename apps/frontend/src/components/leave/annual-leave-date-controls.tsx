'use client';

import { type ReactNode, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DualCalendarDateField } from '@/components/calendar/dual-calendar-date-field';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

type DateRange = {
  startDate: string;
  endDate: string;
};

type AnnualLeaveDateControlsProps = {
  idPrefix: string;
  range: DateRange;
  onRangeChange: (range: DateRange) => void;
  specificDate: string;
  onSpecificDateChange: (date: string) => void;
  onAddWorkingDays: () => void;
  onAddDate: () => void;
  addWorkingDaysDisabled?: boolean;
  actions?: ReactNode;
};

export function AnnualLeaveDateControls({
  idPrefix,
  range,
  onRangeChange,
  specificDate,
  onSpecificDateChange,
  onAddWorkingDays,
  onAddDate,
  addWorkingDaysDisabled,
  actions,
}: AnnualLeaveDateControlsProps) {
  const t = useTranslations('core');
  const [showSpecificDate, setShowSpecificDate] = useState(false);
  const startId = `${idPrefix}-range-start`;
  const endId = `${idPrefix}-range-end`;
  const specificId = `${idPrefix}-specific-date`;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <Field label={t('startDate')} id={startId}>
          <DualCalendarDateField
            id={startId}
            value={range.startDate}
            onChange={(startDate) => onRangeChange({ ...range, startDate })}
          />
        </Field>
        <Field label={t('endDate')} id={endId}>
          <DualCalendarDateField
            id={endId}
            value={range.endDate}
            onChange={(endDate) => onRangeChange({ ...range, endDate })}
          />
        </Field>
        <div className="flex flex-wrap items-end gap-2">
          <Button type="button" className="w-full lg:w-auto" variant="outline" onClick={onAddWorkingDays} disabled={addWorkingDaysDisabled}>
            <Plus className="size-4" />
            {t('addWorkingDays')}
          </Button>
          {actions}
        </div>
      </div>
      {showSpecificDate ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <Field label={t('specificDate')} id={specificId}>
            <DualCalendarDateField id={specificId} value={specificDate} onChange={onSpecificDateChange} />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Button type="button" className="w-full lg:w-auto" variant="outline" onClick={onAddDate}>
              <Plus className="size-4" />
              {t('addDate')}
            </Button>
            <Button type="button" className="w-full lg:w-auto" variant="ghost" onClick={() => setShowSpecificDate(false)}>
              {t('hideSpecificDate')}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="ghost" className="h-auto px-0 text-sm" onClick={() => setShowSpecificDate(true)}>
          {t('addASpecificDate')}
        </Button>
      )}
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
