'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CalendarCheck, Eye, Pencil, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
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
import { Textarea } from '@/components/ui/textarea';
import { LeaveInterruptionDialog } from '@/components/leave/leave-interruption-dialog';
import {
  useCreateLeaveRequest,
  useCreateLeaveInterruption,
  useDashboardSummary,
  useEmployeeWorkSchedules,
  useLeaveBalances,
  useLeaveFiscalYears,
  useLeaveRequests,
  useLeaveTypes,
  useWorkScheduleDays,
} from '@/data/hooks/core.hooks';
import type { Employee, LeaveBalance, LeaveRequest } from '@/data/types/core.types';
import { Link } from '@/i18n';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { DualCalendarDateField } from '@/components/calendar/dual-calendar-date-field';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const noneValue = '__none';
const dayValueOptions = ['1.00', '0.50'] as const;

type LeaveRequestsPageProps = {
  kind: 'annual' | 'other';
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function statusVariant(status: LeaveRequest['status']) {
  if (status === 'AUTHORIZED') return 'default';
  if (status === 'REJECTED' || status === 'AUTHORIZATION_REJECTED') return 'destructive';
  return 'secondary';
}

type AnnualDateSelection = {
  date: string;
  dayValue: string;
};

export function LeaveRequestsPage({ kind }: LeaveRequestsPageProps) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const session = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [interruptionTarget, setInterruptionTarget] = useState<LeaveRequest | null>(null);
  const [annualDates, setAnnualDates] = useState<AnnualDateSelection[]>([]);
  const [annualDateInput, setAnnualDateInput] = useState(today());
  const [annualRange, setAnnualRange] = useState({ startDate: today(), endDate: today() });
  const [requestDateFilters, setRequestDateFilters] = useState({ fromDate: '', toDate: '' });
  const [leaveTypeFilter, setLeaveTypeFilter] = useState(noneValue);
  const [form, setForm] = useState({
    leaveTypeId: '',
    fiscalYearId: '',
    startDate: today(),
    endDate: today(),
    reason: '',
  });

  const requestsQuery = useLeaveRequests(kind, 'self');
  const dashboardQuery = useDashboardSummary(session.data?.user?.id);
  const fiscalYearsQuery = useLeaveFiscalYears();
  const leaveTypesQuery = useLeaveTypes();
  const createRequest = useCreateLeaveRequest(kind);
  const createInterruption = useCreateLeaveInterruption();

  const fiscalYears = fiscalYearsQuery.data?.leaveFiscalYears ?? [];
  const leaveTypes = leaveTypesQuery.data?.leaveTypes ?? [];
  const currentEmployee = dashboardQuery.data?.dashboard.employee ?? null;
  const employeeSchedulesQuery = useEmployeeWorkSchedules(currentEmployee?.id ?? '');
  const activeScheduleAssignment = employeeSchedulesQuery.data?.employeeWorkSchedules.find((assignment) => assignment.isActive) ?? null;
  const workScheduleDaysQuery = useWorkScheduleDays(activeScheduleAssignment?.workScheduleId ?? '');
  const scheduledWorkingDays = useMemo(() => new Set(
    (workScheduleDaysQuery.data?.days ?? []).filter((day) => day.isActive && !day.isOffDay).map((day) => day.dayOfWeek),
  ), [workScheduleDaysQuery.data?.days]);
  const leaveBalancesQuery = useLeaveBalances(undefined, { enabled: Boolean(kind === 'annual' && currentEmployee?.id) });
  const requests = requestsQuery.data?.leaveRequests ?? [];
  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const requestDate = request.createdAt.slice(0, 10);
      if (requestDateFilters.fromDate && requestDate < requestDateFilters.fromDate) return false;
      if (requestDateFilters.toDate && requestDate > requestDateFilters.toDate) return false;
      if (kind === 'other' && leaveTypeFilter !== noneValue && request.leaveTypeId !== leaveTypeFilter) return false;
      return true;
    });
  }, [kind, leaveTypeFilter, requestDateFilters.fromDate, requestDateFilters.toDate, requests]);
  const activeFiscalYear = fiscalYears.find((fiscalYear) => fiscalYear.isActive);
  const annualType = leaveTypes.find((type) => type.code.toUpperCase() === 'ANNUAL');
  const selectableTypes = kind === 'annual'
    ? leaveTypes.filter((type) => type.code.toUpperCase() === 'ANNUAL')
    : leaveTypes.filter((type) => type.code.toUpperCase() !== 'ANNUAL');

  const annualBalances = leaveBalancesQuery.data?.leaveBalances ?? [];
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
  const selectedYearBalance = useMemo(() => {
    if (!currentEmployee?.id) return null;
    return annualBalances.find((balance) => balance.employeeId === currentEmployee.id && balance.fiscalYearId === form.fiscalYearId) ?? null;
  }, [annualBalances, currentEmployee?.id, form.fiscalYearId]);
  const selectedLeaveTypeId = kind === 'annual' ? annualType?.id ?? form.leaveTypeId : form.leaveTypeId;
  const selectedLeaveType = leaveTypes.find((type) => type.id === selectedLeaveTypeId);
  const requiresFiscalYearBalance = selectedLeaveType?.code.trim().toUpperCase() === 'ANNUAL';
  const annualRequestedTotal = useMemo(() => sumAnnualDates(annualDates), [annualDates]);
  const annualBalanceAvailable = Number(selectedYearBalance?.available ?? 0);

  const openDialog = () => {
    const defaultFiscalYearId = kind === 'annual'
      ? eligibleAnnualFiscalYears[0]?.id ?? ''
      : activeFiscalYear?.id ?? '';
    setForm({
      leaveTypeId: kind === 'annual' ? annualType?.id ?? '' : selectableTypes[0]?.id ?? '',
      fiscalYearId: defaultFiscalYearId,
      startDate: today(),
      endDate: today(),
      reason: '',
    });
    setAnnualDates([]);
    setAnnualDateInput(today());
    setAnnualRange({ startDate: today(), endDate: today() });
    setDialogOpen(true);
  };

  const saveRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentEmployee?.id) {
      notifications.show({ title: common('error'), message: t('currentEmployeeRequired'), color: 'red' });
      return;
    }

    try {
      const sortedAnnualDates = [...annualDates].sort((a, b) => a.date.localeCompare(b.date));
      await createRequest.mutateAsync({
        employeeId: currentEmployee.id,
        leaveTypeId: kind === 'annual' ? annualType?.id ?? form.leaveTypeId : form.leaveTypeId,
        fiscalYearId: kind === 'annual' ? form.fiscalYearId || null : activeFiscalYear?.id ?? null,
        startDate: kind === 'annual' ? sortedAnnualDates[0]?.date : form.startDate,
        endDate: kind === 'annual' ? sortedAnnualDates[sortedAnnualDates.length - 1]?.date : form.endDate,
        annualLeaveDates: kind === 'annual'
          ? sortedAnnualDates.map((date) => ({ date: date.date, dayValue: date.dayValue }))
          : undefined,
        reason: form.reason.trim(),
        requestedBy: session.data?.user?.id ?? null,
      });

      setDialogOpen(false);
      setAnnualDates([]);
      notifications.show({ title: common('success'), message: t('leaveRequestCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

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

  const updateAnnualDateValue = (date: string, dayValue: string) => {
    setAnnualDates((current) => current.map((item) => item.date === date ? { ...item, dayValue } : item));
  };

  const removeAnnualDate = (date: string) => {
    setAnnualDates((current) => current.filter((item) => item.date !== date));
  };

  const submitInterruption = async (payload: {
    interruptedDates: AnnualDateSelection[];
    continuationDates: AnnualDateSelection[];
    reason: string;
    recallAuthority: string;
  }) => {
    if (!interruptionTarget) return;
    try {
      await createInterruption.mutateAsync({
        leaveRequestId: interruptionTarget.id,
        ...payload,
        requestedBy: session.data?.user?.id ?? null,
      });
      setInterruptionTarget(null);
      notifications.show({ title: common('success'), message: t('leaveInterruptionCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const isLoading = session.isPending || (session.data?.user?.id ? dashboardQuery.isLoading : false);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-2">
          <Field label={t('requestDateFrom')} id="leave-request-date-from">
            <Input
              id="leave-request-date-from"
              type="date"
              value={requestDateFilters.fromDate}
              onChange={(event) => setRequestDateFilters((current) => ({ ...current, fromDate: event.target.value }))}
              className="w-full md:w-40"
            />
          </Field>
          <Field label={t('requestDateTo')} id="leave-request-date-to">
            <Input
              id="leave-request-date-to"
              type="date"
              value={requestDateFilters.toDate}
              onChange={(event) => setRequestDateFilters((current) => ({ ...current, toDate: event.target.value }))}
              className="w-full md:w-40"
            />
          </Field>
          {kind === 'other' ? (
            <Field label={t('leaveType')} id="leave-type-filter">
              <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
                <SelectTrigger id="leave-type-filter" className="w-full md:w-48">
                  <SelectValue placeholder={t('allLeaveTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('allLeaveTypes')}</SelectItem>
                  {selectableTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setRequestDateFilters({ fromDate: '', toDate: '' });
              setLeaveTypeFilter(noneValue);
            }}
            disabled={!requestDateFilters.fromDate && !requestDateFilters.toDate && leaveTypeFilter === noneValue}
          >
            <X className="size-4" />
            {t('clearFilters')}
          </Button>
        </div>
        {kind === 'annual' ? (
          isLoading || !currentEmployee ? (
            <Button disabled className="w-full lg:w-auto">
              <Plus className="size-4" />
              {t('requestLeave')}
            </Button>
          ) : (
            <Button asChild className="w-full lg:w-auto">
              <Link href="/annual-leave-requests/new">
                <Plus className="size-4" />
                {t('requestLeave')}
              </Link>
            </Button>
          )
        ) : (
          <Button onClick={openDialog} disabled={isLoading || !currentEmployee} className="w-full lg:w-auto">
            <Plus className="size-4" />
            {t('requestLeave')}
          </Button>
        )}
      </div>

      <Card className="rounded-lg">
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : !currentEmployee ? (
            <EmptyState
              icon={CalendarCheck}
              title={t('employeeProfileRequired')}
              description={t('currentEmployeeRequired')}
            />
          ) : requests.length === 0 ? (
            <EmptyState icon={CalendarCheck} title={t('noLeaveRequests')} description={t('noLeaveRequestsDescription')} />
          ) : filteredRequests.length === 0 ? (
            <EmptyState icon={CalendarCheck} title={t('noLeaveRequests')} description={t('noLeaveRequestsForFilters')} />
          ) : (
                <div className="overflow-hidden rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('requestDate')}</TableHead>
                        <TableHead>{t('employee')}</TableHead>
                        <TableHead>{t('leaveType')}</TableHead>
                        <TableHead>{t('startDate')}</TableHead>
                        <TableHead>{t('endDate')}</TableHead>
                        <TableHead>{t('requestedDays')}</TableHead>
                        <TableHead>{t('status')}</TableHead>
                        <TableHead className="text-right">{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRequests.map((request) => {
                        const isOwnRequest = request.requestedBy === session.data?.user?.id && request.employee?.userId === session.data?.user?.id;
                        const canRequestInterruption = request.status === 'AUTHORIZED'
                          && isAnnualRequest(request)
                          && isOwnRequest
                          && Boolean(request.annualLeaveDates?.some((date) => (
                            date.status === 'APPROVED'
                            && ['SCHEDULED', 'CONSUMED'].includes(date.utilizationStatus)
                          )))
                          && !request.interruptions?.some((interruption) => ['PENDING', 'APPROVED'].includes(interruption.status));

                        return (
                          <TableRow key={request.id}>
                            <TableCell>{formatDate(request.createdAt)}</TableCell>
                            <TableCell>
                              <div className="min-w-0">
                                <p className="truncate font-medium">{employeeName(request.employee) || t('unknown')}</p>
                                <p className="truncate text-xs text-muted-foreground">{request.employee?.employeeCode ?? '-'}</p>
                              </div>
                            </TableCell>
                            <TableCell>{request.leaveType?.nameEn ?? '-'}</TableCell>
                            <TableCell>{formatDate(request.startDate)}</TableCell>
                            <TableCell>{formatDate(request.endDate)}</TableCell>
                            <TableCell>
                              <div>
                                <p>{request.requestedDays}</p>
                                {['APPROVED', 'AUTHORIZED', 'AUTHORIZATION_REJECTED'].includes(request.status) ? (
                                  <div className="text-xs text-muted-foreground">
                                    <p>{t('approvedDays')}: {request.approvedDays}{request.isPartialApproval ? ` · ${t('partialApproval')}` : ''}</p>
                                    {isAnnualRequest(request) ? <p>{t('consumedDays')}: {request.consumedDays} · {t('remainingDays')}: {request.remainingDays}</p> : null}
                                    {request.interruptions?.[0] ? <p>{t('interruption')}: {request.interruptions[0].status}</p> : null}
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell><Badge variant={statusVariant(request.status) as any}>{leaveStatusLabel(request.status, t)}</Badge></TableCell>
                            <TableCell>
                              {kind === 'annual' ? (
                                <div className="flex justify-end gap-2">
                                  <Button type="button" size="sm" variant="outline" asChild>
                                    <Link href={`/annual-leave-requests/${request.id}` as any}>
                                      <Eye className="size-4" />
                                      {t('viewDetails')}
                                    </Link>
                                  </Button>
                                  {request.status === 'PENDING' && isOwnRequest ? (
                                    <Button type="button" size="sm" variant="outline" asChild>
                                      <Link href={`/annual-leave-requests/${request.id}/edit` as any}>
                                        <Pencil className="size-4" />
                                        {common('edit')}
                                      </Link>
                                    </Button>
                                  ) : null}
                                  {canRequestInterruption ? (
                                    <Button type="button" size="sm" variant="outline" onClick={() => setInterruptionTarget(request)}>
                                      {t('requestLeaveInterruption')}
                                    </Button>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="block text-right text-xs text-muted-foreground">
                                  {request.status === 'AUTHORIZED' ? formatDate(request.authorizedAt) : request.status === 'APPROVED' ? t('awaitingHrAuthorization') : request.status === 'AUTHORIZATION_REJECTED' ? formatDate(request.authorizationRejectedAt) : request.status === 'REJECTED' ? formatDate(request.rejectedAt) : '-'}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('requestLeave')}</DialogTitle>
            <DialogDescription>{t('leaveRequestFormDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveRequest}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('leaveType')} id="leave-type">
                <Select
                  value={(kind === 'annual' ? annualType?.id : form.leaveTypeId) || noneValue}
                  onValueChange={(value) => setForm((current) => ({ ...current, leaveTypeId: value === noneValue ? '' : value }))}
                  disabled={kind === 'annual'}
                >
                  <SelectTrigger id="leave-type"><SelectValue placeholder={t('selectLeaveType')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noneValue}>{t('selectLeaveType')}</SelectItem>
                    {selectableTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {kind === 'annual' ? (
                <Field label={t('selectFiscalYear')} id="leave-fiscal-year">
                  <Select value={form.fiscalYearId || noneValue} onValueChange={(value) => setForm((current) => ({ ...current, fiscalYearId: value === noneValue ? '' : value }))}>
                    <SelectTrigger id="leave-fiscal-year"><SelectValue placeholder={t('selectFiscalYear')} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={noneValue}>{t('selectFiscalYear')}</SelectItem>
                      {eligibleAnnualFiscalYears.map((fiscalYear) => (
                        <SelectItem key={fiscalYear.id} value={fiscalYear.id}>{fiscalYear.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {requiresFiscalYearBalance ? (
                    <BalancePreview
                      isLoading={leaveBalancesQuery.isLoading}
                      balance={selectedYearBalance}
                      emptyLabel={form.fiscalYearId ? t('leaveBalanceNotFound') : t('selectFiscalYearToViewBalance')}
                      loadingLabel={common('loading')}
                      availableLabel={t('availableBalance')}
                    />
                  ) : null}
                </Field>
              ) : null}
              {kind !== 'annual' ? (
                <>
                  <Field label={t('startDate')} id="leave-start">
                    <DualCalendarDateField id="leave-start" value={form.startDate} onChange={(startDate) => setForm((current) => ({ ...current, startDate }))} required />
                  </Field>
                  <Field label={t('endDate')} id="leave-end">
                    <DualCalendarDateField id="leave-end" value={form.endDate} onChange={(endDate) => setForm((current) => ({ ...current, endDate }))} required />
                  </Field>
                </>
              ) : null}
            </div>
            {kind === 'annual' ? (
              <div className="space-y-3 rounded-md border border-border p-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <Field label={t('startDate')} id="annual-range-start">
                    <DualCalendarDateField id="annual-range-start" value={annualRange.startDate} onChange={(startDate) => setAnnualRange((current) => ({ ...current, startDate }))} />
                  </Field>
                  <Field label={t('endDate')} id="annual-range-end">
                    <DualCalendarDateField id="annual-range-end" value={annualRange.endDate} onChange={(endDate) => setAnnualRange((current) => ({ ...current, endDate }))} />
                  </Field>
                  <Button type="button" className="self-end" variant="outline" onClick={addAnnualRange}>
                    <Plus className="size-4" />
                    {t('addWorkingDays')}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <Field label={t('date')} id="annual-date">
                    <DualCalendarDateField id="annual-date" value={annualDateInput} onChange={setAnnualDateInput} />
                  </Field>
                  <Button type="button" className="self-end" variant="outline" onClick={() => addAnnualDate(annualDateInput)}>
                    <Plus className="size-4" />
                    {t('addDate')}
                  </Button>
                </div>
                <div className="overflow-hidden rounded-md border border-border">
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
                            <Select value={date.dayValue} onValueChange={(value) => updateAnnualDateValue(date.date, value)}>
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
                            <Button type="button" variant="ghost" size="sm" onClick={() => removeAnnualDate(date.date)}>
                              <X className="size-4" />
                              {t('remove')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('requestedDays')}: <span className="font-medium text-foreground">{annualRequestedTotal.toFixed(2)}</span>
                </p>
              </div>
            ) : null}
            <Field label={t('reason')} id="leave-reason">
              <Textarea id="leave-reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button
                type="submit"
                disabled={
                  createRequest.isPending
                  || !currentEmployee?.id
                  || !selectedLeaveTypeId
                  || (requiresFiscalYearBalance && (!form.fiscalYearId || !selectedYearBalance))
                  || (kind === 'annual' ? annualDates.length === 0 || annualRequestedTotal > annualBalanceAvailable : (!form.startDate || !form.endDate))
                  || !form.reason.trim()
                }
              >
                {createRequest.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <LeaveInterruptionDialog
        request={interruptionTarget}
        open={Boolean(interruptionTarget)}
        isSaving={createInterruption.isPending}
        onOpenChange={(open) => !open && setInterruptionTarget(null)}
        onSubmit={submitInterruption}
      />

    </div>
  );
}

function leaveStatusLabel(status: LeaveRequest['status'], t: (key: any) => string) {
  if (status === 'APPROVED') return t('awaitingHrAuthorization');
  if (status === 'AUTHORIZED') return t('authorized');
  if (status === 'AUTHORIZATION_REJECTED') return t('rejectedByHr');
  if (status === 'REJECTED') return t('rejected');
  return t('pendingRequests');
}

function BalancePreview({
  isLoading,
  balance,
  emptyLabel,
  loadingLabel,
  availableLabel,
}: {
  isLoading: boolean;
  balance: Pick<LeaveBalance, 'available'> | null;
  emptyLabel: string;
  loadingLabel: string;
  availableLabel: string;
}) {
  if (isLoading) {
    return <p className="text-xs text-muted-foreground">{loadingLabel}</p>;
  }

  if (!balance) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2 text-xs">
      <BalanceMetric label={availableLabel} value={balance.available} strong />
    </div>
  );
}

function BalanceMetric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={strong ? 'font-semibold text-foreground' : 'font-medium text-foreground'}>{value}</p>
    </div>
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

function isAnnualRequest(request: LeaveRequest) {
  return request.leaveType?.code?.trim().toUpperCase() === 'ANNUAL';
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
