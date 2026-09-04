'use client';

import { useMemo, useState } from 'react';
import { CalendarCheck, Check, Eye, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { CalendarDateField } from '@/components/calendar/calendar-date-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuthorizeLeaveInterruption, useAuthorizeLeaveRequest, useLeaveBalances, useLeaveRequests } from '@/data/hooks/core.hooks';
import type { LeaveBalance, LeaveInterruption, LeaveRequest } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type WorkItem = { kind: 'request'; request: LeaveRequest } | { kind: 'interruption'; request: LeaveRequest; interruption: LeaveInterruption };
type QueueFilter = 'PENDING' | 'AUTHORIZED' | 'REJECTED' | 'ALL';

export function LeaveAuthorizationsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate, formatDateTime } = useCalendarPreference();
  const requestsQuery = useLeaveRequests(undefined, 'authorizations');
  const balancesQuery = useLeaveBalances(undefined, { view: 'authorizations' });
  const authorizeRequest = useAuthorizeLeaveRequest();
  const authorizeInterruption = useAuthorizeLeaveInterruption();
  const [filter, setFilter] = useState<QueueFilter>('PENDING');
  const [search, setSearch] = useState('');
  const [leaveType, setLeaveType] = useState('ALL');
  const [requestDateFilters, setRequestDateFilters] = useState({ fromDate: '', toDate: '' });
  const [target, setTarget] = useState<WorkItem | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const requests = requestsQuery.data?.leaveRequests ?? [];
  const balances = balancesQuery.data?.leaveBalances ?? [];
  const balanceByEmployeeYear = useMemo(() => new Map(balances.map((balance) => [`${balance.employeeId}:${balance.fiscalYearId}`, balance])), [balances]);
  const leaveTypes = useMemo(() => Array.from(new Map(requests.filter((request) => request.leaveType).map((request) => [request.leaveTypeId, request.leaveType!])).values()), [requests]);
  const items = useMemo<WorkItem[]>(() => requests.flatMap((request) => {
    const result: WorkItem[] = [];
    if (['APPROVED', 'AUTHORIZED', 'AUTHORIZATION_REJECTED'].includes(request.status)) result.push({ kind: 'request', request });
    for (const interruption of request.interruptions ?? []) {
      if (['APPROVED', 'AUTHORIZED', 'AUTHORIZATION_REJECTED'].includes(interruption.status)) result.push({ kind: 'interruption', request, interruption });
    }
    return result;
  }), [requests]);
  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      const status = item.kind === 'request' ? item.request.status : item.interruption.status;
      if (filter === 'PENDING' && status !== 'APPROVED') return false;
      if (filter === 'AUTHORIZED' && status !== 'AUTHORIZED') return false;
      if (filter === 'REJECTED' && status !== 'AUTHORIZATION_REJECTED') return false;
      if (leaveType !== 'ALL' && item.request.leaveTypeId !== leaveType) return false;
      const requestDate = item.request.createdAt.slice(0, 10);
      if (requestDateFilters.fromDate && requestDate < requestDateFilters.fromDate) return false;
      if (requestDateFilters.toDate && requestDate > requestDateFilters.toDate) return false;
      if (!needle) return true;
      return `${employeeName(item.request)} ${item.request.employee?.employeeCode ?? ''}`.toLowerCase().includes(needle);
    });
  }, [filter, items, leaveType, requestDateFilters.fromDate, requestDateFilters.toDate, search]);
  const pendingCount = items.filter((item) => (item.kind === 'request' ? item.request.status : item.interruption.status) === 'APPROVED').length;
  const authorizedCount = items.filter((item) => (item.kind === 'request' ? item.request.status : item.interruption.status) === 'AUTHORIZED').length;
  const rejectedCount = items.filter((item) => (item.kind === 'request' ? item.request.status : item.interruption.status) === 'AUTHORIZATION_REJECTED').length;
  const isSaving = authorizeRequest.isPending || authorizeInterruption.isPending;
  const targetBalance = target?.request.fiscalYearId
    ? balanceByEmployeeYear.get(`${target.request.employeeId}:${target.request.fiscalYearId}`) ?? null
    : null;

  async function submit(status: 'AUTHORIZED' | 'AUTHORIZATION_REJECTED') {
    if (!target) return;
    try {
      if (target.kind === 'request') {
        await authorizeRequest.mutateAsync({ leaveRequestId: target.request.id, status, rejectionReason: status === 'AUTHORIZATION_REJECTED' ? rejectionReason.trim() : undefined });
      } else {
        await authorizeInterruption.mutateAsync({ leaveInterruptionId: target.interruption.id, status, rejectionReason: status === 'AUTHORIZATION_REJECTED' ? rejectionReason.trim() : undefined });
      }
      notifications.show({ title: common('success'), message: status === 'AUTHORIZED' ? t('leaveAuthorizationCompleted') : t('leaveAuthorizationRejected'), color: 'green' });
      closeDialog();
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  function closeDialog() {
    setTarget(null);
    setRejecting(false);
    setRejectionReason('');
  }

  return (
    <div className="flex w-full flex-col gap-4 sm:gap-6">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Summary label={t('awaitingHrAuthorization')} value={pendingCount} />
        <Summary label={t('authorized')} value={authorizedCount} />
        <Summary label={t('rejectedByHr')} value={rejectedCount} />
      </div>
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchEmployeePlaceholder')} className="w-full md:max-w-sm" />
          <Select value={leaveType} onValueChange={setLeaveType}><SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ALL">{t('allLeaveTypes')}</SelectItem>{leaveTypes.map((type) => <SelectItem key={type.id} value={type.id}>{type.nameEn}</SelectItem>)}</SelectContent></Select>
          <Select value={filter} onValueChange={(value) => setFilter(value as QueueFilter)}><SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="PENDING">{t('awaitingHrAuthorization')}</SelectItem><SelectItem value="AUTHORIZED">{t('authorized')}</SelectItem><SelectItem value="REJECTED">{t('rejectedByHr')}</SelectItem><SelectItem value="ALL">{t('allStatuses')}</SelectItem></SelectContent></Select>
          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto">
            <label className="space-y-1 text-sm"><span className="font-medium">{t('requestDateFrom')}</span><CalendarDateField value={requestDateFilters.fromDate} onChange={(fromDate) => setRequestDateFilters((current) => ({ ...current, fromDate }))} /></label>
            <label className="space-y-1 text-sm"><span className="font-medium">{t('requestDateTo')}</span><CalendarDateField value={requestDateFilters.toDate} onChange={(toDate) => setRequestDateFilters((current) => ({ ...current, toDate }))} /></label>
          </div>
        </div>
      </div>
      <Card>
        <CardContent className="px-4 sm:px-6">
          {requestsQuery.isLoading || balancesQuery.isLoading ? <p className="text-sm text-muted-foreground">{common('loading')}</p> : filteredItems.length === 0 ? <EmptyState icon={CalendarCheck} title={t('noLeaveAuthorizations')} description={t('noLeaveAuthorizationsDescription')} /> : (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[62rem]">
                <TableHeader><TableRow><TableHead>{t('employee')}</TableHead><TableHead>{t('type')}</TableHead><TableHead>{t('leaveType')}</TableHead><TableHead>{t('leaveDates')}</TableHead><TableHead>{t('approvedDays')}</TableHead><TableHead>{t('availableBalance')}</TableHead><TableHead>{t('status')}</TableHead><TableHead>{t('approvedAt')}</TableHead><TableHead className="text-right">{t('actions')}</TableHead></TableRow></TableHeader>
                <TableBody>{filteredItems.map((item) => {
                  const request = item.request;
                  const status = item.kind === 'request' ? request.status : item.interruption.status;
                  const balance = request.fiscalYearId ? balanceByEmployeeYear.get(`${request.employeeId}:${request.fiscalYearId}`) : null;
                  return <TableRow key={item.kind === 'request' ? request.id : item.interruption.id}>
                    <TableCell><p className="font-medium">{employeeName(request)}</p><p className="text-xs text-muted-foreground">{request.employee?.employeeCode ?? '-'}</p></TableCell>
                    <TableCell>{item.kind === 'request' ? t('leaveRequest') : t('interruption')}</TableCell>
                    <TableCell>{request.leaveType?.nameEn ?? '-'}</TableCell>
                    <TableCell>{formatDate(request.startDate)} – {formatDate(request.endDate)}</TableCell>
                    <TableCell>{request.approvedDays}</TableCell>
                    <TableCell>{balance?.available ?? '-'}</TableCell>
                    <TableCell><Badge variant={status === 'AUTHORIZATION_REJECTED' ? 'destructive' : status === 'AUTHORIZED' ? 'default' : 'secondary'}>{authorizationStatusLabel(status, t)}</Badge></TableCell>
                    <TableCell>{formatDateTime(item.kind === 'request' ? request.approvedAt : item.interruption.reviewedAt)}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="outline" onClick={() => setTarget(item)}><Eye className="size-4" />{t('viewDetails')}</Button></TableCell>
                  </TableRow>;
                })}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(target)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{target?.kind === 'interruption' ? t('leaveInterruptionAuthorization') : t('leaveAuthorization')}</DialogTitle><DialogDescription>{t('authorizeAsApprovedDescription')}</DialogDescription></DialogHeader>
          {target ? <AuthorizationDetails item={target} balance={targetBalance} formatDate={formatDate} formatDateTime={formatDateTime} /> : null}
          {rejecting ? <div className="space-y-2"><label className="text-sm font-medium">{t('rejectionReason')}</label><Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} /></div> : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>{common('cancel')}</Button>
            {target && (target.kind === 'request' ? target.request.status : target.interruption.status) === 'APPROVED' ? rejecting ? <><Button variant="outline" onClick={() => setRejecting(false)} disabled={isSaving}>{common('back')}</Button><Button variant="destructive" onClick={() => submit('AUTHORIZATION_REJECTED')} disabled={isSaving || !rejectionReason.trim()}><X className="size-4" />{t('rejectAuthorization')}</Button></> : <><Button variant="destructive" onClick={() => setRejecting(true)} disabled={isSaving}><X className="size-4" />{t('reject')}</Button><Button onClick={() => submit('AUTHORIZED')} disabled={isSaving}><Check className="size-4" />{t('authorize')}</Button></> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuthorizationDetails({ item, balance, formatDate, formatDateTime }: { item: WorkItem; balance: LeaveBalance | null; formatDate: (value?: string | Date | null) => string; formatDateTime: (value?: string | Date | null) => string }) {
  const t = useTranslations('core');
  const request = item.request;
  const approvedDates = request.annualLeaveDates?.filter((date) => date.status === 'APPROVED' && date.source === 'ORIGINAL') ?? [];
  const interruptionDates = item.kind === 'interruption' ? item.interruption.dates.filter((date) => date.kind === 'INTERRUPTED_APPROVED') : [];
  const continuationDates = item.kind === 'interruption' ? item.interruption.dates.filter((date) => date.kind === 'CONTINUATION_APPROVED') : [];
  return <div className="space-y-4 text-sm">
    <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2"><Detail label={t('employee')} value={employeeName(request)} /><Detail label={t('leaveType')} value={request.leaveType?.nameEn ?? '-'} /><Detail label={t('requestedDays')} value={request.requestedDays} /><Detail label={t('approvedDays')} value={request.approvedDays} /><Detail label={t('approvedAt')} value={formatDateTime(item.kind === 'request' ? request.approvedAt : item.interruption.reviewedAt)} /><Detail label={t('reason')} value={item.kind === 'request' ? request.reason : item.interruption.reason} /></div>
    {balance ? <div className="grid grid-cols-2 gap-3 rounded-md border p-4 sm:grid-cols-4"><Detail label={t('openingBalance')} value={balance.opening} /><Detail label={t('reservedBalance')} value={balance.reserved} /><Detail label={t('usedBalance')} value={balance.used} /><Detail label={t('availableBalance')} value={balance.available} /></div> : null}
    {item.kind === 'request' && approvedDates.length > 0 ? <DateList title={t('supervisorApprovedDates')} dates={approvedDates.map((date) => ({ date: date.date, value: date.approvedDayValue ?? date.requestedDayValue }))} formatDate={formatDate} /> : null}
    {item.kind === 'interruption' ? <><DateList title={t('interruptedDays')} dates={interruptionDates.map((date) => ({ date: date.date, value: date.dayValue }))} formatDate={formatDate} /><DateList title={t('continuationPattern')} dates={continuationDates.map((date) => ({ date: date.date, value: date.dayValue }))} formatDate={formatDate} /></> : null}
  </div>;
}

function DateList({ title, dates, formatDate }: { title: string; dates: Array<{ date: string; value: string }>; formatDate: (value?: string | Date | null) => string }) {
  return <div><p className="mb-2 font-medium">{title}</p><div className="flex flex-wrap gap-2">{dates.map((date) => <Badge key={date.date} variant="outline">{formatDate(date.date)} · {date.value}</Badge>)}</div></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 break-words font-medium">{value}</p></div>; }
function Summary({ label, value }: { label: string; value: number }) { return <Card className="gap-2 py-3 sm:py-4"><CardContent className="px-3 sm:px-4"><p className="text-xs leading-tight text-muted-foreground sm:text-sm">{label}</p><p className="mt-1 text-xl font-semibold sm:text-2xl">{value}</p></CardContent></Card>; }
function employeeName(request: LeaveRequest) { return [request.employee?.firstNameEn, request.employee?.middleNameEn, request.employee?.lastNameEn].filter(Boolean).join(' ') || '-'; }
function authorizationStatusLabel(status: string, t: (key: any) => string) { if (status === 'AUTHORIZED') return t('authorized'); if (status === 'AUTHORIZATION_REJECTED') return t('rejectedByHr'); return t('awaitingHrAuthorization'); }
