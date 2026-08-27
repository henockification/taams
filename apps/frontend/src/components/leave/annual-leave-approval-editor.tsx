'use client';

import { FormEvent, type ReactNode, useEffect, useMemo, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { useEmployeeWorkSchedules, useWorkScheduleDays } from '@/data/hooks/core.hooks';
import type { LeaveRequest } from '@/data/types/core.types';

type AnnualLeaveApprovalEditorProps = {
  request: LeaveRequest;
  isSaving: boolean;
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

export function AnnualLeaveApprovalEditor({ request, isSaving, onApprove }: AnnualLeaveApprovalEditorProps) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const [approvalDates, setApprovalDates] = useState<ApprovalDateSelection[]>([]);
  const [specificDate, setSpecificDate] = useState(today());
  const [range, setRange] = useState({ startDate: today(), endDate: today() });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const annualDates = request.annualLeaveDates ?? [];
  const employeeSchedulesQuery = useEmployeeWorkSchedules(request.employeeId);
  const activeScheduleAssignment = employeeSchedulesQuery.data?.employeeWorkSchedules.find((assignment) => assignment.isActive) ?? null;
  const workScheduleDaysQuery = useWorkScheduleDays(activeScheduleAssignment?.workScheduleId ?? '');
  const scheduledWorkingDays = useMemo(() => new Set(
    (workScheduleDaysQuery.data?.days ?? []).filter((day) => day.isActive && !day.isOffDay).map((day) => day.dayOfWeek),
  ), [workScheduleDaysQuery.data?.days]);
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

  const addApprovalDate = (date: string, dayValue = '1.00') => {
    if (!date) return;
    setApprovalDates((current) => {
      if (current.some((item) => item.date === date)) return current;
      return [...current, { date, dayValue }].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  const addApprovalRange = () => {
    for (const date of workingDateRange(range.startDate, range.endDate, scheduledWorkingDays)) {
      addApprovalDate(date);
    }
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
        <p className="text-sm text-muted-foreground">{t('approveAnnualLeavePatternGuide')}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={openConfirmation}>
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <Field label={t('startDate')} id="approval-range-start">
              <Input id="approval-range-start" type="date" value={range.startDate} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} />
            </Field>
            <Field label={t('endDate')} id="approval-range-end">
              <Input id="approval-range-end" type="date" value={range.endDate} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} />
            </Field>
            <Button type="button" className="self-end" variant="outline" onClick={addApprovalRange} disabled={workScheduleDaysQuery.isLoading}>
              <Plus className="size-4" />
              {t('addWorkingDays')}
            </Button>
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
            <Field label={t('specificDate')} id="approval-specific-date">
              <Input id="approval-specific-date" type="date" value={specificDate} onChange={(event) => setSpecificDate(event.target.value)} />
            </Field>
            <Button type="button" className="self-end" variant="outline" onClick={() => addApprovalDate(specificDate)}>
              <Plus className="size-4" />
              {t('addDate')}
            </Button>
            <Button type="button" className="self-end" variant="outline" onClick={resetToRequested}>
              {t('approveAsRequested')}
            </Button>
          </div>
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
              {isSaving ? t('saving') : t('approve')}
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
              {isSaving ? t('saving') : t('approve')}
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

function workingDateRange(startDate: string, endDate: string, workingDays: Set<string>) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    const day = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'][current.getUTCDay()];
    if (workingDays.has(day)) dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
