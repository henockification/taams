'use client';

import { FormEvent, useMemo, useState } from 'react';
import { AlertTriangle, Check, Clock3, Plus, X } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDateField } from '@/components/calendar/calendar-date-field';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { DelegationAuditBadge, DelegationBanner, delegatedActionLabel } from '@/components/supervisor/delegation-context';
import {
  useChangeOvertimeRequestStatus,
  useCreateOvertimeRequest,
  useEmployees,
  useOvertimeRequests,
} from '@/data/hooks/core.hooks';
import type {
  Employee,
  OvertimeAttendanceCoverage,
  OvertimeRequest,
  OvertimeRequestStatus,
} from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { useSession } from '@/lib/auth-client';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const allStatuses = '__all';
const statuses: OvertimeRequestStatus[] = ['ASSIGNED', 'APPROVED', 'REJECTED'];

const initialForm = {
  employeeIds: [] as string[],
  overtimeDate: new Date().toISOString().slice(0, 10),
  startTime: '17:00',
  endTime: '19:00',
  reason: '',
};

export function OvertimeAssignmentsPage({ mode }: { mode: 'employee' | 'supervisor' }) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate, formatDateTime } = useCalendarPreference();
  const isSupervisor = mode === 'supervisor';
  const [assignOpen, setAssignOpen] = useState(false);
  const [reviewing, setReviewing] = useState<OvertimeRequest | null>(null);
  const [approvedMinutes, setApprovedMinutes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [form, setForm] = useState(initialForm);

  const overtimeRequests = useOvertimeRequests({ dateFrom, dateTo, status, mine: !isSupervisor });
  const createOvertimeRequest = useCreateOvertimeRequest();
  const changeOvertimeRequestStatus = useChangeOvertimeRequestStatus();
  const employeesQuery = useEmployees(isSupervisor);
  const session = useSession();

  const employees = employeesQuery.data?.employees ?? [];
  const requests = overtimeRequests.data?.overtimeRequests ?? [];
  const assignableEmployees = useMemo(
    () => employees.filter((employee) => employee.userId !== session.data?.user?.id),
    [employees, session.data?.user?.id],
  );

  const saveAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const window = toIsoWindow(form.overtimeDate, form.startTime, form.endTime);
      await createOvertimeRequest.mutateAsync({
        employeeIds: form.employeeIds,
        overtimeDate: form.overtimeDate,
        startAt: window.startAt,
        endAt: window.endAt,
        reason: form.reason.trim(),
      });
      setAssignOpen(false);
      setForm(initialForm);
      notifications.show({ title: common('success'), message: t('overtimeAssignmentCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const openReview = (request: OvertimeRequest) => {
    setReviewing(request);
    setApprovedMinutes(String(request.requestedMinutes));
    setRejectionReason('');
  };

  const reviewRequest = async (nextStatus: 'APPROVED' | 'REJECTED') => {
    if (!reviewing) return;
    try {
      const minutes = Math.floor(Number(approvedMinutes));
      await changeOvertimeRequestStatus.mutateAsync({
        overtimeRequestId: reviewing.id,
        status: nextStatus,
        approvedMinutes: nextStatus === 'APPROVED' ? minutes : undefined,
        overtimeDays: nextStatus === 'APPROVED' ? minutesToDays(minutes) : undefined,
        rejectedAt: nextStatus === 'REJECTED' ? new Date().toISOString() : undefined,
        rejectionReason: nextStatus === 'REJECTED' ? rejectionReason.trim() || undefined : undefined,
      });
      notifications.show({
        title: common('success'),
        message: nextStatus === 'APPROVED' ? t('overtimeAssignmentApproved') : t('overtimeAssignmentRejected'),
        color: 'green',
      });
      setReviewing(null);
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const evidence = reviewing?.attendanceEvidence;
  const coverageMismatch = evidence && evidence.coverage !== 'COVERED';

  return (
    <div className="flex w-full flex-col gap-6">
      {isSupervisor ? <DelegationBanner user={session.data?.user} /> : null}

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <CalendarDateField value={dateFrom} onChange={setDateFrom} className="h-9 w-44" />
          <CalendarDateField value={dateTo} onChange={setDateTo} className="h-9 w-44" />
          <Select value={status || allStatuses} onValueChange={(value) => setStatus(value === allStatuses ? '' : value)}>
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allStatuses}>{t('allStatuses')}</SelectItem>
              {statuses.map((item) => (
                <SelectItem key={item} value={item}>{t(overtimeStatusKey(item))}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isSupervisor ? (
          <Button onClick={() => setAssignOpen(true)} className="w-full lg:w-auto">
            <Plus className="size-4" />
            {delegatedActionLabel(t('assignOvertime'), session.data?.user)}
          </Button>
        ) : null}
      </div>

      <Card className="rounded-lg">
        <CardContent>
          {overtimeRequests.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : requests.length === 0 ? (
            <EmptyState
              icon={Clock3}
              title={t('noOvertimeRequests')}
              description={isSupervisor ? t('noOvertimeRequestsDescription') : t('noMyOvertimeAssignmentsDescription')}
            />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {isSupervisor ? <TableHead>{t('employee')}</TableHead> : null}
                    <TableHead>{t('date')}</TableHead>
                    <TableHead>{t('period')}</TableHead>
                    <TableHead>{t('assignedMinutes')}</TableHead>
                    <TableHead>{t('punchCoverage')}</TableHead>
                    <TableHead>{t('overlapMinutes')}</TableHead>
                    <TableHead>{t('approved')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    {isSupervisor ? <TableHead className="text-right">{t('actions')}</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => {
                    const coverage = request.attendanceEvidence?.coverage ?? 'NONE';

                    return (
                      <TableRow key={request.id}>
                        {isSupervisor ? (
                          <TableCell>
                            <p className="font-medium">{employeeName(request.employee) || t('unknown')}</p>
                            <p className="text-xs text-muted-foreground">{request.employee?.employeeCode ?? '-'}</p>
                          </TableCell>
                        ) : null}
                        <TableCell>{formatDate(request.overtimeDate)}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateTime(request.startAt)} - {formatDateTime(request.endAt)}</TableCell>
                        <TableCell>{request.requestedMinutes} min</TableCell>
                        <TableCell>
                          <Badge variant={coverageVariant(coverage) as any}>{t(coverageKey(coverage))}</Badge>
                        </TableCell>
                        <TableCell>{request.attendanceEvidence?.overlapMinutes ?? 0} min</TableCell>
                        <TableCell>{request.approvedMinutes} min / {request.overtimeDays} {t('days')}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge variant={requestStatusVariant(request.status) as any}>{t(overtimeStatusKey(request.status))}</Badge>
                            <DelegationAuditBadge delegationId={request.supervisorDelegationId ?? request.requestedSupervisorDelegationId} />
                          </div>
                        </TableCell>
                        {isSupervisor ? (
                          <TableCell>
                            {request.status === 'ASSIGNED' && request.employee?.userId !== session.data?.user?.id ? (
                              <div className="flex justify-end">
                                <Button type="button" size="sm" variant="outline" onClick={() => openReview(request)}>
                                  {t('review')}
                                </Button>
                              </div>
                            ) : (
                              <span className="block text-right text-xs text-muted-foreground">
                                {request.status === 'APPROVED' ? formatDateTime(request.approvedAt) : request.status === 'REJECTED' ? formatDateTime(request.rejectedAt) : '-'}
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

      {isSupervisor ? (
        <>
          <Dialog open={assignOpen} onOpenChange={(open) => { setAssignOpen(open); if (!open) setForm(initialForm); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('assignOvertime')}</DialogTitle>
              </DialogHeader>
              <form className="space-y-4" onSubmit={saveAssignment}>
                <div className="space-y-2">
                  <Label>{t('selectEmployees')}</Label>
                  <MultiSelect
                    key={String(assignOpen)}
                    options={assignableEmployees.map((employee) => ({
                      label: `${employee.employeeCode} - ${employeeName(employee)}`,
                      value: employee.id,
                    }))}
                    defaultValue={[]}
                    onValueChange={(employeeIds) => setForm((current) => ({ ...current, employeeIds }))}
                    placeholder={t('selectEmployees')}
                    modalPopover
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label={t('date')} type="date" value={form.overtimeDate} onChange={(value) => setForm((current) => ({ ...current, overtimeDate: value }))} />
                  <Field label={t('startTime')} type="time" value={form.startTime} onChange={(value) => setForm((current) => ({ ...current, startTime: value }))} />
                  <Field label={t('endTime')} type="time" value={form.endTime} onChange={(value) => setForm((current) => ({ ...current, endTime: value }))} />
                </div>
                <div className="space-y-2">
                  <Label>{t('reason')}</Label>
                  <Textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>{common('cancel')}</Button>
                  <Button type="submit" disabled={form.employeeIds.length === 0 || !form.reason.trim() || createOvertimeRequest.isPending}>
                    {common('save')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(reviewing)} onOpenChange={(open) => { if (!open) setReviewing(null); }}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{t('reviewOvertime')}</DialogTitle>
              </DialogHeader>
              {reviewing ? (
                <div className="space-y-4">
                  <div className="grid gap-2 text-sm">
                    <p><span className="text-muted-foreground">{t('employee')}: </span>{employeeName(reviewing.employee)}</p>
                    <p><span className="text-muted-foreground">{t('date')}: </span>{formatDate(reviewing.overtimeDate)}</p>
                    <p><span className="text-muted-foreground">{t('period')}: </span>{formatDateTime(reviewing.startAt)} - {formatDateTime(reviewing.endAt)}</p>
                    <p><span className="text-muted-foreground">{t('assignedMinutes')}: </span>{reviewing.requestedMinutes}</p>
                    <p>
                      <span className="text-muted-foreground">{t('punchCoverage')}: </span>
                      <Badge variant={coverageVariant(evidence?.coverage ?? 'NONE') as any}>{t(coverageKey(evidence?.coverage ?? 'NONE'))}</Badge>
                    </p>
                    <p><span className="text-muted-foreground">{t('overlapMinutes')}: </span>{evidence?.overlapMinutes ?? 0}</p>
                  </div>

                  {coverageMismatch ? (
                    <Alert>
                      <AlertTriangle />
                      <AlertDescription>{t('overtimeCoverageWarning')}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="space-y-2">
                    <Label>{t('attendancePunches')}</Label>
                    {evidence?.punches?.length ? (
                      <div className="overflow-hidden rounded-md border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t('punchTime')}</TableHead>
                              <TableHead>{t('punchType')}</TableHead>
                              <TableHead>{t('source')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {evidence.punches.map((punch) => (
                              <TableRow key={punch.id}>
                                <TableCell>{formatTime(punch.punchTime)}</TableCell>
                                <TableCell>{punch.punchType}</TableCell>
                                <TableCell>{punch.source}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t('noOvertimePunches')}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('approvedMinutes')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={reviewing.requestedMinutes}
                      value={approvedMinutes}
                      onChange={(event) => setApprovedMinutes(event.target.value)}
                    />
                    {evidence && evidence.overlapMinutes > 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setApprovedMinutes(String(Math.min(evidence.overlapMinutes, reviewing.requestedMinutes)))}
                      >
                        {t('useOverlapMinutes')}
                      </Button>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <Label>{t('rejectionReason')}</Label>
                    <Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setReviewing(null)}>{common('cancel')}</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => reviewRequest('REJECTED')}
                      disabled={changeOvertimeRequestStatus.isPending}
                    >
                      <X className="size-4" />
                      {delegatedActionLabel(t('reject'), session.data?.user)}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => reviewRequest('APPROVED')}
                      disabled={changeOvertimeRequestStatus.isPending || Number(approvedMinutes) <= 0}
                    >
                      <Check className="size-4" />
                      {delegatedActionLabel(t('approve'), session.data?.user)}
                    </Button>
                  </DialogFooter>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}

function Field({ label, value, type, onChange }: { label: string; value: string; type: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {type === 'date' ? (
        <CalendarDateField value={value} onChange={onChange} required />
      ) : (
        <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required />
      )}
    </div>
  );
}

function toIsoWindow(date: string, startTime: string, endTime: string) {
  const startAt = new Date(`${date}T${normalizeTime(startTime)}`);
  let endAt = new Date(`${date}T${normalizeTime(endTime)}`);
  if (!(startAt < endAt)) {
    endAt = new Date(endAt.getTime() + 24 * 60 * 60 * 1000);
  }
  return { startAt: startAt.toISOString(), endAt: endAt.toISOString() };
}

function normalizeTime(value: string) {
  return value.length === 5 ? `${value}:00` : value;
}

function formatTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function coverageVariant(coverage: OvertimeAttendanceCoverage) {
  if (coverage === 'COVERED') return 'default';
  if (coverage === 'PARTIAL') return 'secondary';
  if (coverage === 'UPCOMING') return 'outline';
  return 'destructive';
}

function minutesToDays(minutes: number) {
  return Math.round((minutes / 480) * 100) / 100;
}

function overtimeStatusKey(status: OvertimeRequestStatus) {
  if (status === 'ASSIGNED') return 'assigned';
  if (status === 'APPROVED') return 'approved';
  return 'rejected';
}

function coverageKey(coverage: OvertimeAttendanceCoverage) {
  if (coverage === 'COVERED') return 'coverageCovered';
  if (coverage === 'PARTIAL') return 'coveragePartial';
  if (coverage === 'UPCOMING') return 'coverageUpcoming';
  return 'coverageNone';
}
