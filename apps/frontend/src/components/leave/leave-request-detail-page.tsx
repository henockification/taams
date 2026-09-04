'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, CalendarCheck, Check, Pencil, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AnnualLeaveApprovalEditor } from '@/components/leave/annual-leave-approval-editor';
import { LeaveInterruptionDialog } from '@/components/leave/leave-interruption-dialog';
import { DelegationAuditBadge, DelegationBanner, delegatedActionLabel } from '@/components/supervisor/delegation-context';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { hasSupervisorApprovalAccess } from '@/config/app-navigation';
import { useChangeLeaveRequestStatus, useLeaveBalances, useLeaveRequests, useReviewLeaveInterruption } from '@/data/hooks/core.hooks';
import type { LeaveInterruption, LeaveRequest } from '@/data/types/core.types';
import { Link } from '@/i18n';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type LeaveRequestDetailPageProps = {
  requestId: string;
  backHref: string;
  approvalMode?: boolean;
};

function employeeName(employee?: LeaveRequest['employee'] | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function statusVariant(status: LeaveRequest['status']) {
  if (status === 'APPROVED') return 'default';
  if (status === 'REJECTED') return 'destructive';
  return 'secondary';
}

export function LeaveRequestDetailPage({ requestId, backHref, approvalMode = false }: LeaveRequestDetailPageProps) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const session = useSession();
  const leaveRequestsQuery = useLeaveRequests(approvalMode ? undefined : 'annual', approvalMode ? 'approvals' : 'self');
  const leaveBalancesQuery = useLeaveBalances(undefined, { view: approvalMode ? 'approvals' : 'self' });
  const changeStatus = useChangeLeaveRequestStatus();
  const reviewInterruption = useReviewLeaveInterruption();
  const [interruptionReviewTarget, setInterruptionReviewTarget] = useState<{ request: LeaveRequest; interruption: LeaveInterruption } | null>(null);
  const [interruptionRejectTarget, setInterruptionRejectTarget] = useState<{ request: LeaveRequest; interruption: LeaveInterruption } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const request = leaveRequestsQuery.data?.leaveRequests.find((item) => item.id === requestId) ?? null;
  const balances = leaveBalancesQuery.data?.leaveBalances ?? [];
  const balance = useMemo(() => {
    if (!request?.fiscalYearId) return null;
    return balances.find((item) => item.employeeId === request.employeeId && item.fiscalYearId === request.fiscalYearId) ?? null;
  }, [balances, request]);
  const isOwnRequest = request?.requestedBy === session.data?.user?.id && request?.employee?.userId === session.data?.user?.id;
  const canReviewRequests = hasSupervisorApprovalAccess(session.data?.user, 'leave-request-approvals:approve');
  const canEdit = Boolean(request && request.status === 'PENDING' && isOwnRequest);
  const pendingInterruption = request?.interruptions?.find((interruption) => interruption.status === 'PENDING') ?? null;
  const canReviewRequest = Boolean(request && request.status === 'PENDING' && !isOwnRequest && canReviewRequests);
  const isAnnualLeaveRequest = Boolean(request?.leaveType?.code?.trim().toUpperCase() === 'ANNUAL');
  const canReviewInterruption = Boolean(
    request
    && pendingInterruption
    && pendingInterruption.requestedBy !== session.data?.user?.id
    && canReviewRequests,
  );

  const approveRequest = async (target: LeaveRequest) => {
    try {
      await changeStatus.mutateAsync({
        leaveRequestId: target.id,
        status: 'APPROVED',
        approvedBy: session.data?.user?.id ?? undefined,
        approvedAt: new Date().toISOString(),
      });
      notifications.show({ title: common('success'), message: t('leaveRequestApproved'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const submitAnnualApproval = async (target: LeaveRequest, approvedDates: Array<{ date: string; dayValue: string }>) => {
    try {
      await changeStatus.mutateAsync({
        leaveRequestId: target.id,
        status: 'APPROVED',
        approvedBy: session.data?.user?.id ?? undefined,
        approvedAt: new Date().toISOString(),
        approvedDates,
      });
      notifications.show({ title: common('success'), message: t('leaveRequestApproved'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const submitRejection = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!request) return;
    try {
      await changeStatus.mutateAsync({
        leaveRequestId: request.id,
        status: 'REJECTED',
        rejectedBy: session.data?.user?.id ?? undefined,
        rejectedAt: new Date().toISOString(),
        rejectionReason: rejectionReason.trim(),
      });
      setRejectOpen(false);
      setRejectionReason('');
      notifications.show({ title: common('success'), message: t('leaveRequestRejected'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
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

  if (leaveRequestsQuery.isLoading || session.isPending) {
    return <p className="text-sm text-muted-foreground">{common('loading')}</p>;
  }

  if (!request) {
    return <EmptyState icon={CalendarCheck} title={t('leaveRequestNotFound')} description={t('leaveRequestNotFoundDescription')} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      {approvalMode ? <DelegationBanner user={session.data?.user} /> : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Button type="button" variant="ghost" asChild className="-ml-3">
            <Link href={backHref as any}><ArrowLeft className="size-4" />{common('back')}</Link>
          </Button>
          <h1 className="text-2xl font-semibold text-foreground">{t('leaveRequestDetails')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{employeeName(request.employee) || t('unknown')} · {request.employee?.employeeCode ?? '-'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusVariant(request.status) as any}>{request.status}</Badge>
          <DelegationAuditBadge delegationId={request.supervisorDelegationId} />
          {canEdit ? (
            <Button type="button" variant="outline" asChild>
              <Link href={`/annual-leave-requests/${request.id}/edit` as any}><Pencil className="size-4" />{common('edit')}</Link>
            </Button>
          ) : null}
          {canReviewRequest && !isAnnualLeaveRequest ? (
            <>
              <Button type="button" onClick={() => approveRequest(request)} disabled={changeStatus.isPending}>
                <Check className="size-4" />{delegatedActionLabel(t('approve'), session.data?.user)}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRejectionReason('');
                  setRejectOpen(true);
                }}
                disabled={changeStatus.isPending}
              >
                <X className="size-4" />{delegatedActionLabel(t('reject'), session.data?.user)}
              </Button>
            </>
          ) : null}
          {request && pendingInterruption && canReviewInterruption ? (
            <>
              <Button
                type="button"
                onClick={() => setInterruptionReviewTarget({ request, interruption: pendingInterruption })}
                disabled={reviewInterruption.isPending}
              >
                <Check className="size-4" />{delegatedActionLabel(t('reviewLeaveInterruption'), session.data?.user)}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRejectionReason('');
                  setInterruptionRejectTarget({ request, interruption: pendingInterruption });
                }}
                disabled={reviewInterruption.isPending}
              >
                <X className="size-4" />{delegatedActionLabel(t('rejectLeaveInterruption'), session.data?.user)}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <InfoCard label={t('leaveType')} value={request.leaveType?.nameEn ?? '-'} />
        <InfoCard label={t('fiscalYear')} value={request.fiscalYear?.name ?? '-'} />
        <InfoCard label={t('availableBalance')} value={balance?.available ?? '-'} />
      </div>

      <Card className="rounded-lg">
        <CardHeader><CardTitle>{t('requestSummary')}</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <InfoBlock label={t('startDate')} value={formatDate(request.startDate)} />
          <InfoBlock label={t('endDate')} value={formatDate(request.endDate)} />
          <InfoBlock label={t('requestedDays')} value={request.requestedDays} />
          <InfoBlock label={t('approvedDays')} value={request.approvedDays} />
          <div className="md:col-span-4">
            <p className="text-xs text-muted-foreground">{t('reason')}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{request.reason}</p>
          </div>
        </CardContent>
      </Card>

      {canReviewRequest && isAnnualLeaveRequest ? (
        <AnnualLeaveApprovalEditor
          request={request}
          isSaving={changeStatus.isPending}
          approveLabel={delegatedActionLabel(t('approve'), session.data?.user)}
          onApprove={submitAnnualApproval}
        />
      ) : null}

      <Card className="rounded-lg">
        <CardHeader><CardTitle>{t('leaveDates')}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('date')}</TableHead>
                  <TableHead>{t('requestedDays')}</TableHead>
                  <TableHead>{t('approvedDays')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(request.annualLeaveDates ?? []).map((date) => (
                  <TableRow key={date.id}>
                    <TableCell>{formatDate(date.date)}</TableCell>
                    <TableCell>{date.requestedDayValue}</TableCell>
                    <TableCell>{date.approvedDayValue ?? '-'}</TableCell>
                    <TableCell><Badge variant="outline">{date.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {request.interruptions?.length ? (
        <Card className="rounded-lg">
          <CardHeader><CardTitle>{t('interruption')}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {request.interruptions.map((interruption) => (
              <div key={interruption.id} className="space-y-4 rounded-md border border-border p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <InfoBlock label={t('status')} value={interruption.status} />
                  <InfoBlock label={t('recallAuthority')} value={interruption.recallAuthority} />
                  <InfoBlock
                    label={t('actualWorkingPeriod')}
                    value={`${formatDate(interruption.actualWorkStartDate)} - ${formatDate(interruption.actualWorkEndDate)}`}
                  />
                  <InfoBlock label={t('reviewedAt')} value={formatDate(interruption.reviewedAt)} />
                  <div className="flex items-end">
                    <DelegationAuditBadge delegationId={interruption.supervisorDelegationId} />
                  </div>
                  <div className="md:col-span-4">
                    <p className="text-xs text-muted-foreground">{t('interruptionReason')}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{interruption.reason}</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('date')}</TableHead>
                        <TableHead>{t('type')}</TableHead>
                        <TableHead>{t('requestedDays')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {interruption.dates.map((date) => (
                        <TableRow key={date.id}>
                          <TableCell>{formatDate(date.date)}</TableCell>
                          <TableCell>{date.kind}</TableCell>
                          <TableCell>{date.dayValue}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('reject')}</DialogTitle>
            <DialogDescription>{t('rejectionReason')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitRejection}>
            <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={changeStatus.isPending || !rejectionReason.trim()}>{changeStatus.isPending ? t('saving') : common('save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
          <DialogHeader>
            <DialogTitle>{t('rejectLeaveInterruption')}</DialogTitle>
            <DialogDescription>{t('rejectionReason')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitInterruptionRejection}>
            <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} rows={4} />
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="p-4">
        <InfoBlock label={label} value={value} />
      </CardContent>
    </Card>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}
