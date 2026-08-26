'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

type AnnualLeaveApprovalDialogProps = {
  request: LeaveRequest | null;
  open: boolean;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (request: LeaveRequest, approvedDates: Array<{ date: string; dayValue: string }>) => Promise<void>;
};

const dayOptions = ['1.00', '0.50', '0.00'] as const;

export function AnnualLeaveApprovalDialog({
  request,
  open,
  isSaving,
  onOpenChange,
  onApprove,
}: AnnualLeaveApprovalDialogProps) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const [valuesByDate, setValuesByDate] = useState<Record<string, string>>({});

  const annualDates = request?.annualLeaveDates ?? [];

  useEffect(() => {
    if (!request || !open) return;
    setValuesByDate(Object.fromEntries(
      (request.annualLeaveDates ?? []).map((date) => [date.date, normalizeDayValue(date.requestedDayValue)]),
    ));
  }, [open, request]);

  const approvedTotal = useMemo(() => (
    annualDates.reduce((sum, date) => sum + Number(valuesByDate[date.date] ?? date.requestedDayValue ?? 0), 0)
  ), [annualDates, valuesByDate]);

  const submitApproval = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!request) return;

    await onApprove(
      request,
      annualDates
        .map((date) => ({ date: date.date, dayValue: normalizeDayValue(valuesByDate[date.date] ?? date.requestedDayValue) }))
        .filter((date) => Number(date.dayValue) > 0),
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('approveAnnualLeave')}</DialogTitle>
          <DialogDescription>{t('approveAnnualLeaveDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submitApproval}>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('requestedDays')}</TableHead>
                  <TableHead>{t('approvedDays')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {annualDates.map((date) => (
                  <TableRow key={date.id}>
                    <TableCell>{formatDate(date.date)}</TableCell>
                    <TableCell>{date.requestedDayValue}</TableCell>
                    <TableCell>
                      <Label className="sr-only" htmlFor={`approved-day-${date.id}`}>{t('approvedDays')}</Label>
                      <Select
                        value={normalizeDayValue(valuesByDate[date.date] ?? date.requestedDayValue)}
                        onValueChange={(value) => setValuesByDate((current) => ({ ...current, [date.date]: value }))}
                      >
                        <SelectTrigger id={`approved-day-${date.id}`} className="h-9 w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {dayOptions.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('approvedDays')}: <span className="font-medium text-foreground">{approvedTotal.toFixed(2)}</span>
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{common('cancel')}</Button>
            <Button type="submit" disabled={isSaving || approvedTotal <= 0}>
              <Check className="size-4" />
              {isSaving ? t('saving') : t('approve')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function normalizeDayValue(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  if (numeric === 0.5) return '0.50';
  if (numeric === 1) return '1.00';
  return '0.00';
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}
