'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DualCalendarDateField } from '@/components/calendar/dual-calendar-date-field';
import { isoDateRange, parseAllowedDays, toLeaveCalendar } from '@/components/leave/leave-working-days';
import {
  useCreateDirectLeave,
  useLeaveBalances,
  useLeaveFiscalYears,
  useLeaveTypes,
  useLeaveWorkingCalendar,
} from '@/data/hooks/core.hooks';
import type { Employee } from '@/data/types/core.types';
import { formatEmployeeName } from '@/lib/employee-name';
import { notifications } from '@/lib/notifications';

const noneValue = '__none';

type Props = {
  employee: Employee | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * HR (with the supervisor role) puts an employee on leave directly, e.g. staff on field
 * duty who cannot reach TAAMS. The leave is stored as already authorized.
 */
export function DirectLeaveDialog({ employee, open, onOpenChange }: Props) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const locale = useLocale();
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState('');
  const createDirectLeave = useCreateDirectLeave();

  useEffect(() => {
    if (!open) return;
    setLeaveTypeId('');
    setStartDate(today());
    setEndDate(today());
    setReason('');
  }, [open, employee?.id]);

  const isContract = employee?.employmentType === 'CONTRACT';
  const leaveTypesQuery = useLeaveTypes(open);
  const leaveTypes = useMemo(() => (leaveTypesQuery.data?.leaveTypes ?? []).filter((type) => (
    type.isActive && (isContract || type.code.trim().toUpperCase() !== 'ANNUAL')
  )), [isContract, leaveTypesQuery.data?.leaveTypes]);
  const selectedType = leaveTypes.find((type) => type.id === leaveTypeId) ?? null;
  const isAnnual = selectedType?.code.trim().toUpperCase() === 'ANNUAL';
  const allowedDays = isAnnual ? null : parseAllowedDays(selectedType?.allowedDays);

  const calendarQuery = useLeaveWorkingCalendar(employee?.id ?? '', startDate, endDate, { enabled: open });
  const calendar = useMemo(() => toLeaveCalendar(calendarQuery.data?.days), [calendarQuery.data?.days]);
  const rangeDates = isoDateRange(startDate, endDate);
  const scheduleReady = calendar.size === 0 || rangeDates.every((date) => calendar.get(date)?.status !== 'NO_SCHEDULE');
  // Attendance records a full day of leave on working days and a half day on half-day
  // holidays (the holiday covers the other half). Rest days and full holidays are not leave.
  const fullDays = rangeDates.filter((date) => calendar.get(date)?.status === 'WORKING').length;
  const halfDays = rangeDates.filter((date) => calendar.get(date)?.status === 'HALF_DAY_HOLIDAY').length;
  // Leave is counted against the type's limit or balance as the server does: annual leave
  // includes half days, other leave counts whole working days only.
  const workingDays = isAnnual ? fullDays + halfDays * 0.5 : fullDays;

  const fiscalYearsQuery = useLeaveFiscalYears();
  const activeFiscalYear = (fiscalYearsQuery.data?.leaveFiscalYears ?? []).find((fiscalYear) => fiscalYear.isActive);
  const balancesQuery = useLeaveBalances(activeFiscalYear?.id, {
    enabled: Boolean(open && isAnnual && activeFiscalYear?.id),
    view: 'authorizations',
  });
  const balance = (balancesQuery.data?.leaveBalances ?? []).find((item) => item.employeeId === employee?.id) ?? null;

  const exceedsAllowed = allowedDays !== null && workingDays > allowedDays;
  const exceedsBalance = isAnnual && (!balance || workingDays > Number(balance.available));
  const isValid = Boolean(employee && selectedType && startDate && endDate)
    && startDate <= endDate
    && endDate >= today()
    && scheduleReady
    && workingDays > 0
    && !exceedsAllowed
    && !exceedsBalance;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employee || !isValid) return;
    try {
      await createDirectLeave.mutateAsync({
        employeeId: employee.id,
        leaveTypeId,
        startDate,
        endDate,
        reason: reason.trim() || null,
      });
      onOpenChange(false);
      notifications.show({
        title: common('success'),
        message: t('directLeaveRecorded', { name: formatEmployeeName(employee, locale), date: endDate }),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('directLeaveFailed'),
        color: 'red',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('markOnLeave')}</DialogTitle>
          <DialogDescription>
            {employee ? `${formatEmployeeName(employee, locale)} · ` : ''}{t('directLeaveDescription')}
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <Field label={t('leaveType')} id="direct-leave-type">
            <Select value={leaveTypeId || noneValue} onValueChange={(value) => setLeaveTypeId(value === noneValue ? '' : value)}>
              <SelectTrigger id="direct-leave-type"><SelectValue placeholder={t('selectLeaveType')} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={noneValue}>{t('selectLeaveType')}</SelectItem>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{locale === 'am' && type.nameAm ? type.nameAm : type.nameEn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allowedDays !== null ? (
              <p className="text-xs text-muted-foreground">{t('otherLeaveAllowedDaysHint', { count: allowedDays })}</p>
            ) : null}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('startDate')} id="direct-leave-start">
              <DualCalendarDateField
                id="direct-leave-start"
                value={startDate}
                onChange={(value) => {
                  setStartDate(value);
                  if (endDate < value) setEndDate(value);
                }}
                required
              />
            </Field>
            <Field label={t('leaveUntil')} id="direct-leave-end">
              <DualCalendarDateField
                id="direct-leave-end"
                value={endDate}
                min={startDate > today() ? startDate : today()}
                onChange={setEndDate}
                required
              />
            </Field>
          </div>
          <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
            <p>{t('directLeaveDayBreakdown', { full: fullDays, half: halfDays })}</p>
            {isAnnual ? (
              <p className="mt-1 text-xs">
                {t('availableBalance')}: {balancesQuery.isLoading ? '…' : balance?.available ?? '0.00'}
              </p>
            ) : null}
            {!scheduleReady ? (
              <p className="mt-1 text-xs text-destructive">{t('directLeaveScheduleRequired')}</p>
            ) : calendar.size > 0 && fullDays + halfDays <= 0 ? (
              <p className="mt-1 text-xs text-destructive">{t('otherLeaveNoWorkingDays')}</p>
            ) : exceedsAllowed ? (
              <p className="mt-1 text-xs text-destructive">{t('otherLeaveAllowedDaysHint', { count: allowedDays ?? 0 })}</p>
            ) : isAnnual && exceedsBalance && !balancesQuery.isLoading ? (
              <p className="mt-1 text-xs text-destructive">{t('directLeaveInsufficientBalance')}</p>
            ) : null}
          </div>
          <Field label={t('reason')} id="direct-leave-reason">
            <Textarea
              id="direct-leave-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={t('directLeaveReasonPlaceholder')}
              maxLength={1000}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{common('cancel')}</Button>
            <Button type="submit" disabled={!isValid || createDirectLeave.isPending}>{t('markOnLeave')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
