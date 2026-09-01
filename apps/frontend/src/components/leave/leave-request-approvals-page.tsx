'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CalendarCheck, Eye, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
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
import { Select,
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
import { DelegationAuditBadge, DelegationBanner } from '@/components/supervisor/delegation-context';
import {
  useLeaveBalances,
  useLeaveRequests,
  useReviewLeaveInterruption,
} from '@/data/hooks/core.hooks';
import { hasSupervisorApprovalAccess } from '@/config/app-navigation';
import { Link } from '@/i18n';
import type { LeaveBalance, LeaveInterruption, LeaveRequest } from '@/data/types/core.types';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type DateFilter = 'ALL' | 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM';

function employeeName(employee?: LeaveRequest['employee'] | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function statusVariant(status: LeaveRequest['status']) {
  if (status === 'APPROVED') return 'default';
  if (status === 'REJECTED') return 'destructive';
  return 'secondary';
}

function dateToYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateFilterBounds(dateFilter: DateFilter, custom: { fromDate: string; toDate: string }) {
  if (dateFilter === 'CUSTOM') return custom;
  if (dateFilter === 'ALL') return { fromDate: '', toDate: '' };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(today);

  if (dateFilter === 'TODAY') {
    return { fromDate: dateToYmd(today), toDate: dateToYmd(end) };
  }

  if (dateFilter === 'THIS_WEEK') {
    const mondayOffset = (today.getDay() + 6) % 7;
    const start = new Date(today);
    start.setDate(today.getDate() - mondayOffset);
    end.setDate(start.getDate() + 6);
    return { fromDate: dateToYmd(start), toDate: dateToYmd(end) };
  }

  if (dateFilter === 'THIS_MONTH') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    end.setMonth(today.getMonth() + 1, 0);
    return { fromDate: dateToYmd(start), toDate: dateToYmd(end) };
  }

  const start = new Date(today.getFullYear(), 0, 1);
  end.setMonth(11, 31);
  return { fromDate: dateToYmd(start), toDate: dateToYmd(end) };
}

export function LeaveRequestApprovalsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const session = useSession();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('ALL');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('ALL');
  const [requestDateFilters, setRequestDateFilters] = useState({ fromDate: '', toDate: '' });
  const [interruptionReviewTarget, setInterruptionReviewTarget] = useState<{ request: LeaveRequest; interruption: LeaveInterruption } | null>(null);
  const [interruptionRejectTarget, setInterruptionRejectTarget] = useState<{ request: LeaveRequest; interruption: LeaveInterruption } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const leaveBalancesQuery = useLeaveBalances();
  const leaveRequestsQuery = useLeaveRequests();
  const reviewInterruption = useReviewLeaveInterruption();

  const requests = leaveRequestsQuery.data?.leaveRequests ?? [];
  const balances = leaveBalancesQuery.data?.leaveBalances ?? [];
  const canReviewRequests = hasSupervisorApprovalAccess(session.data?.user, 'leave-request-approvals:approve');
  const balanceByEmployeeYear = useMemo(
    () => new Map(balances.map((balance) => [`${balance.employeeId}:${balance.fiscalYearId}`, balance])),
    [balances],
  );
  const leaveTypeOptions = useMemo(() => {
    const byId = new Map<string, NonNullable<LeaveRequest['leaveType']>>();
    for (const request of requests) {
      if (request.leaveType) byId.set(request.leaveTypeId, request.leaveType);
    }
    return Array.from(byId.values()).sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  }, [requests]);

  const baseFilteredRequests = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    const bounds = getDateFilterBounds(dateFilter, requestDateFilters);

    return requests.filter((request) => {
      if (leaveTypeFilter !== 'ALL' && request.leaveTypeId !== leaveTypeFilter) return false;

      if (search) {
        const haystack = [
          employeeName(request.employee),
          request.employee?.employeeCode,
          request.employee?.firstNameEn,
          request.employee?.middleNameEn,
          request.employee?.lastNameEn,
          request.employee?.firstNameAm,
          request.employee?.middleNameAm,
          request.employee?.lastNameAm,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      const requestDate = request.createdAt.slice(0, 10);
      if (bounds.fromDate && requestDate < bounds.fromDate) return false;
      if (bounds.toDate && requestDate > bounds.toDate) return false;

      return true;
    });
  }, [dateFilter, employeeSearch, leaveTypeFilter, requestDateFilters, requests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'ALL') return baseFilteredRequests;
    return baseFilteredRequests.filter((request) => request.status === statusFilter || (
      statusFilter === 'PENDING' && request.interruptions?.some((interruption) => interruption.status === 'PENDING')
    ));
  }, [baseFilteredRequests, statusFilter]);

  const pendingCount = useMemo(() => baseFilteredRequests.filter((request) => request.status === 'PENDING').length
    + baseFilteredRequests.reduce((count, request) => count + (request.interruptions?.filter((interruption) => interruption.status === 'PENDING').length ?? 0), 0), [baseFilteredRequests]);
  const approvedCount = useMemo(() => baseFilteredRequests.filter((request) => request.status === 'APPROVED').length, [baseFilteredRequests]);
  const rejectedCount = useMemo(() => baseFilteredRequests.filter((request) => request.status === 'REJECTED').length, [baseFilteredRequests]);
  const hasActiveFilters = statusFilter !== 'PENDING'
    || leaveTypeFilter !== 'ALL'
    || Boolean(employeeSearch.trim())
    || dateFilter !== 'ALL'
    || Boolean(requestDateFilters.fromDate)
    || Boolean(requestDateFilters.toDate);

  const clearFilters = () => {
    setStatusFilter('PENDING');
    setLeaveTypeFilter('ALL');
    setEmployeeSearch('');
    setDateFilter('ALL');
    setRequestDateFilters({ fromDate: '', toDate: '' });
  };

  const submitInterruptionApproval = async (payload: {
    interruptedDates: Array<{ date: string; dayValue: string }>;
    continuationDates: Array<{ date: string; dayValue: string }>;
  }) => {
    if (!interruptionReviewTarget) return;
    try {
      await reviewInterruption.mutateAsync({
        leaveInterruptionId: interruptionReviewTarget.interruption.id,
        status: 'APPROVED',
        reviewedBy: session.data?.user?.id ?? null,
        interruptedDates: payload.interruptedDates,
        continuationDates: payload.continuationDates,
      });
      setInterruptionReviewTarget(null);
      notifications.show({ title: common('success'), message: t('leaveInterruptionApproved'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const submitInterruptionRejection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!interruptionRejectTarget) return;
    try {
      await reviewInterruption.mutateAsync({
        leaveInterruptionId: interruptionRejectTarget.interruption.id,
        status: 'REJECTED',
        reviewedBy: session.data?.user?.id ?? null,
        rejectionReason: rejectionReason.trim(),
      });
      setInterruptionRejectTarget(null);
      setRejectionReason('');
      notifications.show({ title: common('success'), message: t('leaveInterruptionRejected'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const isLoading = session.isPending || leaveRequestsQuery.isLoading || leaveBalancesQuery.isLoading;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <DelegationBanner user={session.data?.user} />

      <div className="grid gap-2 sm:grid-cols-3">
        <Summary label={t('pendingRequests')} value={pendingCount} />
        <Summary label={t('approved')} value={approvedCount} />
        <Summary label={t('rejected')} value={rejectedCount} />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="space-y-4">
          <div className="min-w-0 flex-1">
            <CardTitle>{t('leaveRequestApprovals')}</CardTitle>
          </div>
          <div className="grid gap-3 lg:grid-cols-[minmax(14rem,1.3fr)_minmax(12rem,1fr)_minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_auto] lg:items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="leave-approval-employee-search">{t('employeeSearch')}</label>
              <Input
                id="leave-approval-employee-search"
                value={employeeSearch}
                onChange={(event) => setEmployeeSearch(event.target.value)}
                placeholder={t('searchEmployeePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="leave-approval-type-filter">{t('leaveType')}</label>
              <Select value={leaveTypeFilter} onValueChange={setLeaveTypeFilter}>
                <SelectTrigger id="leave-approval-type-filter">
                  <SelectValue placeholder={t('allLeaveTypes')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('allLeaveTypes')}</SelectItem>
                  {leaveTypeOptions.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="leave-approval-date-filter">{t('requestDateRange')}</label>
              <Select
                value={dateFilter}
                onValueChange={(value) => {
                  const nextFilter = value as DateFilter;
                  setDateFilter(nextFilter);
                  if (nextFilter !== 'CUSTOM') setRequestDateFilters({ fromDate: '', toDate: '' });
                }}
              >
                <SelectTrigger id="leave-approval-date-filter">
                  <SelectValue placeholder={t('allDates')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('allDates')}</SelectItem>
                  <SelectItem value="TODAY">{t('today')}</SelectItem>
                  <SelectItem value="THIS_WEEK">{t('thisWeek')}</SelectItem>
                  <SelectItem value="THIS_MONTH">{t('thisMonth')}</SelectItem>
                  <SelectItem value="THIS_YEAR">{t('thisYear')}</SelectItem>
                  <SelectItem value="CUSTOM">{t('customRange')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="leave-approval-date-from">{t('requestDateFrom')}</label>
              <Input
                id="leave-approval-date-from"
                type="date"
                value={requestDateFilters.fromDate}
                onChange={(event) => {
                  setDateFilter('CUSTOM');
                  setRequestDateFilters((current) => ({ ...current, fromDate: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="leave-approval-date-to">{t('requestDateTo')}</label>
              <Input
                id="leave-approval-date-to"
                type="date"
                value={requestDateFilters.toDate}
                onChange={(event) => {
                  setDateFilter('CUSTOM');
                  setRequestDateFilters((current) => ({ ...current, toDate: event.target.value }));
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              <X className="size-4" />
              {t('clearFilters')}
            </Button>
          </div>
          <div className="max-w-xs">
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger>
                <SelectValue placeholder={t('allStatuses')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('allStatuses')}</SelectItem>
                <SelectItem value="PENDING">{t('pendingRequests')}</SelectItem>
                <SelectItem value="APPROVED">{t('approved')}</SelectItem>
                <SelectItem value="REJECTED">{t('rejected')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={t('noLeaveRequests')}
              description={hasActiveFilters ? t('noLeaveRequestsForFilters') : t('noLeaveRequestsDescription')}
            />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('leaveType')}</TableHead>
                    <TableHead>{t('startDate')}</TableHead>
                    <TableHead>{t('endDate')}</TableHead>
                    <TableHead>{t('requestedDays')}</TableHead>
                    <TableHead>{t('availableBalance')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => {
                    const isOwnRequest = request.requestedBy === session.data?.user?.id || request.employee?.userId === session.data?.user?.id;
                    const pendingInterruption = request.interruptions?.find((interruption) => interruption.status === 'PENDING') ?? null;

                    return (
                      <TableRow key={request.id}>
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
                            {request.status === 'APPROVED' ? (
                              <div className="text-xs text-muted-foreground">
                                <p>{t('approvedDays')}: {request.approvedDays}{request.isPartialApproval ? ` · ${t('partialApproval')}` : ''}</p>
                                {isAnnualRequest(request) ? <p>{t('consumedDays')}: {request.consumedDays} · {t('remainingDays')}: {request.remainingDays}</p> : null}
                                {pendingInterruption ? <p>{t('interruption')}: {t('pendingRequests')}</p> : null}
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          {request.leaveType?.code?.trim().toUpperCase() === 'ANNUAL' ? (
                            <BalanceCell balance={request.fiscalYearId ? balanceByEmployeeYear.get(`${request.employeeId}:${request.fiscalYearId}`) ?? null : null} />
                          ) : (
                            '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={statusVariant(request.status) as any}>{request.status}</Badge>
                            <DelegationAuditBadge delegationId={request.supervisorDelegationId} />
                          </div>
                        </TableCell>
                        <TableCell>
                          {request.status === 'PENDING' && !isOwnRequest && canReviewRequests ? (
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="outline" asChild>
                                <Link href={`/leave-request-approvals/${request.id}` as any}>
                                  <Eye className="size-4" />
                                  {t('viewDetails')}
                                </Link>
                              </Button>
                            </div>
                          ) : pendingInterruption && pendingInterruption.requestedBy !== session.data?.user?.id && canReviewRequests ? (
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" variant="outline" asChild>
                                <Link href={`/leave-request-approvals/${request.id}` as any}>
                                  <Eye className="size-4" />{t('viewDetails')}
                                </Link>
                              </Button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-muted-foreground">
                              {request.status === 'APPROVED' ? formatDate(request.approvedAt) : request.status === 'REJECTED' ? formatDate(request.rejectedAt) : '-'}
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

      <LeaveInterruptionDialog
        request={interruptionReviewTarget?.request ?? null}
        interruption={interruptionReviewTarget?.interruption ?? null}
        open={Boolean(interruptionReviewTarget)}
        isSaving={reviewInterruption.isPending}
        onOpenChange={(open) => !open && setInterruptionReviewTarget(null)}
        onSubmit={submitInterruptionApproval}
      />

      <Dialog open={Boolean(interruptionRejectTarget)} onOpenChange={(open) => !open && setInterruptionRejectTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('rejectLeaveInterruption')}</DialogTitle><DialogDescription>{t('rejectionReason')}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={submitInterruptionRejection}>
            <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder={t('rejectionReason')} rows={4} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInterruptionRejectTarget(null)}>{common('cancel')}</Button>
              <Button type="submit" disabled={reviewInterruption.isPending || !rejectionReason.trim()}>{reviewInterruption.isPending ? t('saving') : common('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isAnnualRequest(request: LeaveRequest) {
  return request.leaveType?.code?.trim().toUpperCase() === 'ANNUAL';
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}

function BalanceCell({ balance }: { balance: LeaveBalance | null }) {
  if (!balance) return <span className="text-sm text-muted-foreground">-</span>;

  return (
    <div className="space-y-0.5">
      <p className="text-sm font-medium text-foreground">{balance.available}</p>
      <p className="text-xs text-muted-foreground">{balance.fiscalYear?.name ?? ''}</p>
    </div>
  );
}
