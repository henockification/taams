'use client';

import { type ReactNode, useDeferredValue, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw, RotateCcw, ScanLine } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CalendarDateField } from '@/components/calendar/calendar-date-field';
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
  useHrApproveAttendanceDailyRecords,
  useHrAttendanceDailyRecords,
  useReturnAttendanceDailyRecord,
  useSupervisorApproveAttendanceDailyRecord,
  useSupervisorApproveAttendanceDailyRecords,
  useSupervisorAttendanceDailyRecords,
} from '@/data/hooks/core.hooks';
import type { AttendanceDailyRecord, AttendanceDailyRecordStatus, Employee } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { useSession } from '@/lib/auth-client';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type AttendanceApprovalMode = 'supervisor' | 'hr';
type ApprovalFilter = 'all' | 'approved' | 'unapproved';
type DateFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM';
const allDepartmentsValue = '__all_departments';
const defaultPageSize = 50;

function dateToYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function today() {
  const now = new Date();
  return dateToYmd(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
}

function getDateFilterBounds(dateFilter: DateFilter, custom: { fromDate: string; toDate: string }) {
  if (dateFilter === 'CUSTOM') return custom;

  const now = new Date();
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(todayDate);

  if (dateFilter === 'TODAY') {
    return { fromDate: dateToYmd(todayDate), toDate: dateToYmd(end) };
  }

  if (dateFilter === 'THIS_WEEK') {
    const mondayOffset = (todayDate.getDay() + 6) % 7;
    const start = new Date(todayDate);
    start.setDate(todayDate.getDate() - mondayOffset);
    const weekEnd = new Date(start);
    weekEnd.setDate(start.getDate() + 6);
    return { fromDate: dateToYmd(start), toDate: dateToYmd(weekEnd) };
  }

  if (dateFilter === 'THIS_MONTH') {
    const start = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    end.setMonth(todayDate.getMonth() + 1, 0);
    return { fromDate: dateToYmd(start), toDate: dateToYmd(end) };
  }

  const start = new Date(todayDate.getFullYear(), 0, 1);
  end.setMonth(11, 31);
  return { fromDate: dateToYmd(start), toDate: dateToYmd(end) };
}

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

export function AttendanceApprovalsPage({ mode }: { mode: AttendanceApprovalMode }) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate, formatDateTime } = useCalendarPreference();
  const [dateFilter, setDateFilter] = useState<DateFilter>('TODAY');
  const [customDateFilters, setCustomDateFilters] = useState({ fromDate: today(), toDate: today() });
  const [returningRecord, setReturningRecord] = useState<AttendanceDailyRecord | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(allDepartmentsValue);
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>('all');
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const deferredEmployeeSearch = useDeferredValue(employeeSearch);

  const dateBounds = getDateFilterBounds(dateFilter, customDateFilters);
  const dateRange = {
    dateFrom: dateBounds.fromDate,
    dateTo: dateBounds.toDate,
  };
  const hasDateRange = Boolean(dateRange.dateFrom && dateRange.dateTo);
  const supervisorQuery = useSupervisorAttendanceDailyRecords(dateRange, mode === 'supervisor' && hasDateRange);
  const hrQuery = useHrAttendanceDailyRecords(dateRange, mode === 'hr' && hasDateRange);
  const generateRecords = useGenerateAttendanceDailyRecords();
  const supervisorApprove = useSupervisorApproveAttendanceDailyRecord();
  const supervisorBatchApprove = useSupervisorApproveAttendanceDailyRecords();
  const hrApprove = useHrApproveAttendanceDailyRecord();
  const hrBatchApprove = useHrApproveAttendanceDailyRecords();
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
    const search = deferredEmployeeSearch.trim().toLowerCase();
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
  }, [approvalFilter, departmentFilter, deferredEmployeeSearch, isHrMode, mode, records]);
  const approvableRecords = useMemo(
    () => filteredRecords.filter((record) => canApprove(record, mode)),
    [filteredRecords, mode],
  );
  const selectedApprovableRecords = useMemo(
    () => approvableRecords.filter((record) => selectedRecordIds.includes(record.id)),
    [approvableRecords, selectedRecordIds],
  );
  const pageCount = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageRecords = useMemo(
    () => filteredRecords.slice(pageStart, pageStart + pageSize),
    [filteredRecords, pageSize, pageStart],
  );
  const pageApprovableRecords = useMemo(
    () => pageRecords.filter((record) => canApprove(record, mode)),
    [mode, pageRecords],
  );
  const selectedPageRecordCount = pageApprovableRecords.filter((record) => selectedRecordIds.includes(record.id)).length;
  const allVisibleApprovableSelected = pageApprovableRecords.length > 0
    && selectedPageRecordCount === pageApprovableRecords.length;

  async function handleRefresh() {
    try {
      await generateRecords.mutateAsync(dateRange);
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
        setSelectedRecordIds((current) => current.filter((id) => id !== record.id));
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
      const recordIds = selectedApprovableRecords.map((record) => record.id);
      const result = isHrMode
        ? await hrBatchApprove.mutateAsync(recordIds)
        : await supervisorBatchApprove.mutateAsync(recordIds);
      setSelectedRecordIds([]);
      notifications.show({
        title: common('success'),
        message: t('attendanceRecordsApproved', { count: result.recordCount }),
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
      const visibleIds = new Set(pageApprovableRecords.map((record) => record.id));
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
    <div className="flex w-full flex-col gap-6">
      {!isHrMode ? <DelegationBanner user={session.data?.user} /> : null}

      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-2">
          <FilterField label={t('attendanceDate')} htmlFor="attendance-approval-date-filter">
            <Select
              value={dateFilter}
              onValueChange={(value) => {
                const nextFilter = value as DateFilter;
                setDateFilter(nextFilter);
                setSelectedRecordIds([]);
                setPage(1);
                if (nextFilter === 'CUSTOM') {
                  const current = today();
                  setCustomDateFilters({ fromDate: current, toDate: current });
                }
              }}
            >
              <SelectTrigger id="attendance-approval-date-filter" className="w-full md:w-44">
                <SelectValue placeholder={t('today')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAY">{t('today')}</SelectItem>
                <SelectItem value="THIS_WEEK">{t('thisWeek')}</SelectItem>
                <SelectItem value="THIS_MONTH">{t('thisMonth')}</SelectItem>
                <SelectItem value="THIS_YEAR">{t('thisYear')}</SelectItem>
                <SelectItem value="CUSTOM">{t('customRange')}</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          {dateFilter === 'CUSTOM' ? (
            <>
              <FilterField label={t('dateFrom')} htmlFor="attendance-approval-date-from">
                <CalendarDateField
                  id="attendance-approval-date-from"
                  value={customDateFilters.fromDate}
                  onChange={(fromDate) => {
                    setCustomDateFilters((current) => ({ ...current, fromDate }));
                    setSelectedRecordIds([]);
                    setPage(1);
                  }}
                  className="w-full sm:w-44"
                />
              </FilterField>
              <FilterField label={t('dateTo')} htmlFor="attendance-approval-date-to">
                <CalendarDateField
                  id="attendance-approval-date-to"
                  value={customDateFilters.toDate}
                  onChange={(toDate) => {
                    setCustomDateFilters((current) => ({ ...current, toDate }));
                    setSelectedRecordIds([]);
                    setPage(1);
                  }}
                  className="w-full sm:w-44"
                />
              </FilterField>
            </>
          ) : null}
          <FilterField label={t('employeeSearch')} htmlFor="attendance-approval-employee-search">
            <Input
              id="attendance-approval-employee-search"
              type="search"
              value={employeeSearch}
              onChange={(event) => {
                setEmployeeSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t('searchEmployee')}
              className="w-full md:max-w-xs"
            />
          </FilterField>
          <FilterField label={t('approvalStatus')} htmlFor="attendance-approval-status-filter">
            <Select value={approvalFilter} onValueChange={(value) => {
              setApprovalFilter(value as ApprovalFilter);
              setPage(1);
            }}>
              <SelectTrigger id="attendance-approval-status-filter" className="w-full md:w-48">
                <SelectValue placeholder={t('approvalStatus')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allApprovalStatuses')}</SelectItem>
                <SelectItem value="approved">{t('approved')}</SelectItem>
                <SelectItem value="unapproved">{t('unapproved')}</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          {isHrMode ? (
            <FilterField label={t('department')} htmlFor="attendance-approval-department-filter">
              <Select value={departmentFilter} onValueChange={(value) => {
                setDepartmentFilter(value);
                setPage(1);
              }}>
                <SelectTrigger id="attendance-approval-department-filter" className="w-full md:w-64">
                  <SelectValue placeholder={t('selectDepartment')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={allDepartmentsValue}>{t('allDepartments')}</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>{department.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={handleRefresh} disabled={!hasDateRange || generateRecords.isPending} className="w-full lg:w-auto">
            <RefreshCw className="size-4" />
            {t('generateDailyRecords')}
          </Button>
          <Button
            type="button"
            onClick={handleBatchApprove}
            disabled={selectedApprovableRecords.length === 0 || supervisorBatchApprove.isPending || hrBatchApprove.isPending}
            className="w-full lg:w-auto"
          >
            <CheckCircle2 className="size-4" />
            {selectedApprovableRecords.length > 0
              ? `${isHrMode ? t('approveForPayroll') : delegatedActionLabel(t('approve'), session.data?.user)} (${selectedApprovableRecords.length})`
              : t('approveSelected')}
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
        <CardContent>
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
                    <TableHead className="w-12">
                      <Checkbox
                        aria-label={t('selectAll')}
                        checked={allVisibleApprovableSelected ? true : selectedPageRecordCount > 0 ? 'indeterminate' : false}
                        disabled={pageApprovableRecords.length === 0 || supervisorBatchApprove.isPending || hrBatchApprove.isPending}
                        onCheckedChange={(checked) => toggleVisibleApprovableRecords(Boolean(checked))}
                      />
                    </TableHead>
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
                  {pageRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        <Checkbox
                          aria-label={`${t('selectAttendanceRecord')} ${employeeName(record.employee) || (record.employee?.employeeCode ?? '')}`}
                          checked={selectedRecordIds.includes(record.id)}
                          disabled={!canApprove(record, mode) || supervisorBatchApprove.isPending || hrBatchApprove.isPending}
                          onCheckedChange={(checked) => toggleRecordSelection(record.id, Boolean(checked))}
                        />
                      </TableCell>
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
                      <TableCell className="whitespace-nowrap">{formatDate(record.attendanceDate)}</TableCell>
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
                            disabled={!canApprove(record, mode) || supervisorApprove.isPending || hrApprove.isPending || supervisorBatchApprove.isPending || hrBatchApprove.isPending}
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
          {filteredRecords.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {t('showing')} {pageStart + 1}-{Math.min(pageStart + pageSize, filteredRecords.length)} {t('of')} {filteredRecords.length}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Select value={String(pageSize)} onValueChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}>
                  <SelectTrigger className="w-32" aria-label={t('pageSize')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100].map((size) => (
                      <SelectItem key={size} value={String(size)}>{size} / {t('page')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1}>
                  {common('previous')}
                </Button>
                <span className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                  {t('page')} {currentPage} {t('of')} {pageCount}
                </span>
                <Button type="button" variant="outline" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={currentPage >= pageCount}>
                  {common('next')}
                </Button>
              </div>
            </div>
          ) : null}
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

function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
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
