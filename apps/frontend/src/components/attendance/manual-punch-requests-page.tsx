'use client';

import { type FormEvent, type ReactNode, useState } from 'react';
import { Check, ClipboardPlus, FileText, Plus, X } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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
  supportingDocumentName: '',
  supportingDocumentUrl: '',
  supportingDocumentMimeType: '',
  supportingDocumentSize: 0,
};

export function ManualPunchRequestsPage({ mode }: { mode: 'employee' | 'supervisor' }) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDateTime } = useCalendarPreference();
  const isSupervisor = mode === 'supervisor';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...initialRequestForm, requestedPunchTime: toDateTimeLocal() });

  const manualRequests = useManualPunchRequests({ mine: !isSupervisor });
  const createManualRequest = useCreateManualPunchRequest();
  const changeManualRequestStatus = useChangeManualPunchRequestStatus();
  const session = useSession();

  const requests = manualRequests.data?.manualPunchRequests ?? [];

  const openManualRequestDialog = () => {
    setForm({ ...initialRequestForm, requestedPunchTime: toDateTimeLocal() });
    setDialogOpen(true);
  };

  const handleDocumentChange = (file: File | null) => {
    if (!file) {
      setForm((current) => ({
        ...current,
        supportingDocumentName: '',
        supportingDocumentUrl: '',
        supportingDocumentMimeType: '',
        supportingDocumentSize: 0,
      }));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) => ({
        ...current,
        supportingDocumentName: file.name,
        supportingDocumentUrl: String(reader.result ?? ''),
        supportingDocumentMimeType: file.type,
        supportingDocumentSize: file.size,
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveManualRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await createManualRequest.mutateAsync({
        requestedPunchTime: toIso(form.requestedPunchTime),
        requestedPunchType: form.requestedPunchType,
        reason: form.reason.trim(),
        supportingDocumentName: form.supportingDocumentName || null,
        supportingDocumentUrl: form.supportingDocumentUrl || null,
        supportingDocumentMimeType: form.supportingDocumentMimeType || null,
        supportingDocumentSize: form.supportingDocumentSize || null,
      });

      setDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: t('manualPunchRequestCreated'),
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

  const changeRequestStatus = async (
    request: ManualPunchRequest,
    status: 'SUPERVISOR_APPROVED' | 'SUPERVISOR_REJECTED',
  ) => {
    try {
      await changeManualRequestStatus.mutateAsync({
        manualPunchRequestId: request.id,
        status,
        rejectedAt: status === 'SUPERVISOR_REJECTED' ? new Date().toISOString() : undefined,
      });

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
                    <TableHead>{t('supportingDocument')}</TableHead>
                    <TableHead>{t('reason')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    {isSupervisor ? <TableHead className="text-right">{t('actions')}</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const canApprove = isSupervisor
                      && canSupervisorDecide(request.status)
                      && request.employee?.userId !== session.data?.user?.id;

                    return (
                      <TableRow key={request.id}>
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
                        <TableCell>
                          {request.supportingDocumentUrl ? (
                            <a href={request.supportingDocumentUrl} download={request.supportingDocumentName ?? undefined} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                              <FileText className="size-3.5" />
                              {request.supportingDocumentName ?? t('supportingDocument')}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={requestStatusVariant(request.status) as any}>{request.status}</Badge>
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
                                <Button type="button" size="sm" variant="outline" onClick={() => changeRequestStatus(request, 'SUPERVISOR_REJECTED')} disabled={changeManualRequestStatus.isPending}>
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
                        ) : null}
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('requestAttendanceCorrection')}</DialogTitle>
              <DialogDescription>{t('manualPunchRequestFormDescription')}</DialogDescription>
            </DialogHeader>
            <form className="space-y-4" onSubmit={saveManualRequest}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('punchTime')} id="request-time">
                  <CalendarDateTimeField id="request-time" value={form.requestedPunchTime} onChange={(requestedPunchTime) => setForm((current) => ({ ...current, requestedPunchTime }))} required />
                </Field>
                <Field label={t('punchType')} id="request-type">
                  <Select value={form.requestedPunchType} onValueChange={(value) => setForm((current) => ({ ...current, requestedPunchType: value as PunchType }))}>
                    <SelectTrigger id="request-type"><SelectValue placeholder={t('selectPunchType')} /></SelectTrigger>
                    <SelectContent>{punchTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label={t('reason')} id="request-reason">
                <Textarea id="request-reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
              </Field>
              <Field label={t('supportingDocument')} id="request-document">
                <Input id="request-document" type="file" onChange={(event) => handleDocumentChange(event.target.files?.[0] ?? null)} />
                {form.supportingDocumentName ? (
                  <p className="text-xs text-muted-foreground">{form.supportingDocumentName}</p>
                ) : null}
              </Field>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
                <Button type="submit" disabled={createManualRequest.isPending || !form.requestedPunchTime || !form.reason.trim()}>
                  {createManualRequest.isPending ? t('saving') : common('save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
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
  return status === 'PENDING_HR_REVIEW' || status === 'HR_REVIEWED' || status === 'PENDING';
}
