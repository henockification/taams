'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { RotateCcw, ScanLine, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useBiometricExemptions,
  useAttendancePunchesPaginated,
  useBiometricDevices,
} from '@/data/hooks/core.hooks';
import type { Employee } from '@/data/types/core.types';
import { useEmployeeName } from '@/lib/employee-name';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const allDevicesValue = '__all';
type MappingFilter = 'all' | 'mapped' | 'unmapped';
type DatePreset = 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

function ymd(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`; }
function presetDates(preset: DatePreset) {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === 'YESTERDAY') { end.setDate(end.getDate() - 1); return { from: ymd(end), to: ymd(end) }; }
  if (preset === 'THIS_WEEK') { const start = new Date(end); start.setDate(end.getDate() - ((end.getDay() + 6) % 7)); return { from: ymd(start), to: ymd(end) }; }
  if (preset === 'THIS_MONTH') return { from: ymd(new Date(end.getFullYear(), end.getMonth(), 1)), to: ymd(end) };
  return { from: ymd(end), to: ymd(end) };
}

export default function AttendancePunchesPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const employeeName = useEmployeeName();
  const { formatDateTime } = useCalendarPreference();
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [mapping, setMapping] = useState<MappingFilter>('all');
  const [deviceId, setDeviceId] = useState('');
  const [status, setStatus] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [dateFrom, setDateFrom] = useState(() => presetDates('TODAY').from);
  const [dateTo, setDateTo] = useState(() => presetDates('TODAY').to);
  const [datePreset, setDatePreset] = useState<DatePreset>('TODAY');
  const [timeFrom, setTimeFrom] = useState('');
  const [timeTo, setTimeTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  useEffect(() => {
    const handle = setTimeout(() => {
      const next = searchInput.trim();
      if (next === search) return;
      setSearch(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [searchInput, search]);

  const punchesQuery = useAttendancePunchesPaginated({
    page,
    pageSize,
    search: search || undefined,
    mapping: mapping === 'all' ? undefined : mapping,
    deviceId: deviceId || undefined,
    status: status === 'all' ? undefined : status,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    timeFrom: timeFrom || undefined,
    timeTo: timeTo || undefined,
  });
  const { data: devicesResponse } = useBiometricDevices();
  const { data: biometricExemptionsResponse } = useBiometricExemptions();

  const devices = devicesResponse?.biometricDevices ?? [];
  const biometricExemptions = biometricExemptionsResponse?.biometricExemptions ?? [];
  const exemptEmployeeIds = useMemo(
    () => new Set(biometricExemptions.filter((exemption) => exemption.isActive && exemption.employeeId).map((exemption) => exemption.employeeId as string)),
    [biometricExemptions],
  );
  const exemptPositionIds = useMemo(
    () => new Set(biometricExemptions.filter((exemption) => exemption.isActive && exemption.positionId).map((exemption) => exemption.positionId as string)),
    [biometricExemptions],
  );
  const punches = punchesQuery.data?.attendancePunches ?? [];
  const pagination = punchesQuery.data?.pagination;
  const totalRecords = pagination?.total ?? 0;
  const duplicateRecords = punches.filter((punch) => punch.isDuplicate).length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const startIndex = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalRecords);
  const isExemptEmployee = (employee?: Employee | null) => Boolean(
    employee && (exemptEmployeeIds.has(employee.id) || (employee.positionId ? exemptPositionIds.has(employee.positionId) : false)),
  );

  function resetToFirstPage() {
    setPage(1);
  }

  function applyDatePreset(value: DatePreset) {
    setDatePreset(value);
    if (value !== 'CUSTOM') {
      const dates = presetDates(value);
      setDateFrom(dates.from);
      setDateTo(dates.to);
    }
    resetToFirstPage();
  }

  function clearFilters() {
    setSearchInput(''); setSearch(''); setMapping('all'); setDeviceId(''); setStatus('all'); setDatePreset('TODAY');
    const dates = presetDates('TODAY'); setDateFrom(dates.from); setDateTo(dates.to);
    setTimeFrom(''); setTimeTo(''); resetToFirstPage();
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="grid gap-2 sm:grid-cols-4">
        <Summary label={t('records')} value={totalRecords} />
        <Summary label={t('page')} value={page} />
        <Summary label={t('pageSize')} value={pageSize} />
        <Summary label="Possible duplicates" value={duplicateRecords} />
      </div>

      <div className="flex w-full flex-col gap-3">
        <div className="flex flex-1 flex-wrap items-end gap-2">
          <Select value={datePreset} onValueChange={(value) => applyDatePreset(value as DatePreset)}>
            <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAY">Today</SelectItem><SelectItem value="YESTERDAY">Yesterday</SelectItem>
              <SelectItem value="THIS_WEEK">This week</SelectItem><SelectItem value="THIS_MONTH">This month</SelectItem><SelectItem value="CUSTOM">Custom range</SelectItem>
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => { setStatus(value as 'all' | 'processed' | 'unprocessed'); resetToFirstPage(); }}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allPunches')}</SelectItem>
              <SelectItem value="unprocessed">{t('unprocessed')}</SelectItem>
              <SelectItem value="processed">{t('processed')}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={deviceId || allDevicesValue}
            onValueChange={(value) => {
              setDeviceId(value === allDevicesValue ? '' : value);
              resetToFirstPage();
            }}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder={t('selectDevice')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={allDevicesValue}>{t('allDevices')}</SelectItem>
              {devices.map((device) => (
                <SelectItem key={device.id} value={device.id}>
                  {device.deviceName} · {device.deviceCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {datePreset === 'CUSTOM' ? <Field label={t('startDate')} id="attendance-punches-date-from">
            <CalendarDateField
              id="attendance-punches-date-from"
              value={dateFrom}
              onChange={(value) => {
                setDateFrom(value);
                setDatePreset('CUSTOM');
                resetToFirstPage();
              }}
              className="w-full md:w-44"
            />
          </Field> : null}
          {datePreset === 'CUSTOM' ? <Field label={t('endDate')} id="attendance-punches-date-to">
            <CalendarDateField
              id="attendance-punches-date-to"
              value={dateTo}
              onChange={(value) => {
                setDateTo(value);
                setDatePreset('CUSTOM');
                resetToFirstPage();
              }}
              className="w-full md:w-44"
            />
          </Field> : null}
          <Button type="button" variant="outline" onClick={clearFilters}><RotateCcw className="size-4" />Clear filters</Button>
          {datePreset === 'CUSTOM' ? <Field label={t('startTime')} id="attendance-punches-time-from">
            <Input
              id="attendance-punches-time-from"
              type="time"
              value={timeFrom}
              onChange={(event) => {
                setTimeFrom(event.target.value);
                resetToFirstPage();
              }}
              className="w-full md:w-36"
            />
          </Field> : null}
          {datePreset === 'CUSTOM' ? <Field label={t('endTime')} id="attendance-punches-time-to">
            <Input
              id="attendance-punches-time-to"
              type="time"
              value={timeTo}
              onChange={(event) => {
                setTimeTo(event.target.value);
                resetToFirstPage();
              }}
              className="w-full md:w-36"
            />
          </Field> : null}
        </div>
      </div>

      <Card className="rounded-lg">
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name, employee code or biometric ID"
                aria-label={t('searchEmployee')}
                className="pl-8"
              />
            </div>
            <Select value={mapping} onValueChange={(value) => { setMapping(value as MappingFilter); resetToFirstPage(); }}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All punches</SelectItem>
                <SelectItem value="mapped">Mapped to employee</SelectItem>
                <SelectItem value="unmapped">Unmapped biometric IDs</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {punchesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : punches.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title={status === 'unprocessed' ? t('noUnprocessedPunches') : t('noAttendancePunches')}
              description={status === 'unprocessed' ? t('noUnprocessedPunchesDescription') : t('noAttendancePunchesDescription')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('punchTime')}</TableHead>
                      <TableHead>{t('employee')}</TableHead>
                      <TableHead>{t('biometricId')}</TableHead>
                      <TableHead>{t('device')}</TableHead>
                      <TableHead>{t('punchType')}</TableHead>
                      <TableHead>Attendance rule</TableHead>
                      <TableHead>{t('source')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {punches.map((punch) => (
                      <TableRow key={punch.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(punch.punchTime)}</TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{employeeName(punch.employee) || punch.biometricId || t('unknown')}</p>
                            <p className="truncate text-xs text-muted-foreground">{punch.employee?.employeeCode ?? punch.biometricId ?? '-'}</p>
                            {!punch.employee ? (
                              <Badge variant="outline" className="mt-1 border-amber-500 text-amber-700 dark:text-amber-400">
                                Unmapped
                              </Badge>
                            ) : null}
                            {isExemptEmployee(punch.employee) ? (
                              <Badge variant="outline" className="mt-1 border-emerald-500 text-emerald-700 dark:text-emerald-400">
                                {t('biometricExempt')}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{punch.biometricId}</TableCell>
                        <TableCell>{punch.device?.deviceName ?? '-'}</TableCell>
                        <TableCell><Badge variant="secondary">{punch.punchType}</Badge></TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {punch.punchType === 'IN' ? 'Check-in' : punch.punchType === 'OUT' ? 'Check-out' : punch.punchType === 'BREAK_OUT' ? 'Break start' : punch.punchType === 'BREAK_IN' ? 'Break return' : punch.inferredRule === 'SCHEDULE_BEFORE_WINDOW' ? 'Before check-in window (ignored)' : punch.inferredRule === 'SCHEDULE_EARLY_IN' ? 'Early check-in' : punch.inferredRule === 'SCHEDULE_LATE_IN' ? 'Late check-in' : punch.inferredRule === 'SCHEDULE_ON_TIME_IN' ? 'On-time check-in' : punch.inferredRule === 'SCHEDULE_EARLY_OUT' ? 'Early check-out' : punch.inferredPunchType === 'OUT' ? 'Schedule-based check-out' : 'Direction not supplied by device'}
                        </TableCell>
                        <TableCell>{punch.source}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant={punch.isProcessed ? 'default' : 'secondary'}>{punch.isProcessed ? t('processed') : t('notProcessed')}</Badge>
                            {punch.isDuplicate ? <Badge variant="destructive">Possible duplicate</Badge> : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{totalRecords === 0 ? t('noRows') : `${t('showing')} ${startIndex}-${endIndex} ${t('of')} ${totalRecords}`}</span>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[25, 50, 100, 200].map((size) => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                    {common('previous')}
                  </Button>
                  <span className="whitespace-nowrap">{page} / {totalPages}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                    {common('next')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
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

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
