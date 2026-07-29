'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Check, ClipboardPlus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  useChangeManualPunchRequestStatus,
  useCreateManualPunchRequest,
  useEmployees,
  useManualPunchRequests,
} from '@/data/hooks/core.hooks';
import { useUsers } from '@/data/hooks/users.hooks';
import type { Employee, ManualPunchRequest, PunchType } from '@/data/types/core.types';
import type { User } from '@/data/types/api';
import { notifications } from '@/lib/notifications';

const punchTypes: PunchType[] = ['IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN'];
const allEmployeesValue = '__all';
const noUserValue = '__none';

const initialRequestForm = {
  employeeId: '',
  requestedBy: '',
  requestedPunchTime: '',
  requestedPunchType: 'UNKNOWN' as PunchType,
  reason: '',
};

function toDateTimeLocal(date = new Date()) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return new Date(value).toISOString();
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function userName(user?: User | null) {
  if (!user) return '';
  return user.name || user.email;
}

function requestStatusVariant(status: ManualPunchRequest['status']) {
  if (status === 'APPROVED') return 'default';
  if (status === 'REJECTED') return 'destructive';
  return 'secondary';
}

export default function ManualPunchRequestsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reviewerUserId, setReviewerUserId] = useState('');
  const [form, setForm] = useState({ ...initialRequestForm, requestedPunchTime: toDateTimeLocal() });

  const manualRequests = useManualPunchRequests();
  const { data: employeesResponse } = useEmployees();
  const { data: usersResponse } = useUsers({}, { pageSize: 100 });
  const createManualRequest = useCreateManualPunchRequest();
  const changeManualRequestStatus = useChangeManualPunchRequestStatus();

  const employees = employeesResponse?.employees ?? [];
  const users = usersResponse?.users ?? [];
  const requests = manualRequests.data?.manualPunchRequests ?? [];
  const pendingRequests = useMemo(() => requests.filter((request) => request.status === 'PENDING'), [requests]);
  const approvedRequests = useMemo(() => requests.filter((request) => request.status === 'APPROVED'), [requests]);
  const rejectedRequests = useMemo(() => requests.filter((request) => request.status === 'REJECTED'), [requests]);

  const openManualRequestDialog = () => {
    setForm({ ...initialRequestForm, requestedPunchTime: toDateTimeLocal() });
    setDialogOpen(true);
  };

  const handleRequestEmployeeChange = (nextEmployeeId: string) => {
    const employee = employees.find((item) => item.id === nextEmployeeId);
    setForm((current) => ({
      ...current,
      employeeId: nextEmployeeId,
      requestedBy: employee?.userId ?? current.requestedBy,
    }));
  };

  const saveManualRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await createManualRequest.mutateAsync({
        employeeId: form.employeeId,
        requestedPunchTime: toIso(form.requestedPunchTime),
        requestedPunchType: form.requestedPunchType,
        reason: form.reason.trim(),
        requestedBy: form.requestedBy,
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

  const changeRequestStatus = async (request: ManualPunchRequest, status: 'APPROVED' | 'REJECTED') => {
    if (!reviewerUserId) {
      notifications.show({
        title: common('error'),
        message: t('selectReviewer'),
        color: 'red',
      });
      return;
    }

    try {
      await changeManualRequestStatus.mutateAsync({
        manualPunchRequestId: request.id,
        status,
        approvedBy: status === 'APPROVED' ? reviewerUserId : undefined,
        rejectedBy: status === 'REJECTED' ? reviewerUserId : undefined,
        rejectedAt: status === 'REJECTED' ? new Date().toISOString() : undefined,
      });

      notifications.show({
        title: common('success'),
        message: status === 'APPROVED' ? t('manualPunchRequestApproved') : t('manualPunchRequestRejected'),
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid gap-2 sm:grid-cols-3">
          <Summary label={t('pendingRequests')} value={pendingRequests.length} />
          <Summary label={t('approved')} value={approvedRequests.length} />
          <Summary label={t('rejected')} value={rejectedRequests.length} />
        </div>
        <Button onClick={openManualRequestDialog}>
          <ClipboardPlus className="size-4" />
          {t('requestManualPunch')}
        </Button>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{t('manualPunchRequests')}</CardTitle>
            <CardDescription>{t('manualPunchRequestsDescription')}</CardDescription>
          </div>
          <Select value={reviewerUserId || noUserValue} onValueChange={(value) => setReviewerUserId(value === noUserValue ? '' : value)}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder={t('selectReviewer')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={noUserValue}>{t('selectReviewer')}</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {userName(user)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {manualRequests.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : requests.length === 0 ? (
            <EmptyState icon={ClipboardPlus} title={t('noManualPunchRequests')} description={t('noManualPunchRequestsDescription')} />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('punchTime')}</TableHead>
                    <TableHead>{t('punchType')}</TableHead>
                    <TableHead>{t('reason')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{employeeName(request.employee) || t('unknown')}</p>
                          <p className="truncate text-xs text-muted-foreground">{request.employee?.employeeCode ?? '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(request.requestedPunchTime)}</TableCell>
                      <TableCell><Badge variant="secondary">{request.requestedPunchType}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate">{request.reason}</TableCell>
                      <TableCell><Badge variant={requestStatusVariant(request.status) as any}>{request.status}</Badge></TableCell>
                      <TableCell>
                        {request.status === 'PENDING' ? (
                          <div className="flex justify-end gap-2">
                            <Button type="button" size="sm" onClick={() => changeRequestStatus(request, 'APPROVED')} disabled={changeManualRequestStatus.isPending}>
                              <Check className="size-4" />
                              {t('approve')}
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => changeRequestStatus(request, 'REJECTED')} disabled={changeManualRequestStatus.isPending}>
                              <X className="size-4" />
                              {t('reject')}
                            </Button>
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-muted-foreground">
                            {request.status === 'APPROVED' ? formatDateTime(request.approvedAt) : formatDateTime(request.rejectedAt)}
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('requestManualPunch')}</DialogTitle>
            <DialogDescription>{t('manualPunchRequestFormDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveManualRequest}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('employee')} id="request-employee">
                <Select value={form.employeeId || allEmployeesValue} onValueChange={(value) => handleRequestEmployeeChange(value === allEmployeesValue ? '' : value)}>
                  <SelectTrigger id="request-employee"><SelectValue placeholder={t('selectEmployee')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allEmployeesValue}>{t('selectEmployee')}</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employeeName(employee)} · {employee.employeeCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('requestedBy')} id="request-user">
                <Select value={form.requestedBy || noUserValue} onValueChange={(value) => setForm((current) => ({ ...current, requestedBy: value === noUserValue ? '' : value }))}>
                  <SelectTrigger id="request-user"><SelectValue placeholder={t('requestedBy')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noUserValue}>{t('requestedBy')}</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>{userName(user)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('punchTime')} id="request-time">
                <Input id="request-time" type="datetime-local" value={form.requestedPunchTime} onChange={(event) => setForm((current) => ({ ...current, requestedPunchTime: event.target.value }))} required />
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={createManualRequest.isPending || !form.employeeId || !form.requestedBy || !form.requestedPunchTime || !form.reason.trim()}>
                {createManualRequest.isPending ? t('saving') : common('save')}
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

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
