'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarCheck, Save, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AnnualLeaveDateControls } from '@/components/leave/annual-leave-date-controls';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Link, useRouter } from '@/i18n';
import {
  useCreateLeaveRequest,
  useDashboardSummary,
  useEmployeeWorkSchedules,
  useLeaveBalances,
  useLeaveFiscalYears,
  useLeaveRequests,
  useLeaveTypes,
  useUpdateLeaveRequest,
  useWorkScheduleDays,
} from '@/data/hooks/core.hooks';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const noneValue = '__none';
const dayValueOptions = ['1.00', '0.50'] as const;

type AnnualDateSelection = {
  date: string;
  dayValue: string;
};

type AnnualLeaveRequestFormPageProps = {
  mode: 'create' | 'edit';
  requestId?: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AnnualLeaveRequestFormPage({ mode, requestId }: AnnualLeaveRequestFormPageProps) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const router = useRouter();
  const session = useSession();
  const requestsQuery = useLeaveRequests('annual', 'self');
  const dashboardQuery = useDashboardSummary(session.data?.user?.id);
  const fiscalYearsQuery = useLeaveFiscalYears();
  const leaveTypesQuery = useLeaveTypes();
  const createRequest = useCreateLeaveRequest('annual');
  const updateRequest = useUpdateLeaveRequest('annual');

  const requests = requestsQuery.data?.leaveRequests ?? [];
  const editingRequest = mode === 'edit'
    ? requests.find((request) => request.id === requestId) ?? null
    : null;
  const currentEmployee = dashboardQuery.data?.dashboard.employee ?? editingRequest?.employee ?? null;
  const employeeSchedulesQuery = useEmployeeWorkSchedules(currentEmployee?.id ?? '');
  const activeScheduleAssignment = employeeSchedulesQuery.data?.employeeWorkSchedules.find((assignment) => assignment.isActive) ?? null;
  const workScheduleDaysQuery = useWorkScheduleDays(activeScheduleAssignment?.workScheduleId ?? '');
  const leaveBalancesQuery = useLeaveBalances(undefined, { enabled: Boolean(currentEmployee?.id) });

  const fiscalYears = fiscalYearsQuery.data?.leaveFiscalYears ?? [];
  const leaveTypes = leaveTypesQuery.data?.leaveTypes ?? [];
  const annualType = leaveTypes.find((type) => type.code.toUpperCase() === 'ANNUAL');
  const activeFiscalYear = fiscalYears.find((fiscalYear) => fiscalYear.isActive);
  const annualBalances = leaveBalancesQuery.data?.leaveBalances ?? [];
  const scheduledWorkingDays = useMemo(() => new Set(
    (workScheduleDaysQuery.data?.days ?? []).filter((day) => day.isActive && !day.isOffDay).map((day) => day.dayOfWeek),
  ), [workScheduleDaysQuery.data?.days]);

  const initialDates = useMemo(() => {
    if (!editingRequest?.annualLeaveDates?.length) return [];
    return editingRequest.annualLeaveDates.map((date) => ({
      date: formatDateValue(date.date),
      dayValue: Number(date.requestedDayValue).toFixed(2),
    }));
  }, [editingRequest]);

  const [fiscalYearId, setFiscalYearId] = useState('');
  const [reason, setReason] = useState('');
  const [annualDates, setAnnualDates] = useState<AnnualDateSelection[]>([]);
  const [annualDateInput, setAnnualDateInput] = useState(today());
  const [annualRange, setAnnualRange] = useState({ startDate: today(), endDate: today() });
  const [hasInitializedEdit, setHasInitializedEdit] = useState(false);

  const eligibleAnnualFiscalYears = useMemo(() => {
    if (!currentEmployee) return [];
    const balanceByFiscalYear = new Map(annualBalances.map((balance) => [balance.fiscalYearId, balance]));
    if (currentEmployee.employmentType === 'PERMANENT') {
      return fiscalYears.filter((fiscalYear) => {
        const balance = balanceByFiscalYear.get(fiscalYear.id);
        return !fiscalYear.isActive && balance && Number(balance.available) > 0;
      });
    }
    return activeFiscalYear ? [activeFiscalYear] : [];
  }, [activeFiscalYear, annualBalances, currentEmployee, fiscalYears]);

  useEffect(() => {
    if (mode !== 'edit' || !editingRequest || hasInitializedEdit) return;
    setFiscalYearId(editingRequest.fiscalYearId ?? '');
    setReason(editingRequest.reason ?? '');
    setAnnualDates(initialDates);
    setAnnualDateInput(initialDates[0]?.date ?? today());
    setAnnualRange({
      startDate: initialDates[0]?.date ?? today(),
      endDate: initialDates[initialDates.length - 1]?.date ?? today(),
    });
    setHasInitializedEdit(true);
  }, [editingRequest, hasInitializedEdit, initialDates, mode]);

  useEffect(() => {
    if (mode === 'create' && !fiscalYearId && eligibleAnnualFiscalYears[0]?.id) {
      setFiscalYearId(eligibleAnnualFiscalYears[0].id);
    }
  }, [eligibleAnnualFiscalYears, fiscalYearId, mode]);

  const selectedYearBalance = useMemo(() => {
    if (!currentEmployee?.id) return null;
    return annualBalances.find((balance) => balance.employeeId === currentEmployee.id && balance.fiscalYearId === fiscalYearId) ?? null;
  }, [annualBalances, currentEmployee?.id, fiscalYearId]);
  const annualRequestedTotal = useMemo(() => sumAnnualDates(annualDates), [annualDates]);
  const annualBalanceAvailable = Number(selectedYearBalance?.available ?? 0);
  const exceedsBalance = annualRequestedTotal > annualBalanceAvailable;
  const isLoading = session.isPending
    || dashboardQuery.isLoading
    || leaveTypesQuery.isLoading
    || fiscalYearsQuery.isLoading
    || leaveBalancesQuery.isLoading
    || (mode === 'edit' && requestsQuery.isLoading);
  const isEditable = mode === 'create' || editingRequest?.status === 'PENDING';
  const isOwner = !editingRequest
    || (editingRequest.requestedBy === session.data?.user?.id
      && editingRequest.employee?.userId === session.data?.user?.id);

  const addAnnualDate = (date: string, dayValue = '1.00') => {
    if (!date) return;
    setAnnualDates((current) => {
      if (current.some((item) => item.date === date)) return current;
      return [...current, { date, dayValue }].sort((a, b) => a.date.localeCompare(b.date));
    });
  };

  const addAnnualRange = () => {
    for (const date of workingDateRange(annualRange.startDate, annualRange.endDate, scheduledWorkingDays)) {
      addAnnualDate(date);
    }
  };

  const saveRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentEmployee?.id || !annualType?.id) {
      notifications.show({ title: common('error'), message: t('currentEmployeeRequired'), color: 'red' });
      return;
    }

    try {
      const sortedAnnualDates = [...annualDates].sort((a, b) => a.date.localeCompare(b.date));
      const payload = {
        fiscalYearId,
        annualLeaveDates: sortedAnnualDates.map((date) => ({ date: date.date, dayValue: date.dayValue })),
        reason: reason.trim(),
      };

      if (mode === 'edit' && editingRequest) {
        await updateRequest.mutateAsync({
          leaveRequestId: editingRequest.id,
          ...payload,
          updatedBy: session.data?.user?.id ?? null,
        });
        notifications.show({ title: common('success'), message: t('leaveRequestUpdated'), color: 'green' });
        router.push('/annual-leave-requests');
      } else {
        await createRequest.mutateAsync({
          employeeId: currentEmployee.id,
          leaveTypeId: annualType.id,
          ...payload,
          startDate: sortedAnnualDates[0]?.date,
          endDate: sortedAnnualDates[sortedAnnualDates.length - 1]?.date,
          requestedBy: session.data?.user?.id ?? null,
        });
        notifications.show({ title: common('success'), message: t('leaveRequestCreated'), color: 'green' });
        router.push('/annual-leave-requests');
      }
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{common('loading')}</p>;
  }

  if (!currentEmployee) {
    return <EmptyState icon={CalendarCheck} title={t('employeeProfileRequired')} description={t('currentEmployeeRequired')} />;
  }

  if (mode === 'edit' && !editingRequest) {
    return <EmptyState icon={CalendarCheck} title={t('leaveRequestNotFound')} description={t('leaveRequestNotFoundDescription')} />;
  }

  if (!isEditable || !isOwner) {
    return <EmptyState icon={CalendarCheck} title={t('leaveRequestCannotBeEdited')} description={t('leaveRequestCannotBeEditedDescription')} />;
  }

  const balanceHelper = leaveBalancesQuery.isLoading
    ? common('loading')
    : selectedYearBalance
      ? null
      : fiscalYearId ? t('leaveBalanceNotFound') : t('selectFiscalYearToViewBalance');

  return (
    <form className="flex w-full flex-col gap-5" onSubmit={saveRequest}>
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <Button type="button" variant="ghost" asChild className="-ml-3 w-fit">
          <Link href="/annual-leave-requests"><ArrowLeft className="size-4" />{common('back')}</Link>
        </Button>
        <Button
          type="submit"
          className="w-full lg:w-auto"
          disabled={
            createRequest.isPending
            || updateRequest.isPending
            || !fiscalYearId
            || !selectedYearBalance
            || annualDates.length === 0
            || exceedsBalance
            || !reason.trim()
          }
        >
          <Save className="size-4" />
          {createRequest.isPending || updateRequest.isPending ? t('saving') : common('save')}
        </Button>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{t('leaveDates')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full space-y-2 sm:w-56">
              <Label htmlFor="leave-fiscal-year">{t('selectFiscalYear')}</Label>
              <Select value={fiscalYearId || noneValue} onValueChange={(value) => setFiscalYearId(value === noneValue ? '' : value)}>
                <SelectTrigger id="leave-fiscal-year"><SelectValue placeholder={t('selectFiscalYear')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('selectFiscalYear')}</SelectItem>
                  {eligibleAnnualFiscalYears.map((fiscalYear) => (
                    <SelectItem key={fiscalYear.id} value={fiscalYear.id}>{fiscalYear.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className={`pb-2 text-sm ${exceedsBalance ? 'text-destructive' : 'text-muted-foreground'}`}>
              {t('availableBalance')}: <span className="font-semibold text-foreground">{selectedYearBalance?.available ?? '0.00'}</span>
            </p>
            {balanceHelper ? <p className="pb-2 text-xs text-muted-foreground">{balanceHelper}</p> : null}
          </div>

          <AnnualLeaveDateControls
            idPrefix="annual"
            range={annualRange}
            onRangeChange={setAnnualRange}
            specificDate={annualDateInput}
            onSpecificDateChange={setAnnualDateInput}
            onAddWorkingDays={addAnnualRange}
            onAddDate={() => addAnnualDate(annualDateInput)}
            addWorkingDaysDisabled={workScheduleDaysQuery.isLoading}
          />

          <div className="rounded-md border border-border">
            <div className="max-h-[360px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('requestedDays')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {annualDates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-sm text-muted-foreground">{t('noAnnualLeaveDates')}</TableCell>
                    </TableRow>
                  ) : annualDates.map((date) => (
                    <TableRow key={date.date}>
                      <TableCell>{formatDate(date.date)}</TableCell>
                      <TableCell>
                        <Select value={date.dayValue} onValueChange={(value) => setAnnualDates((current) => current.map((item) => item.date === date.date ? { ...item, dayValue: value } : item))}>
                          <SelectTrigger className="h-9 w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {dayValueOptions.map((option) => (
                              <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="ghost" size="sm" onClick={() => setAnnualDates((current) => current.filter((item) => item.date !== date.date))}>
                          <X className="size-4" />
                          {t('remove')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{t('requestedDays')}: {annualRequestedTotal.toFixed(2)}</Badge>
            <Badge variant={exceedsBalance ? 'destructive' : 'outline'}>
              {t('availableBalance')}: {selectedYearBalance?.available ?? '0.00'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{t('reason')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={4} />
        </CardContent>
      </Card>
    </form>
  );
}

function sumAnnualDates(dates: AnnualDateSelection[]) {
  return dates.reduce((sum, date) => sum + Number(date.dayValue), 0);
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

function formatDateValue(value: string | Date) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
