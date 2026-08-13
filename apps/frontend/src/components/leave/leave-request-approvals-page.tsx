'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Check, CalendarCheck, FileCheck2, X } from 'lucide-react';
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
import {
  useChangeLeaveRequestStatus,
  useDashboardSummary,
  useLeaveBalances,
  useLeaveRequests,
} from '@/data/hooks/core.hooks';
import type { LeaveBalance, LeaveRequest } from '@/data/types/core.types';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

function employeeName(employee?: LeaveRequest['employee'] | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function statusVariant(status: LeaveRequest['status']) {
  if (status === 'APPROVED') return 'default';
  if (status === 'REJECTED') return 'destructive';
  return 'secondary';
}

export function LeaveRequestApprovalsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const session = useSession();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [rejectTarget, setRejectTarget] = useState<LeaveRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const dashboardQuery = useDashboardSummary(session.data?.user?.id);
  const leaveBalancesQuery = useLeaveBalances();
  const leaveRequestsQuery = useLeaveRequests();
  const changeStatus = useChangeLeaveRequestStatus();

  const dashboard = dashboardQuery.data?.dashboard;
  const requests = leaveRequestsQuery.data?.leaveRequests ?? [];
  const balances = leaveBalancesQuery.data?.leaveBalances ?? [];
  const balanceByEmployeeYear = useMemo(
    () => new Map(balances.map((balance) => [`${balance.employeeId}:${balance.fiscalYearId}`, balance])),
    [balances],
  );
  const directReportIds = useMemo(() => new Set(dashboard?.sections.manager?.directReports.map((employee) => employee.id) ?? []), [dashboard?.sections.manager?.directReports]);

  const visibleRequests = useMemo(() => {
    if (!dashboard) return [];
    if (dashboard.role === 'SUPER_ADMIN') return requests;
    if (dashboard.role === 'MANAGER') {
      return requests.filter((request) => directReportIds.has(request.employeeId));
    }
    return [];
  }, [dashboard, directReportIds, requests]);

  const filteredRequests = useMemo(() => {
    if (statusFilter === 'ALL') return visibleRequests;
    return visibleRequests.filter((request) => request.status === statusFilter);
  }, [statusFilter, visibleRequests]);

  const pendingCount = useMemo(() => visibleRequests.filter((request) => request.status === 'PENDING').length, [visibleRequests]);
  const approvedCount = useMemo(() => visibleRequests.filter((request) => request.status === 'APPROVED').length, [visibleRequests]);
  const rejectedCount = useMemo(() => visibleRequests.filter((request) => request.status === 'REJECTED').length, [visibleRequests]);

  const approveRequest = async (request: LeaveRequest) => {
    try {
      await changeStatus.mutateAsync({
        leaveRequestId: request.id,
        status: 'APPROVED',
        approvedBy: session.data?.user?.id ?? undefined,
        approvedAt: new Date().toISOString(),
      });

      notifications.show({
        title: common('success'),
        message: t('leaveRequestApproved'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  const openRejectDialog = (request: LeaveRequest) => {
    setRejectTarget(request);
    setRejectionReason('');
  };

  const submitRejection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!rejectTarget) return;

    try {
      await changeStatus.mutateAsync({
        leaveRequestId: rejectTarget.id,
        status: 'REJECTED',
        rejectedBy: session.data?.user?.id ?? undefined,
        rejectedAt: new Date().toISOString(),
        rejectionReason: rejectionReason.trim() || null,
      });

      setRejectTarget(null);
      setRejectionReason('');
      notifications.show({
        title: common('success'),
        message: t('leaveRequestRejected'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  const isLoading = session.isPending || dashboardQuery.isLoading || leaveRequestsQuery.isLoading || leaveBalancesQuery.isLoading;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="grid gap-2 sm:grid-cols-3">
        <Summary label={t('pendingRequests')} value={pendingCount} />
        <Summary label={t('approved')} value={approvedCount} />
        <Summary label={t('rejected')} value={rejectedCount} />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="flex w-full flex-row items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <CardTitle>{t('leaveRequestApprovals')}</CardTitle>
          </div>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
            <SelectTrigger className="w-[14rem]">
              <SelectValue placeholder={t('allStatuses')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('allStatuses')}</SelectItem>
              <SelectItem value="PENDING">{t('pendingRequests')}</SelectItem>
              <SelectItem value="APPROVED">{t('approved')}</SelectItem>
              <SelectItem value="REJECTED">{t('rejected')}</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : !dashboard || (dashboard.role === 'MANAGER' && directReportIds.size === 0) ? (
            <EmptyState
              icon={FileCheck2}
              title={t('noLeaveRequests')}
              description={t('noLeaveRequestsDescription')}
            />
          ) : filteredRequests.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={t('noLeaveRequests')}
              description={t('noLeaveRequestsDescription')}
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
                  {filteredRequests.map((request) => (
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
                      <TableCell>{request.requestedDays}</TableCell>
                      <TableCell>
                        {request.leaveType?.code?.trim().toUpperCase() === 'ANNUAL' ? (
                          <BalanceCell balance={request.fiscalYearId ? balanceByEmployeeYear.get(`${request.employeeId}:${request.fiscalYearId}`) ?? null : null} />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell><Badge variant={statusVariant(request.status) as any}>{request.status}</Badge></TableCell>
                      <TableCell>
                        {request.status === 'PENDING' ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => approveRequest(request)}
                              disabled={changeStatus.isPending}
                            >
                              <Check className="size-4" />
                              {t('approve')}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openRejectDialog(request)}
                              disabled={changeStatus.isPending}
                            >
                              <X className="size-4" />
                              {t('reject')}
                            </Button>
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-muted-foreground">
                            {request.status === 'APPROVED' ? formatDate(request.approvedAt) : formatDate(request.rejectedAt)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reject')}</DialogTitle>
            <DialogDescription>{t('rejectionReason')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitRejection}>
            <Textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder={t('rejectionReason')}
              rows={4}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={changeStatus.isPending}>
                {changeStatus.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
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
