'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, Pencil, RefreshCw, RotateCcw, ScanLine } from 'lucide-react';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useGenerateAttendanceDailyRecords,
  useHrApproveAttendanceDailyRecord,
  useHrAttendanceDailyRecords,
  useReturnAttendanceDailyRecord,
  useSupervisorApproveAttendanceDailyRecord,
  useSupervisorAttendanceDailyRecords,
  useUpdateSupervisorAttendanceDailyRecordPayroll,
} from '@/data/hooks/core.hooks';
import type { AttendanceDailyRecord, AttendanceDailyRecordStatus, Employee } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

type AttendanceApprovalMode = 'supervisor' | 'hr';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

export function AttendanceApprovalsPage({ mode }: { mode: AttendanceApprovalMode }) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const [date, setDate] = useState(today());
  const [returningRecord, setReturningRecord] = useState<AttendanceDailyRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<AttendanceDailyRecord | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [editForm, setEditForm] = useState({
    attendanceDays: '0.00',
    leaveDays: '0.00',
    payableDays: '0.00',
    payrollNote: '',
  });

  const supervisorQuery = useSupervisorAttendanceDailyRecords(date);
  const hrQuery = useHrAttendanceDailyRecords(date);
  const generateRecords = useGenerateAttendanceDailyRecords();
  const supervisorApprove = useSupervisorApproveAttendanceDailyRecord();
  const updatePayrollValues = useUpdateSupervisorAttendanceDailyRecordPayroll();
  const hrApprove = useHrApproveAttendanceDailyRecord();
  const returnRecord = useReturnAttendanceDailyRecord();
  const query = mode === 'supervisor' ? supervisorQuery : hrQuery;
  const records = query.data?.attendanceDailyRecords ?? [];
  const summary = useMemo(() => summarize(records), [records]);
  const isHrMode = mode === 'hr';

  async function handleRefresh() {
    try {
      await generateRecords.mutateAsync({ date });
      notifications.show({ title: common('success'), message: t('dailyRecordsRefreshed'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  async function handleApprove(record: AttendanceDailyRecord) {
    try {
      if (isHrMode) {
        await hrApprove.mutateAsync(record.id);
        notifications.show({ title: common('success'), message: t('hrAttendanceApproved'), color: 'green' });
      } else {
        await supervisorApprove.mutateAsync(record.id);
        notifications.show({ title: common('success'), message: t('attendanceApproved'), color: 'green' });
      }
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  function openEdit(record: AttendanceDailyRecord) {
    setEditingRecord(record);
    setEditForm({
      attendanceDays: record.attendanceDays,
      leaveDays: record.leaveDays,
      payableDays: record.payableDays,
      payrollNote: record.payrollNote ?? '',
    });
  }

  async function handleSaveEdit() {
    if (!editingRecord) return;

    try {
      await updatePayrollValues.mutateAsync({
        attendanceDailyRecordId: editingRecord.id,
        attendanceDays: editForm.attendanceDays,
        leaveDays: editForm.leaveDays,
        payableDays: editForm.payableDays,
        payrollNote: editForm.payrollNote.trim() || null,
      });
      setEditingRecord(null);
      notifications.show({ title: common('success'), message: t('attendanceUpdated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  async function handleReturn() {
    if (!returningRecord || !returnReason.trim()) return;

    try {
      await returnRecord.mutateAsync({
        attendanceDailyRecordId: returningRecord.id,
        reason: returnReason.trim(),
      });
      setReturningRecord(null);
      setReturnReason('');
      notifications.show({ title: common('success'), message: t('attendanceReturned'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{isHrMode ? t('hrAttendanceApproval') : t('attendanceApprovals')}</h1>
          <p className="text-sm text-muted-foreground">{isHrMode ? t('hrAttendanceApprovalDescription') : t('attendanceApprovalsDescription')}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="w-full sm:w-44"
          />
          <Button type="button" variant="outline" onClick={handleRefresh} disabled={generateRecords.isPending}>
            <RefreshCw className="size-4" />
            {t('generateDailyRecords')}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        <Summary label={t('pendingSupervisor')} value={summary.PENDING_SUPERVISOR} />
        <Summary label={t('returned')} value={summary.RETURNED} />
        <Summary label={t('supervisorApproved')} value={summary.SUPERVISOR_APPROVED} />
        <Summary label={t('payrollReady')} value={summary.HR_APPROVED} />
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{isHrMode ? t('hrAttendanceApproval') : t('attendanceApprovals')}</CardTitle>
          <CardDescription>{t('attendanceDate')}: {date}</CardDescription>
        </CardHeader>
        <CardContent>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : records.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title={t('noAttendanceApprovals')}
              description={t('noAttendanceApprovalsDescription')}
            />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('attendanceDate')}</TableHead>
                    <TableHead>{t('checkIn')}</TableHead>
                    <TableHead>{t('checkOut')}</TableHead>
                    <TableHead>{t('attendanceDays')}</TableHead>
                    <TableHead>{t('leaveDays')}</TableHead>
                    <TableHead>{t('payableDays')}</TableHead>
                    <TableHead>{t('absenceDays')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{employeeName(record.employee) || t('unknown')}</p>
                          <p className="truncate text-xs text-muted-foreground">{record.employee?.employeeCode ?? '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{record.attendanceDate}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(record.checkInAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(record.checkOutAt)}</TableCell>
                      <TableCell>{record.attendanceDays}</TableCell>
                      <TableCell>{record.leaveDays}</TableCell>
                      <TableCell className="font-medium">{record.payableDays}</TableCell>
                      <TableCell>{record.absenceDays}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={statusVariant(record.status)}>{statusLabel(record.status, t)}</Badge>
                          {record.isBiometricExempt ? (
                            <Badge variant="outline">{t('biometricExempt')}</Badge>
                          ) : null}
                          {record.returnReason ? (
                            <span className="max-w-56 truncate text-xs text-muted-foreground">{record.returnReason}</span>
                          ) : null}
                          {record.payrollNote ? (
                            <span className="max-w-64 text-xs text-muted-foreground">{record.payrollNote}</span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {!isHrMode ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(record)}
                              disabled={record.status === 'HR_APPROVED' || updatePayrollValues.isPending}
                            >
                              <Pencil className="size-4" />
                              {common('edit')}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleApprove(record)}
                            disabled={!canApprove(record, mode) || supervisorApprove.isPending || hrApprove.isPending}
                          >
                            <CheckCircle2 className="size-4" />
                            {isHrMode ? t('approveForPayroll') : t('approve')}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReturningRecord(record);
                              setReturnReason('');
                            }}
                            disabled={record.status === 'HR_APPROVED' || returnRecord.isPending}
                          >
                            <RotateCcw className="size-4" />
                            {t('returnAttendance')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(returningRecord)} onOpenChange={(open) => {
        if (!open) {
          setReturningRecord(null);
          setReturnReason('');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('returnAttendance')}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={returnReason}
            onChange={(event) => setReturnReason(event.target.value)}
            placeholder={t('returnReasonPlaceholder')}
            rows={4}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReturningRecord(null)}>{common('cancel')}</Button>
            <Button type="button" onClick={handleReturn} disabled={!returnReason.trim() || returnRecord.isPending}>
              {returnRecord.isPending ? t('saving') : t('returnAttendance')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingRecord)} onOpenChange={(open) => {
        if (!open) setEditingRecord(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editAttendance')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('adjustmentSourceTruthNotice')}</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t('attendanceDays')}</span>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={editForm.attendanceDays}
                onChange={(event) => setEditForm((current) => ({ ...current, attendanceDays: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t('leaveDays')}</span>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={editForm.leaveDays}
                onChange={(event) => setEditForm((current) => ({ ...current, leaveDays: event.target.value }))}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">{t('payableDays')}</span>
              <Input
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={editForm.payableDays}
                onChange={(event) => setEditForm((current) => ({ ...current, payableDays: event.target.value }))}
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">{t('payrollNote')}</span>
            <Textarea
              value={editForm.payrollNote}
              onChange={(event) => setEditForm((current) => ({ ...current, payrollNote: event.target.value }))}
              rows={3}
            />
          </label>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditingRecord(null)}>{common('cancel')}</Button>
            <Button type="button" onClick={handleSaveEdit} disabled={updatePayrollValues.isPending}>
              {updatePayrollValues.isPending ? t('saving') : common('save')}
            </Button>
          </DialogFooter>
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

function summarize(records: AttendanceDailyRecord[]) {
  return records.reduce<Record<AttendanceDailyRecordStatus, number>>((acc, record) => {
    acc[record.status] += 1;
    return acc;
  }, {
    PENDING_SUPERVISOR: 0,
    RETURNED: 0,
    SUPERVISOR_APPROVED: 0,
    HR_APPROVED: 0,
  });
}

function canApprove(record: AttendanceDailyRecord, mode: AttendanceApprovalMode) {
  if (mode === 'hr') return record.status === 'SUPERVISOR_APPROVED';
  return record.status === 'PENDING_SUPERVISOR' || record.status === 'RETURNED';
}

function statusLabel(status: AttendanceDailyRecordStatus, t: (key: string) => string) {
  switch (status) {
    case 'PENDING_SUPERVISOR':
      return t('pendingSupervisor');
    case 'RETURNED':
      return t('returned');
    case 'SUPERVISOR_APPROVED':
      return t('supervisorApproved');
    case 'HR_APPROVED':
      return t('hrApproved');
  }
}

function statusVariant(status: AttendanceDailyRecordStatus) {
  if (status === 'HR_APPROVED') return 'default';
  if (status === 'RETURNED') return 'destructive';
  return 'secondary';
}
