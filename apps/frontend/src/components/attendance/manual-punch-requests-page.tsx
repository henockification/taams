'use client';

import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { Check, ClipboardPlus, Pencil, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { CalendarDateTimeField } from '@/components/calendar/calendar-date-field';
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
import { DelegationAuditBadge, DelegationBanner, delegatedActionLabel } from '@/components/supervisor/delegation-context';
import {
  useChangeManualPunchRequestStatus,
  useCreateManualPunchRequest,
  useManualPunchRequests,
  useUpdateManualPunchRequest,
} from '@/data/hooks/core.hooks';
import type { Employee, ManualPunchRequest, PunchType } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { useSession } from '@/lib/auth-client';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const punchTypes: PunchType[] = ['IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN'];

const initialRequestForm = {
  requestedPunchTime: '',
  requestedPunchType: 'UNKNOWN' as PunchType,
  reason: '',
};

export function ManualPunchRequestsPage({
  mode,
  initialCorrection,
  focusRequestId,
}: {
  mode: 'employee' | 'supervisor';
  initialCorrection?: { date?: string; requestedPunchTime?: string; punchType?: PunchType; open?: boolean };
  focusRequestId?: string;
}) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDateTime } = useCalendarPreference();
  const isSupervisor = mode === 'supervisor';
  const [dialogOpen, setDialogOpen] = useState(Boolean(!isSupervisor && initialCorrection?.open));
  const [form, setForm] = useState({
    ...initialRequestForm,
    requestedPunchTime: initialCorrection?.requestedPunchTime
      ?? (initialCorrection?.date ? `${initialCorrection.date}T08:00` : toDateTimeLocal()),
    requestedPunchType: initialCorrection?.punchType ?? initialRequestForm.requestedPunchType,
  });

  const [rejectTarget, setRejectTarget] = useState<ManualPunchRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const manualRequests = useManualPunchRequests({ mine: !isSupervisor });
  const createManualRequest = useCreateManualPunchRequest();
  const updateManualRequest = useUpdateManualPunchRequest();
  // Set while the dialog edits an existing (still pending) request instead of creating one.
  const [editingRequest, setEditingRequest] = useState<ManualPunchRequest | null>(null);
  const isSavingRequest = createManualRequest.isPending || updateManualRequest.isPending;
  const changeManualRequestStatus = useChangeManualPunchRequestStatus();
  const session = useSession();

  const requests = manualRequests.data?.manualPunchRequests ?? [];
  const focusedRowRef = useRef<HTMLTableRowElement>(null);
  const hasFocusedRequest = Boolean(focusRequestId && requests.some((request) => request.id === focusRequestId));

  useEffect(() => {
    if (hasFocusedRequest) focusedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [hasFocusedRequest]);

  const openManualRequestDialog = () => {
    setEditingRequest(null);
    setForm({ ...initialRequestForm, requestedPunchTime: toDateTimeLocal() });
    setDialogOpen(true);
  };

  const openEditDialog = (request: ManualPunchRequest) => {
    setEditingRequest(request);
    setForm({
      requestedPunchTime: toDateTimeLocal(new Date(request.requestedPunchTime)),
      requestedPunchType: request.requestedPunchType,
      reason: request.reason ?? '',
    });
    setDialogOpen(true);
  };

  const saveManualRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = {
        requestedPunchTime: toIso(form.requestedPunchTime),
        requestedPunchType: form.requestedPunchType,
        reason: form.reason.trim(),
      };
      if (editingRequest) {
        await updateManualRequest.mutateAsync({ manualPunchRequestId: editingRequest.id, ...payload });
      } else {
        await createManualRequest.mutateAsync(payload);
      }

      setDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: editingRequest ? t('manualPunchRequestUpdated') : t('manualPunchRequestCreated'),
        color: 'green',
      });
      setEditingRequest(null);
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  const changeRequestStatus = async (
    request: ManualPunchRequest,
    status: 'SUPERVISOR_APPROVED' | 'SUPERVISOR_REJECTED',
    reason?: string,
  ) => {
    try {
      await changeManualRequestStatus.mutateAsync({
        manualPunchRequestId: request.id,
        status,
        rejectedAt: status === 'SUPERVISOR_REJECTED' ? new Date().toISOString() : undefined,
        rejectionReason: status === 'SUPERVISOR_REJECTED' ? reason : undefined,
      });
      if (status === 'SUPERVISOR_REJECTED') setRejectTarget(null);

      notifications.show({
        title: common('success'),
        message: status === 'SUPERVISOR_APPROVED' ? t('manualPunchRequestApproved') : t('manualPunchRequestRejected'),
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

  return (
    <div className="flex w-full flex-col gap-6">
      {isSupervisor ? <DelegationBanner user={session.data?.user} /> : null}

      {!isSupervisor ? (
        <div className="flex w-full justify-end">
          <Button onClick={openManualRequestDialog} className="w-full lg:w-auto">
            <Plus className="size-4" />
            {common('add')}
          </Button>
        </div>
      ) : null}

      <Card className="rounded-lg">
        <CardContent>
          {manualRequests.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={ClipboardPlus}
              title={t('noManualPunchRequests')}
              description={isSupervisor ? t('noAttendanceCorrectionApprovalsDescription') : t('noManualPunchRequestsDescription')}
            />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSupervisor ? <TableHead>{t('employee')}</TableHead> : null}
                    <TableHead>{t('punchTime')}</TableHead>
                    <TableHead>{t('punchType')}</TableHead>
                    <TableHead>{t('reason')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const canApprove = isSupervisor
                      && canSupervisorDecide(request.status)
                      && request.employee?.userId !== session.data?.user?.id;

                    return (
                      <TableRow
                        key={request.id}
                        ref={request.id === focusRequestId ? focusedRowRef : undefined}
                        className={request.id === focusRequestId ? 'bg-primary/5 ring-1 ring-inset ring-primary/40' : undefined}
                      >
                        {isSupervisor ? (
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{employeeName(request.employee) || t('unknown')}</p>
                              <p className="truncate text-xs text-muted-foreground">{request.employee?.employeeCode ?? '-'}</p>
                            </div>
                          </TableCell>
                        ) : null}
                        <TableCell className="whitespace-nowrap">{formatDateTime(request.requestedPunchTime)}</TableCell>
                        <TableCell><Badge variant="secondary">{request.requestedPunchType}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={requestStatusVariant(request.status) as any}>{requestStatusLabel(request.status, t)}</Badge>
                            {isRejectedStatus(request.status) && request.rejectionReason ? (
                              <p className="max-w-xs whitespace-normal text-xs text-muted-foreground">
                                {t('rejectionReason')}: {request.rejectionReason}
                              </p>
                            ) : null}
                            <DelegationAuditBadge delegationId={request.supervisorDelegationId} />
                          </div>
                        </TableCell>
                        {isSupervisor ? (
                          <TableCell>
                            {canApprove ? (
                              <div className="flex justify-end gap-2">
                                <Button type="button" size="sm" onClick={() => changeRequestStatus(request, 'SUPERVISOR_APPROVED')} disabled={changeManualRequestStatus.isPending}>
                                  <Check className="size-4" />
                                  {delegatedActionLabel(t('approve'), session.data?.user)}
                                </Button>
                                <Button type="button" size="sm" variant="outline" onClick={() => {
                                  setRejectionReason('');
                                  setRejectTarget(request);
                                }} disabled={changeManualRequestStatus.isPending}>
                                  <X className="size-4" />
                                  {delegatedActionLabel(t('reject'), session.data?.user)}
                                </Button>
                              </div>
                            ) : (
                              <span className="block text-right text-xs text-muted-foreground">
                                {request.status === 'SUPERVISOR_APPROVED' ? formatDateTime(request.approvedAt) : request.status === 'SUPERVISOR_REJECTED' || request.status === 'HR_REJECTED' ? formatDateTime(request.rejectedAt) : '-'}
                              </span>
                            )}
                          </TableCell>
                        ) : (
                          <TableCell>
                            {canSupervisorDecide(request.status) && request.requestedBy === session.data?.user?.id ? (
                              <div className="flex justify-end">
                                <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(request)}>
                                  <Pencil className="size-4" />
                                  {common('edit')}
                                </Button>
                              </div>
                            ) : (
                              <span className="block text-right text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!isSupervisor ? (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{editingRequest ? t('editAttendanceCorrection') : t('requestAttendanceCorrection')}</DialogTitle>
              <DialogDescription>{editingRequest ? t('editAttendanceCorrectionDescription') : t('manualPunchRequestFormDescription')}</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={saveManualRequest}>
              <Field label={t('punchTime')} id="request-time">
                <CalendarDateTimeField id="request-time" value={form.requestedPunchTime} onChange={(requestedPunchTime) => setForm((current) => ({ ...current, requestedPunchTime }))} required />
              </Field>
              <Field label={t('punchType')} id="request-type">
                <Select value={form.requestedPunchType} onValueChange={(value) => setForm((current) => ({ ...current, requestedPunchType: value as PunchType }))}>
                  <SelectTrigger id="request-type" className="w-full"><SelectValue placeholder={t('selectPunchType')} /></SelectTrigger>
                  <SelectContent>{punchTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label={t('reason')} id="request-reason">
                <Textarea id="request-reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
                <Button type="submit" disabled={isSavingRequest || !form.requestedPunchTime || !form.reason.trim()}>
                  {isSavingRequest ? t('saving') : common('save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={Boolean(rejectTarget)} onOpenChange={(open) => { if (!open) setRejectTarget(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('rejectAttendanceCorrection')}</DialogTitle>
            <DialogDescription>{t('rejectAttendanceCorrectionDescription')}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (rejectTarget) void changeRequestStatus(rejectTarget, 'SUPERVISOR_REJECTED', rejectionReason.trim());
            }}
          >
            <Field label={t('rejectionReason')} id="correction-rejection-reason">
              <Textarea id="correction-rejection-reason" value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} required />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>{common('cancel')}</Button>
              <Button type="submit" variant="destructive" disabled={changeManualRequestStatus.isPending || !rejectionReason.trim()}>
                {delegatedActionLabel(t('reject'), session.data?.user)}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function isRejectedStatus(status: ManualPunchRequest['status']) {
  return status === 'SUPERVISOR_REJECTED' || status === 'HR_REJECTED' || status === 'REJECTED';
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function toDateTimeLocal(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function requestStatusVariant(status: ManualPunchRequest['status']) {
  if (status === 'SUPERVISOR_APPROVED' || status === 'APPROVED') return 'default';
  if (status === 'HR_REJECTED' || status === 'SUPERVISOR_REJECTED' || status === 'REJECTED') return 'destructive';
  return 'secondary';
}

function canSupervisorDecide(status: ManualPunchRequest['status']) {
  return status === 'PENDING_REVIEW' || status === 'PENDING_HR_REVIEW' || status === 'HR_REVIEWED' || status === 'PENDING';
}

function requestStatusLabel(status: ManualPunchRequest['status'], t: (key: string) => string) {
  if (status === 'SUPERVISOR_APPROVED' || status === 'APPROVED') return t('approved');
  if (status === 'SUPERVISOR_REJECTED' || status === 'HR_REJECTED' || status === 'REJECTED') return t('rejected');
  return t('pendingReview');
}
