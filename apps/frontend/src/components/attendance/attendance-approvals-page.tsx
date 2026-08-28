'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, RotateCcw, ScanLine } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { DelegationAuditBadge, DelegationBanner, delegatedActionLabel } from '@/components/supervisor/delegation-context';
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
} from '@/data/hooks/core.hooks';
import type { AttendanceDailyRecord, AttendanceDailyRecordStatus, Employee } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { useSession } from '@/lib/auth-client';

type AttendanceApprovalMode = 'supervisor' | 'hr';
type ApprovalFilter = 'all' | 'approved' | 'unapproved';
const allDepartmentsValue = '__all_departments';

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
  const [returnReason, setReturnReason] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(allDepartmentsValue);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('all');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  const supervisorQuery = useSupervisorAttendanceDailyRecords(date);
  const hrQuery = useHrAttendanceDailyRecords(date);
  const generateRecords = useGenerateAttendanceDailyRecords();
  const supervisorApprove = useSupervisorApproveAttendanceDailyRecord();
  const hrApprove = useHrApproveAttendanceDailyRecord();
  const returnRecord = useReturnAttendanceDailyRecord();
  const session = useSession();
  const query = mode === 'supervisor' ? supervisorQuery : hrQuery;
  const records = query.data?.attendanceDailyRecords ?? [];
  const summary = useMemo(() => summarize(records), [records]);
  const isHrMode = mode === 'hr';
  const departments = useMemo(() => {
    const byId = new Map<string, { id: string; nameEn: string }>();
    for (const record of records) {
      const department = record.effectiveDepartment ?? record.employee?.department;
      if (department?.id) byId.set(department.id, { id: department.id, nameEn: department.nameEn });
    }
    return [...byId.values()].sort((left, right) => left.nameEn.localeCompare(right.nameEn));
  }, [records]);
  const filteredRecords = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase();
    return records.filter((record) => {
      const employee = record.employee;
      const haystack = [
        employeeName(employee),
        employee?.employeeCode,
        employee?.payrollId,
        employee?.biometricId,
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesEmployee = !search || haystack.includes(search);
      const matchesDepartment = !isHrMode
        || departmentFilter === allDepartmentsValue
        || (record.effectiveDepartment?.id ?? employee?.departmentId) === departmentFilter;
      const matchesApproval = approvalFilter === 'all'
        || (approvalFilter === 'approved' && isAttendanceApproved(record, mode))
        || (approvalFilter === 'unapproved' && !isAttendanceApproved(record, mode));
      return matchesEmployee && matchesDepartment && matchesApproval;
    });
  }, [approvalFilter, departmentFilter, employeeSearch, isHrMode, mode, records]);
  const approvableRecords = useMemo(
    () => filteredRecords.filter((record) => canApprove(record, mode)),
    [filteredRecords, mode],
  );
  const selectedApprovableRecords = useMemo(
    () => approvableRecords.filter((record) => selectedRecordIds.includes(record.id)),
    [approvableRecords, selectedRecordIds],
  );
  const allVisibleApprovableSelected = approvableRecords.length > 0
    && approvableRecords.every((record) => selectedRecordIds.includes(record.id));

  async function handleRefresh() {
    try {
      await generateRecords.mutateAsync({ date });
      setSelectedRecordIds([]);
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
        setSelectedRecordIds((current) => current.filter((id) => id !== record.id));
        notifications.show({ title: common('success'), message: t('attendanceApproved'), color: 'green' });
      }
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  async function handleBatchApprove() {
    if (selectedApprovableRecords.length === 0) return;
    try {
      await Promise.all(selectedApprovableRecords.map((record) => supervisorApprove.mutateAsync(record.id)));
      setSelectedRecordIds([]);
      notifications.show({
        title: common('success'),
        message: `${selectedApprovableRecords.length} attendance record(s) approved.`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  function toggleRecordSelection(recordId: string, checked: boolean) {
    setSelectedRecordIds((current) => (
      checked ? [...new Set([...current, recordId])] : current.filter((id) => id !== recordId)
    ));
  }

  function toggleVisibleApprovableRecords(checked: boolean) {
    setSelectedRecordIds((current) => {
      const visibleIds = new Set(approvableRecords.map((record) => record.id));
      if (!checked) return current.filter((id) => !visibleIds.has(id));
      return [...new Set([...current, ...visibleIds])];
    });
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
      {!isHrMode ? <DelegationBanner user={session.data?.user} /> : null}

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
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              type="search"
              value={employeeSearch}
              onChange={(event) => setEmployeeSearch(event.target.value)}
              placeholder={t('searchEmployee')}
              className="md:max-w-xs"
            />
            <Select value={approvalFilter} onValueChange={(value) => setApprovalFilter(value as ApprovalFilter)}>
              <SelectTrigger className="md:w-48">
                <SelectValue placeholder={t('approvalStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allApprovalStatuses')}</SelectItem>
                <SelectItem value="approved">{t('approved')}</SelectItem>
                <SelectItem value="unapproved">{t('unapproved')}</SelectItem>
              </SelectContent>
            </Select>
            {isHrMode ? (
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="md:w-64">
                  <SelectValue placeholder={t('selectDepartment')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={allDepartmentsValue}>{t('allDepartments')}</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>{department.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            {!isHrMode ? (
              <Button
                type="button"
                onClick={handleBatchApprove}
                disabled={selectedApprovableRecords.length === 0 || supervisorApprove.isPending}
                className="md:ml-auto"
              >
                <CheckCircle2 className="size-4" />
                {selectedApprovableRecords.length > 0
                  ? `${delegatedActionLabel(t('approve'), session.data?.user)} (${selectedApprovableRecords.length})`
                  : t('approveSelected')}
              </Button>
            ) : null}
          </div>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : records.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title={t('noAttendanceApprovals')}
              description={t('noAttendanceApprovalsDescription')}
            />
          ) : filteredRecords.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title={t('noAttendanceApprovals')}
              description={t('noMatchingAttendanceApprovalsDescription')}
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table className="min-w-[96rem]">
                <TableHeader>
                  <TableRow>
                    {!isHrMode ? (
                      <TableHead className="w-12">
                        <Checkbox
                          aria-label={t('selectAll')}
                          checked={allVisibleApprovableSelected ? true : selectedApprovableRecords.length > 0 ? 'indeterminate' : false}
                          disabled={approvableRecords.length === 0}
                          onCheckedChange={(checked) => toggleVisibleApprovableRecords(Boolean(checked))}
                        />
                      </TableHead>
                    ) : null}
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('department')}</TableHead>
                    <TableHead>{t('attendanceDate')}</TableHead>
                    <TableHead>{t('checkIn')}</TableHead>
                    <TableHead>{t('checkOut')}</TableHead>
                    <TableHead>{t('attendanceDays')}</TableHead>
                    <TableHead>{t('leaveDays')}</TableHead>
                    <TableHead>{t('holidayDays')}</TableHead>
                    <TableHead>{t('overtimeMinutes')}</TableHead>
                    <TableHead>{t('overtimeHours')}</TableHead>
                    <TableHead>{t('payableDays')}</TableHead>
                    <TableHead>{t('absenceDays')}</TableHead>
                    <TableHead>{t('approvalStatus')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRecords.map((record) => (
                    <TableRow key={record.id}>
                      {!isHrMode ? (
                        <TableCell>
                          <Checkbox
                            aria-label={`${t('selectAttendanceRecord')} ${employeeName(record.employee) || (record.employee?.employeeCode ?? '')}`}
                            checked={selectedRecordIds.includes(record.id)}
                            disabled={!canApprove(record, mode) || supervisorApprove.isPending}
                            onCheckedChange={(checked) => toggleRecordSelection(record.id, Boolean(checked))}
                          />
                        </TableCell>
                      ) : null}
                      <TableCell className="min-w-56">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{employeeName(record.employee) || t('unknown')}</p>
                          <p className="truncate text-xs text-muted-foreground">{record.employee?.employeeCode ?? '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-56">
                        <div className="flex flex-col gap-1">
                          <span className="whitespace-nowrap">
                            {record.effectiveDepartment?.nameEn ?? record.employee?.department?.nameEn ?? record.employee?.sourceDepartmentName ?? '-'}
                          </span>
                          {record.temporaryDepartmentAssignment ? (
                            <div className="flex flex-wrap items-center gap-1">
                              <Badge variant="outline">{t('temporarilyAssigned')}</Badge>
                              <span className="text-xs text-muted-foreground">
                                {t('homeDepartment')}: {record.temporaryDepartmentAssignment.sourceDepartment?.nameEn ?? record.employee?.department?.nameEn ?? '-'}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{record.attendanceDate}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(record.checkInAt)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(record.checkOutAt)}</TableCell>
                      <TableCell>{record.attendanceDays}</TableCell>
                      <TableCell>{record.leaveDays}</TableCell>
                      <TableCell>{record.holidayDays}</TableCell>
                      <TableCell>{record.overtimeMinutes ?? 0}</TableCell>
                      <TableCell>{record.overtimeHours ?? '0.00'}</TableCell>
                      <TableCell className="font-medium">{record.payableDays}</TableCell>
                      <TableCell>{record.absenceDays}</TableCell>
                      <TableCell>
                        <Badge variant={isAttendanceApproved(record, mode) ? 'default' : 'secondary'}>
                          {isAttendanceApproved(record, mode) ? t('approved') : t('unapproved')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge variant={statusVariant(record.status)}>{statusLabel(record.status, t)}</Badge>
                          {record.isBiometricExempt ? (
                            <Badge variant="outline">{t('biometricExempt')}</Badge>
                          ) : null}
                          {record.isHoliday ? (
                            <Badge variant="secondary">{record.holiday?.nameEn ?? t('holidayOffDay')}</Badge>
                          ) : null}
                          {record.returnReason ? (
                            <span className="max-w-56 truncate text-xs text-muted-foreground">{record.returnReason}</span>
                          ) : null}
                          {record.payrollNote ? (
                            <span className="max-w-64 text-xs text-muted-foreground">{record.payrollNote}</span>
                          ) : null}
                          <DelegationAuditBadge delegationId={record.supervisorDelegationId} />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleApprove(record)}
                            disabled={!canApprove(record, mode) || supervisorApprove.isPending || hrApprove.isPending}
                          >
                            <CheckCircle2 className="size-4" />
                            {isHrMode ? t('approveForPayroll') : delegatedActionLabel(t('approve'), session.data?.user)}
                          </Button>
                          {isHrMode ? (
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
                          ) : null}
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
              {returnRecord.isPending ? t('saving') : isHrMode ? t('returnAttendance') : delegatedActionLabel(t('returnAttendance'), session.data?.user)}
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

function isAttendanceApproved(record: AttendanceDailyRecord, mode: AttendanceApprovalMode) {
  if (mode === 'hr') return record.status === 'HR_APPROVED';
  return record.status === 'SUPERVISOR_APPROVED' || record.status === 'HR_APPROVED';
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
