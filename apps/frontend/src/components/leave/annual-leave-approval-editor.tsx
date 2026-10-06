'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AnnualLeaveDateControls } from '@/components/leave/annual-leave-date-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LeaveRequest } from '@/data/types/core.types';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';
import { mergeAnnualDates } from '@/components/leave/leave-working-days';
import { useAnnualLeaveDateAdder } from '@/components/leave/use-annual-leave-date-adder';

type AnnualLeaveApprovalEditorProps = {
  request: LeaveRequest;
  isSaving: boolean;
  approveLabel?: string;
  onApprove: (request: LeaveRequest, approvedDates: Array<{ date: string; dayValue: string }>) => Promise<void>;
};

type ApprovalDateSelection = {
  date: string;
  dayValue: string;
};

const approvalDayOptions = ['1.00', '0.50'] as const;

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AnnualLeaveApprovalEditor({ request, isSaving, approveLabel, onApprove }: AnnualLeaveApprovalEditorProps) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const [approvalDates, setApprovalDates] = useState<ApprovalDateSelection[]>([]);
  const [specificDate, setSpecificDate] = useState(today());
  const [range, setRange] = useState({ startDate: today(), endDate: today() });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const annualDates = request.annualLeaveDates ?? [];
  const dateAdder = useAnnualLeaveDateAdder(request.employeeId, approvalDates, (dates) => (
    setApprovalDates((current) => mergeAnnualDates(current, dates))
  ));
  const requestedByDate = useMemo(() => new Map(
    annualDates.map((date) => [date.date, normalizeDayValue(date.requestedDayValue)]),
  ), [annualDates]);

  useEffect(() => {
    const initialDates = annualDates.map((date) => ({
      date: date.date,
      dayValue: normalizeDayValue(date.requestedDayValue),
    }));
    setApprovalDates(initialDates);
    setSpecificDate(initialDates[0]?.date ?? today());
    setRange({
      startDate: initialDates[0]?.date ?? today(),
      endDate: initialDates[initialDates.length - 1]?.date ?? today(),
    });
  }, [annualDates, request.id]);

  const approvedTotal = useMemo(() => (
    approvalDates.reduce((sum, date) => sum + Number(date.dayValue), 0)
  ), [approvalDates]);

  const approvalPayload = useMemo(() => (
    approvalDates
      .map((date) => ({ date: date.date, dayValue: normalizeDayValue(date.dayValue) }))
      .filter((date) => Number(date.dayValue) > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
  ), [approvalDates]);

  const resetToRequested = () => {
    setApprovalDates(annualDates.map((date) => ({
      date: date.date,
      dayValue: normalizeDayValue(date.requestedDayValue),
    })));
  };

  const openConfirmation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setConfirmOpen(true);
  };

  const confirmApproval = async () => {
    await onApprove(request, approvalPayload);
    setConfirmOpen(false);
  };

  return (
    <Card className="rounded-lg border-primary/30">
      <CardHeader>
        <CardTitle>{t('approveAnnualLeave')}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={openConfirmation}>
          <AnnualLeaveDateControls
            idPrefix="approval"
            range={range}
            onRangeChange={setRange}
            specificDate={specificDate}
            onSpecificDateChange={setSpecificDate}
            onAddWorkingDays={() => dateAdder.addRange(range.startDate, range.endDate)}
            onAddDate={() => dateAdder.addDate(specificDate)}
            addWorkingDaysDisabled={dateAdder.isChecking}
            actions={(
              <Button type="button" className="w-full lg:w-auto" variant="outline" onClick={resetToRequested}>
                {t('approveAsRequested')}
              </Button>
            )}
          />
          <div className="rounded-md border border-border">
            <div className="max-h-[420px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('requestedDays')}</TableHead>
                    <TableHead>{t('approvedDays')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {approvalDates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-sm text-muted-foreground">{t('noAnnualLeaveDates')}</TableCell>
                    </TableRow>
                  ) : approvalDates.map((date) => {
                    const requestedDayValue = requestedByDate.get(date.date) ?? null;
                    return (
                      <TableRow key={date.date}>
                        <TableCell>{formatDate(date.date)}</TableCell>
                        <TableCell>{requestedDayValue ?? '-'}</TableCell>
                        <TableCell>
                          <Label className="sr-only" htmlFor={`approved-day-${date.date}`}>{t('approvedDays')}</Label>
                          <Select
                            value={normalizeDayValue(date.dayValue)}
                            onValueChange={(value) => setApprovalDates((current) => current.map((item) => item.date === date.date ? { ...item, dayValue: value } : item))}
                          >
                            <SelectTrigger id={`approved-day-${date.date}`} className="h-9 w-28">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {approvalDayOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {requestedDayValue ? <Badge variant="outline">{t('requested')}</Badge> : <Badge variant="secondary">{t('supervisorAdded')}</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button type="button" variant="ghost" size="sm" onClick={() => setApprovalDates((current) => current.filter((item) => item.date !== date.date))}>
                            <X className="size-4" />
                            {t('remove')}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {t('approvedDays')}: <span className="font-medium text-foreground">{approvedTotal.toFixed(2)}</span>
            </p>
            <Button type="submit" disabled={isSaving || approvedTotal <= 0}>
              <Check className="size-4" />
              {isSaving ? t('saving') : approveLabel ?? t('approve')}
            </Button>
          </div>
        </form>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('confirmAnnualLeaveApproval')}</DialogTitle>
            <DialogDescription>{t('confirmAnnualLeaveApprovalDescription')}</DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
            <p>{t('approvedDays')}: <span className="font-medium">{approvedTotal.toFixed(2)}</span></p>
            <p>{t('leaveDates')}: <span className="font-medium">{approvalPayload.length}</span></p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>{common('cancel')}</Button>
            <Button type="button" onClick={confirmApproval} disabled={isSaving || approvedTotal <= 0}>
              <Check className="size-4" />
              {isSaving ? t('saving') : approveLabel ?? t('approve')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function normalizeDayValue(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (numeric === 0.5) return '0.50';
  if (numeric === 1) return '1.00';
  return '0.00';
}

