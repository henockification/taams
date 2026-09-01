'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { LeaveInterruption, LeaveRequest } from '@/data/types/core.types';
import { DualCalendarDateField } from '@/components/calendar/dual-calendar-date-field';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type DateSelection = { date: string; dayValue: string };

type Props = {
  request: LeaveRequest | null;
  interruption?: LeaveInterruption | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: {
    interruptedDates: DateSelection[];
    continuationDates: DateSelection[];
    reason: string;
    recallAuthority: string;
  }) => Promise<void>;
};

export function LeaveInterruptionDialog({ request, interruption, open, isSaving, onOpenChange, onSubmit }: Props) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const [interruptedByDate, setInterruptedByDate] = useState<Record<string, string>>({});
  const [continuationDates, setContinuationDates] = useState<DateSelection[]>([]);
  const [continuationDate, setContinuationDate] = useState('');
  const [reason, setReason] = useState('');
  const [recallAuthority, setRecallAuthority] = useState('');

  const eligibleDates = useMemo(() => (request?.annualLeaveDates ?? []).filter((date) => (
    date.status === 'APPROVED' && ['SCHEDULED', 'CONSUMED'].includes(date.utilizationStatus)
  )), [request]);

  useEffect(() => {
    if (!open || !request) return;
    const proposedInterrupted = interruption?.dates.filter((date) => date.kind === 'INTERRUPTED_PROPOSED') ?? [];
    const proposedContinuation = interruption?.dates.filter((date) => date.kind === 'CONTINUATION_PROPOSED') ?? [];
    setInterruptedByDate(Object.fromEntries(proposedInterrupted.map((date) => [date.date, normalizeDayValue(date.dayValue)])));
    setContinuationDates(proposedContinuation.map((date) => ({ date: date.date, dayValue: normalizeDayValue(date.dayValue) })));
    setContinuationDate('');
    setReason(interruption?.reason ?? '');
    setRecallAuthority(interruption?.recallAuthority ?? '');
  }, [interruption, open, request]);

  const interruptedDates = eligibleDates
    .map((date) => ({ date: date.date, dayValue: interruptedByDate[date.date] ?? '0.00' }))
    .filter((date) => Number(date.dayValue) > 0);
  const interruptedTotal = sumDates(interruptedDates);
  const continuationTotal = sumDates(continuationDates);

  const addContinuationDate = () => {
    if (!continuationDate || continuationDates.some((date) => date.date === continuationDate)) return;
    const remaining = interruptedTotal - continuationTotal;
    const dayValue = remaining === 0.5 ? '0.50' : '1.00';
    setContinuationDates((current) => [...current, { date: continuationDate, dayValue }].sort((a, b) => a.date.localeCompare(b.date)));
    setContinuationDate('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({ interruptedDates, continuationDates, reason: reason.trim(), recallAuthority: recallAuthority.trim() });
  };

  const isValid = interruptedTotal > 0
    && interruptedTotal === continuationTotal
    && Boolean(reason.trim())
    && Boolean(recallAuthority.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{interruption ? t('reviewLeaveInterruption') : t('requestLeaveInterruption')}</DialogTitle>
          <DialogDescription>{t('leaveInterruptionDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('recallAuthority')} id="recall-authority">
              <Input id="recall-authority" value={recallAuthority} onChange={(event) => setRecallAuthority(event.target.value)} disabled={Boolean(interruption)} required />
            </Field>
            <Field label={t('interruptionReason')} id="interruption-reason">
              <Textarea id="interruption-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={Boolean(interruption)} required />
            </Field>
          </div>

          <div className="space-y-2">
            <Label>{t('actualWorkingPeriod')}</Label>
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead>{t('approvedDays')}</TableHead><TableHead>{t('interrupt')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {eligibleDates.map((date) => {
                    const approvedValue = normalizeDayValue(date.approvedDayValue);
                    return (
                      <TableRow key={date.id}>
                        <TableCell>{formatDate(date.date)}</TableCell>
                        <TableCell>{approvedValue}</TableCell>
                        <TableCell>
                          <Select value={interruptedByDate[date.date] ?? '0.00'} onValueChange={(value) => setInterruptedByDate((current) => ({ ...current, [date.date]: value }))}>
                            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="0.00">0.00</SelectItem><SelectItem value={approvedValue}>{approvedValue}</SelectItem></SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="continuation-date">{t('continuationPattern')}</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <DualCalendarDateField id="continuation-date" value={continuationDate} onChange={setContinuationDate} className="flex-1" />
              <Button type="button" variant="outline" onClick={addContinuationDate}><Plus className="size-4" />{t('addDate')}</Button>
            </div>
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader><TableRow><TableHead>{t('date')}</TableHead><TableHead>{t('approvedDays')}</TableHead><TableHead className="text-right">{t('actions')}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {continuationDates.map((date) => (
                    <TableRow key={date.date}>
                      <TableCell>{formatDate(date.date)}</TableCell>
                      <TableCell>
                        <Select value={date.dayValue} onValueChange={(value) => setContinuationDates((current) => current.map((item) => item.date === date.date ? { ...item, dayValue: value } : item))}>
                          <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="1.00">1.00</SelectItem><SelectItem value="0.50">0.50</SelectItem></SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right"><Button type="button" variant="ghost" size="sm" onClick={() => setContinuationDates((current) => current.filter((item) => item.date !== date.date))}><X className="size-4" />{t('remove')}</Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {t('interruptedDays')}: {interruptedTotal.toFixed(2)} · {t('continuationDays')}: {continuationTotal.toFixed(2)}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{common('cancel')}</Button>
            <Button type="submit" disabled={isSaving || !isValid}><RotateCcw className="size-4" />{isSaving ? t('saving') : interruption ? t('approveAmendment') : common('save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}</div>;
}

function normalizeDayValue(value: string | number | null | undefined) {
  return Number(value) === 0.5 ? '0.50' : Number(value) === 1 ? '1.00' : '0.00';
}

function sumDates(dates: DateSelection[]) {
  return dates.reduce((sum, date) => sum + Number(date.dayValue), 0);
}
