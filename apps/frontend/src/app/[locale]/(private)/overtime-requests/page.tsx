'use client';

import { FormEvent, useState } from 'react';
import { Check, Clock3, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  useChangeOvertimeRequestStatus,
  useCreateOvertimeRequest,
  useEmployees,
  useOvertimeRequests,
} from '@/data/hooks/core.hooks';
import type { Employee, OvertimeRequest, OvertimeRequestStatus } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { useSession } from '@/lib/auth-client';

const allStatuses = '__all';
const statuses: OvertimeRequestStatus[] = ['PENDING', 'APPROVED', 'REJECTED'];

const initialForm = {
  employeeId: '',
  overtimeDate: new Date().toISOString().slice(0, 10),
  startAt: toDateTimeLocal(new Date()),
  endAt: toDateTimeLocal(new Date(Date.now() + 60 * 60_000)),
  reason: '',
};

function toDateTimeLocal(date: Date) {
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

function requestStatusVariant(status: OvertimeRequestStatus) {
  if (status === 'APPROVED') return 'default';
  if (status === 'REJECTED') return 'destructive';
  return 'secondary';
}

function minutesToDays(minutes: number) {
  return Math.round((minutes / 480) * 100) / 100;
}

export default function OvertimeRequestsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState(initialForm);

  const overtimeRequests = useOvertimeRequests({ dateFrom, dateTo, status });
  const createOvertimeRequest = useCreateOvertimeRequest();
  const changeOvertimeRequestStatus = useChangeOvertimeRequestStatus();
  const employeesQuery = useEmployees();
  const session = useSession();

  const employees = employeesQuery.data?.employees ?? [];
  const requests = overtimeRequests.data?.overtimeRequests ?? [];

  const saveRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createOvertimeRequest.mutateAsync({
        employeeId: form.employeeId,
        overtimeDate: form.overtimeDate,
        startAt: toIso(form.startAt),
        endAt: toIso(form.endAt),
        reason: form.reason.trim(),
      });
      setDialogOpen(false);
      setForm(initialForm);
      notifications.show({ title: common('success'), message: t('overtimeRequestCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const reviewRequest = async (request: OvertimeRequest, nextStatus: 'APPROVED' | 'REJECTED') => {
    try {
      await changeOvertimeRequestStatus.mutateAsync({
        overtimeRequestId: request.id,
        status: nextStatus,
        approvedMinutes: nextStatus === 'APPROVED' ? request.requestedMinutes : undefined,
        overtimeDays: nextStatus === 'APPROVED' ? minutesToDays(request.requestedMinutes) : undefined,
        rejectedAt: nextStatus === 'REJECTED' ? new Date().toISOString() : undefined,
      });
      notifications.show({
        title: common('success'),
        message: nextStatus === 'APPROVED' ? t('overtimeRequestApproved') : t('overtimeRequestRejected'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          {t('requestOvertime')}
        </Button>
      </div>

      <Card className="rounded-lg">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{t('overtimeRequests')}</CardTitle>
            <CardDescription>{t('overtimeRequestsDescription')}</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9 w-40" />
            <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9 w-40" />
            <Select value={status || allStatuses} onValueChange={(value) => setStatus(value === allStatuses ? '' : value)}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allStatuses}>{t('allStatuses')}</SelectItem>
                {statuses.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {overtimeRequests.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : requests.length === 0 ? (
            <EmptyState icon={Clock3} title={t('noOvertimeRequests')} description={t('noOvertimeRequestsDescription')} />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('period')}</TableHead>
                    <TableHead>{t('requested')}</TableHead>
                    <TableHead>{t('approved')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const isOwnRequest = request.employee?.userId === session.data?.user?.id;

                    return (
                      <TableRow key={request.id}>
                        <TableCell>
                          <p className="font-medium">{employeeName(request.employee) || t('unknown')}</p>
                          <p className="text-xs text-muted-foreground">{request.employee?.employeeCode ?? '-'}</p>
                        </TableCell>
                        <TableCell>{request.overtimeDate}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(request.startAt)} - {formatDateTime(request.endAt)}</TableCell>
                        <TableCell>{request.requestedMinutes} min</TableCell>
                        <TableCell>{request.approvedMinutes} min / {request.overtimeDays} days</TableCell>
                        <TableCell><Badge variant={requestStatusVariant(request.status) as any}>{request.status}</Badge></TableCell>
                        <TableCell>
                          {request.status === 'PENDING' && !isOwnRequest ? (
                            <div className="flex justify-end gap-2">
                              <Button type="button" size="sm" onClick={() => reviewRequest(request, 'APPROVED')} disabled={changeOvertimeRequestStatus.isPending}>
                                <Check className="size-4" />
                                {t('approve')}
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={() => reviewRequest(request, 'REJECTED')} disabled={changeOvertimeRequestStatus.isPending}>
                                <X className="size-4" />
                                {t('reject')}
                              </Button>
                            </div>
                          ) : (
                            <span className="block text-right text-xs text-muted-foreground">
                              {request.status === 'APPROVED' ? formatDateTime(request.approvedAt) : request.status === 'REJECTED' ? formatDateTime(request.rejectedAt) : '-'}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('requestOvertime')}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveRequest}>
            <div className="space-y-2">
              <Label>{t('employee')}</Label>
              <Select value={form.employeeId} onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectEmployee')} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.employeeCode} - {employeeName(employee)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t('date')} type="date" value={form.overtimeDate} onChange={(value) => setForm((current) => ({ ...current, overtimeDate: value }))} />
              <Field label={t('startTime')} type="datetime-local" value={form.startAt} onChange={(value) => setForm((current) => ({ ...current, startAt: value }))} />
              <Field label={t('endTime')} type="datetime-local" value={form.endAt} onChange={(value) => setForm((current) => ({ ...current, endAt: value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('reason')}</Label>
              <Textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={!form.employeeId || !form.reason.trim() || createOvertimeRequest.isPending}>
                {common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, type, onChange }: { label: string; value: string; type: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
    </div>
  );
}
