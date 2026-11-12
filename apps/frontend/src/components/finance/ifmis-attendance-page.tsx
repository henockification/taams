'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Pencil, RefreshCw, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { IsmisLeaveVerification } from '@/components/attendance/ismis-leave-verification';
import { useIfmisAttendancePreview, usePushIfmisAttendance, useSetIfmisAbsenceAdjustment } from '@/data/hooks/core.hooks';
import type { EmploymentType, IfmisAttendanceRow, IfmisExportStatus, IfmisReadinessIssueCode } from '@/data/types/core.types';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { userHasPermission } from '@/config/app-navigation';
import { ethiopianToGregorian, gregorianToEthiopian } from '@/lib/calendar';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

// Payroll months are Ethiopian (1 Meskerem … 12 Nehase); Nehase's payroll includes Pagume.
function addisToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

/** The last Ethiopian payroll month that has ended (Pagume still belongs to Nehase's). */
function previousMonth() {
  const today = gregorianToEthiopian(addisToday());
  if (!today) return { payMonth: 1, payYear: 2019 };
  const current = Math.min(today.month, 12);
  return current === 1 ? { payMonth: 12, payYear: today.year - 1 } : { payMonth: current - 1, payYear: today.year };
}

/** Gregorian days of an Ethiopian payroll month, matching the API (e.g. Tikimt 2019: 2026-10-11 to 2026-11-09). */
function payPeriodRange(payMonth: number, payYear: number) {
  const start = ethiopianToGregorian(payYear, payMonth, 1);
  const nextStart = payMonth === 12 ? ethiopianToGregorian(payYear + 1, 1, 1) : ethiopianToGregorian(payYear, payMonth + 1, 1);
  if (!start || !nextStart) return null;
  const end = new Date(`${nextStart}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() - 1);
  return { start, end: end.toISOString().slice(0, 10) };
}

const gregorianDate = (value: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${value}T00:00:00Z`));

const EMPLOYMENT_TYPES: EmploymentType[] = ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY'];
const ALL = 'all';
// Issues that block the whole month rather than one employee; always shown, whatever the filters.
const MONTH_WIDE_ISSUES = new Set<IfmisReadinessIssueCode>(['PERIOD_NOT_ENDED', 'LEAVE_NOT_VERIFIED']);
// Grouped in the order someone has to act on them.
const ISSUE_ORDER: IfmisReadinessIssueCode[] = [
  'PERIOD_NOT_ENDED', 'LEAVE_NOT_VERIFIED', 'MISSING_SCHEDULE', 'INVALID_SCHEDULE', 'MISSING_RECORD',
  'RETURNED', 'AWAITING_SUPERVISOR', 'AWAITING_HR', 'DUPLICATE_NAME',
];
const ISSUES_SHOWN_PER_GROUP = 200;

type EmployeeFilters = { search: string; employmentType: string; department: string };

function matchesFilters(
  item: { employeeName: string; employeeCode: string | null; employmentType: string | null; departmentName: string | null; amharicName?: string },
  filters: EmployeeFilters,
) {
  if (filters.employmentType !== ALL && item.employmentType !== filters.employmentType) return false;
  if (filters.department !== ALL && item.departmentName !== filters.department) return false;
  const terms = filters.search.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const text = [item.employeeName, item.amharicName, item.employeeCode].filter(Boolean).join(' ').normalize('NFKC').toLowerCase();
  return terms.every((term) => text.includes(term));
}

const rowName = (row: IfmisAttendanceRow) => [row.firstName, row.fatherName, row.grandName].filter(Boolean).join(' ');
const rowAmharicName = (row: IfmisAttendanceRow) => [row.firstNameAmharic, row.fatherNameAmharic, row.grandNameAmharic].filter(Boolean).join(' ');

export function IfmisAttendancePage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate, formatDateTime } = useCalendarPreference();
  const initial = useMemo(previousMonth, []);
  const [payMonth, setPayMonth] = useState(initial.payMonth);
  const [payYear, setPayYear] = useState(initial.payYear);
  const preview = useIfmisAttendancePreview({ payMonth, payYear });
  const push = usePushIfmisAttendance();
  const session = useSession();
  const data = preview.data;
  const succeeded = data?.batches.some((batch) => batch.status === 'SUCCEEDED') ?? false;
  const canPush = userHasPermission(session.data?.user, 'ifmis-attendance:push');
  const period = payPeriodRange(payMonth, payYear);
  const monthStart = period?.start ?? '';
  const monthEnd = period?.end ?? '';
  const periodDays = period ? Math.round((Date.parse(period.end) - Date.parse(period.start)) / 86_400_000) + 1 : 30;
  const [adjustingRow, setAdjustingRow] = useState<IfmisAttendanceRow | null>(null);
  const canAdjust = canPush && !succeeded;
  const [filters, setFilters] = useState<EmployeeFilters>({ search: '', employmentType: ALL, department: ALL });
  const deferredSearch = useDeferredValue(filters.search);
  const activeFilters = useMemo(() => ({ ...filters, search: deferredSearch }), [deferredSearch, filters]);
  const isFiltered = activeFilters.search.trim() !== '' || activeFilters.employmentType !== ALL || activeFilters.department !== ALL;

  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const issues = useMemo(() => data?.issues ?? [], [data?.issues]);
  const exemptCount = rows.filter((row) => row.isBiometricExempt).length;
  const departments = useMemo(
    () => [...new Set(rows.map((row) => row.departmentName).filter((name): name is string => Boolean(name)))]
      .sort((left, right) => left.localeCompare(right)),
    [rows],
  );
  const visibleRows = useMemo(() => rows.filter((row) => matchesFilters({
    employeeName: rowName(row),
    amharicName: rowAmharicName(row),
    employeeCode: row.employeeCode,
    employmentType: row.employmentType,
    departmentName: row.departmentName,
  }, activeFilters)), [activeFilters, rows]);
  const visibleIssues = useMemo(
    () => issues.filter((issue) => MONTH_WIDE_ISSUES.has(issue.code) || matchesFilters(issue, activeFilters)),
    [activeFilters, issues],
  );
  const issueGroups = useMemo(() => ISSUE_ORDER
    .map((code) => ({ code, items: visibleIssues.filter((issue) => issue.code === code) }))
    .filter((group) => group.items.length > 0), [visibleIssues]);

  async function handlePush() {
    try {
      const result = await push.mutateAsync({ payMonth, payYear });
      notifications.show({
        title: common('success'),
        message: t('ifmisPushSucceeded', { count: result.batch.recordCount }),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('ifmisPushFailed'),
        color: 'red',
      });
    }
  }

  const status = succeeded ? t('exported') : data?.ready ? t('ready') : t('notReady');

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select value={String(payMonth)} onValueChange={(value) => setPayMonth(Number(value))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((month) => <SelectItem key={month} value={String(month)}>{t(`ethiopianMonth${month}`)}</SelectItem>)}</SelectContent>
          </Select>
          <Input
            aria-label={t('ifmisPayYearEthiopian')}
            title={t('ifmisPayYearEthiopian')}
            className="w-28"
            type="number"
            min={2000}
            max={2200}
            value={payYear}
            onChange={(event) => setPayYear(Number(event.target.value))}
          />
          {period ? (
            <span className="text-sm text-muted-foreground">
              {t('ifmisPayPeriodCovers', { from: gregorianDate(period.start), to: gregorianDate(period.end) })}
            </span>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => preview.refetch()} disabled={preview.isFetching} className="w-full lg:w-auto">
          <RefreshCw className={preview.isFetching ? 'size-4 animate-spin' : 'size-4'} />
          {t('refreshPreview')}
        </Button>
      </div>

      {preview.isError ? (
        <Alert variant="destructive"><AlertCircle className="size-4" /><AlertTitle>{common('error')}</AlertTitle><AlertDescription>{preview.error.message}</AlertDescription></Alert>
      ) : null}

      {data ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border px-3 py-2 text-sm">
          <Badge variant={succeeded || data.ready ? 'default' : 'destructive'}>{status}</Badge>
          <span>{t('ifmisEmployeeCount', { count: rows.length })}</span>
          <span className="text-muted-foreground">{t('ifmisExemptCount', { count: exemptCount })}</span>
          <span className={issues.length ? 'text-destructive' : 'text-muted-foreground'}>{t('ifmisIssueCount', { count: issues.length })}</span>
        </div>
      ) : null}

      <IsmisLeaveVerification range={{ dateFrom: monthStart, dateTo: monthEnd }} />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Input
          aria-label={t('employeeSearch')}
          className="sm:w-72"
          value={filters.search}
          onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
          placeholder={t('searchEmployees')}
        />
        <Select value={filters.employmentType} onValueChange={(employmentType) => setFilters((current) => ({ ...current, employmentType }))}>
          <SelectTrigger aria-label={t('employmentType')} className="sm:w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allEmploymentTypes')}</SelectItem>
            {EMPLOYMENT_TYPES.map((type) => <SelectItem key={type} value={type}>{t(`employmentType${type}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filters.department} onValueChange={(department) => setFilters((current) => ({ ...current, department }))}>
          <SelectTrigger aria-label={t('department')} className="sm:w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('allDepartments')}</SelectItem>
            {departments.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {issues.length ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t('monthNotReady')}</AlertTitle>
          <AlertDescription>
            <div className="mt-2 flex max-h-96 flex-col gap-3 overflow-y-auto pr-1">
              {issueGroups.map((group) => (
                <div key={group.code}>
                  <p className="font-medium">
                    {t(issueLabelKey(group.code))}
                    {!MONTH_WIDE_ISSUES.has(group.code) ? <span className="font-normal opacity-75"> · {t('ifmisEmployeeCount', { count: group.items.length })}</span> : null}
                  </p>
                  {!MONTH_WIDE_ISSUES.has(group.code) ? (
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {group.items.slice(0, ISSUES_SHOWN_PER_GROUP).map((issue) => (
                        <li key={`${issue.code}-${issue.employeeId}`}>
                          {issue.employeeName}
                          {issue.employeeCode ? <span className="opacity-75"> ({issue.employeeCode})</span> : null}
                          {issue.departmentName ? <span className="opacity-75"> · {issue.departmentName}</span> : null}
                          {issue.dates.length ? (
                            <span className="opacity-75">
                              {' · '}{t('ifmisIssueDays', { count: issue.dates.length })}
                              {' ('}{formatDate(issue.dates[0])}{issue.dates.length > 1 ? ` – ${formatDate(issue.dates.at(-1)!)}` : ''}{')'}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
              {isFiltered && visibleIssues.length < issues.length ? <p className="text-xs opacity-75">{t('ifmisIssuesFilteredOut')}</p> : null}
            </div>
          </AlertDescription>
        </Alert>
      ) : data?.ready ? (
        <Alert><CheckCircle2 className="size-4" /><AlertTitle>{t('monthReady')}</AlertTitle><AlertDescription>{t('monthReadyDescription')}</AlertDescription></Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><CardTitle>{t('ifmisPreview')}</CardTitle><CardDescription>{t('ifmisPreviewDescription')}</CardDescription></div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!canPush || !data?.ready || succeeded || push.isPending}>
                <Send className="size-4" />{push.isPending ? t('pushingToIfmis') : t('pushToIfmis')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('confirmIfmisPush')}</AlertDialogTitle>
                <AlertDialogDescription>{t('confirmIfmisPushDescription', { month: t(`ethiopianMonth${payMonth}`), year: payYear, count: rows.length })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>{common('cancel')}</AlertDialogCancel><AlertDialogAction onClick={handlePush}>{t('pushToIfmis')}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          {preview.isLoading ? <p className="text-sm text-muted-foreground">{common('loading')}</p> : (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[78rem]">
                <TableHeader><TableRow>
                  <TableHead>{t('employee')}</TableHead><TableHead>{t('amharicName')}</TableHead>
                  <TableHead>{t('department')}</TableHead>
                  <TableHead>{t('absenteeismDays')}</TableHead><TableHead>{t('lateDays')}</TableHead>
                  <TableHead>{t('currentStatus')}</TableHead><TableHead>{t('approved')}</TableHead>
                  <TableHead>{t('payMonth')}</TableHead><TableHead>{t('payYear')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {visibleRows.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="py-6 text-center text-sm text-muted-foreground">{t('noMatchingEmployees')}</TableCell></TableRow>
                  ) : visibleRows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell className="font-medium">
                        {rowName(row)}
                        {row.employeeCode ? <span className="block text-xs font-normal text-muted-foreground">{row.employeeCode}{row.employmentType ? ` · ${t(`employmentType${row.employmentType}`)}` : ''}</span> : null}
                        {row.isBiometricExempt ? (
                          <Badge variant="outline" className="mt-1 border-emerald-500 text-emerald-700 dark:text-emerald-400">{t('biometricExempt')}</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{rowAmharicName(row) || '-'}</TableCell>
                      <TableCell>{row.departmentName ?? '-'}</TableCell>
                      <TableCell>
                        <span>{row.absenteeism.toFixed(2)}</span>
                        {row.absenteeismAdjusted ? (
                          <span className="block text-xs text-muted-foreground" title={row.adjustmentNote ?? undefined}>
                            {t('absentDaysAdjusted', { value: row.calculatedAbsenteeism.toFixed(2) })}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>{row.late.toFixed(2)}</TableCell>
                      <TableCell><Badge variant="outline">{row.currentStatus}</Badge></TableCell><TableCell>{row.approved}</TableCell>
                      <TableCell>{row.payMonth}</TableCell><TableCell>{row.payYear}</TableCell>
                      <TableCell className="text-right">
                        {row.isBiometricExempt && canAdjust ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setAdjustingRow(row)}>
                            <Pencil className="size-4" />{t('adjustAbsentDays')}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <AbsenceAdjustmentDialog
        row={adjustingRow}
        payMonth={payMonth}
        payYear={payYear}
        periodDays={periodDays}
        onClose={() => setAdjustingRow(null)}
      />

      <Card>
        <CardHeader><CardTitle>{t('exportHistory')}</CardTitle><CardDescription>{t('exportHistoryDescription')}</CardDescription></CardHeader>
        <CardContent>
          {!data?.batches.length ? <p className="text-sm text-muted-foreground">{t('noExportHistory')}</p> : (
            <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow>
              <TableHead>{t('status')}</TableHead><TableHead>{t('records')}</TableHead><TableHead>{t('startedAt')}</TableHead><TableHead>{t('completedAt')}</TableHead><TableHead>{t('details')}</TableHead>
            </TableRow></TableHeader><TableBody>{data.batches.map((batch) => (
              <TableRow key={batch.id}><TableCell><Badge variant={batchVariant(batch.status)}>{t(batch.status === 'SUCCEEDED' ? 'exportSucceeded' : batch.status === 'FAILED' ? 'exportFailed' : 'exportProcessing')}</Badge></TableCell>
                <TableCell>{batch.recordCount}</TableCell><TableCell>{formatDateTime(batch.startedAt)}</TableCell><TableCell>{formatDateTime(batch.completedAt)}</TableCell><TableCell>{batch.errorMessage ?? '-'}</TableCell></TableRow>
            ))}</TableBody></Table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AbsenceAdjustmentDialog({ row, payMonth, payYear, periodDays, onClose }: {
  row: IfmisAttendanceRow | null;
  payMonth: number;
  payYear: number;
  /** 30, or 35/36 for Nehase with Pagume. */
  periodDays: number;
  onClose: () => void;
}) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const save = useSetIfmisAbsenceAdjustment();
  const [absentDays, setAbsentDays] = useState('');
  const [note, setNote] = useState('');
  const [openedFor, setOpenedFor] = useState<string | null>(null);

  // Reset the form whenever the dialog opens for a different row.
  if (row && openedFor !== row.employeeId) {
    setOpenedFor(row.employeeId);
    setAbsentDays(String(row.absenteeism));
    setNote(row.adjustmentNote ?? '');
  }

  const name = row ? [row.firstName, row.fatherName, row.grandName].filter(Boolean).join(' ') : '';

  async function submit(value: number | null) {
    if (!row) return;
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > periodDays)) {
      notifications.show({ title: common('error'), message: t('absentDaysInvalid', { max: periodDays }), color: 'red' });
      return;
    }
    try {
      await save.mutateAsync({ payMonth, payYear, employeeId: row.employeeId, absentDays: value, note: value === null ? null : note });
      notifications.show({ title: common('success'), message: t('absentDaysSaved'), color: 'green' });
      setOpenedFor(null);
      onClose();
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : common('error'), color: 'red' });
    }
  }

  return (
    <Dialog open={Boolean(row)} onOpenChange={(open) => { if (!open) { setOpenedFor(null); onClose(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('adjustAbsentDays')}</DialogTitle>
          <DialogDescription>
            {t('adjustAbsentDaysDescription', { name, value: (row?.calculatedAbsenteeism ?? 0).toFixed(2) })}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => { event.preventDefault(); void submit(Number(absentDays)); }}
        >
          <div className="space-y-2">
            <Label htmlFor="ifmis-absent-days">{t('absentDays')}</Label>
            <Input
              id="ifmis-absent-days"
              type="number"
              min={0}
              max={periodDays}
              step={0.5}
              value={absentDays}
              onChange={(event) => setAbsentDays(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ifmis-absent-note">{t('note')}</Label>
            <Textarea id="ifmis-absent-note" value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {row?.absenteeismAdjusted ? (
              <Button type="button" variant="ghost" disabled={save.isPending} onClick={() => submit(null)}>
                {t('useCalculatedValue')}
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setOpenedFor(null); onClose(); }}>{common('cancel')}</Button>
              <Button type="submit" disabled={save.isPending || absentDays.trim() === ''}>{common('save')}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function batchVariant(status: IfmisExportStatus): 'default' | 'destructive' | 'secondary' {
  if (status === 'SUCCEEDED') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

function issueLabelKey(code: IfmisReadinessIssueCode) {
  const labels: Record<IfmisReadinessIssueCode, string> = {
    MISSING_SCHEDULE: 'ifmisIssueMissingSchedule',
    INVALID_SCHEDULE: 'ifmisIssueInvalidSchedule',
    MISSING_RECORD: 'ifmisIssueMissingRecord',
    AWAITING_SUPERVISOR: 'ifmisIssueAwaitingSupervisor',
    RETURNED: 'ifmisIssueReturned',
    AWAITING_HR: 'ifmisIssueAwaitingHr',
    PERIOD_NOT_ENDED: 'ifmisIssuePeriodNotEnded',
    LEAVE_NOT_VERIFIED: 'ifmisIssueLeaveNotVerified',
    DUPLICATE_NAME: 'ifmisIssueDuplicateName',
  };
  return labels[code] ?? 'ifmisIssueMissingRecord';
}
