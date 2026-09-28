'use client';

import { type ReactNode, useMemo, useState } from 'react';
import { AlertCircle, CalendarCheck, ClipboardPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  AttendanceSessions,
  ExceptionMinutes,
  materializeAttendanceSession,
  summarizeAttendanceExceptions,
  totalLateMinutes,
} from '@/components/attendance/attendance-record-display';
import { CalendarDateField } from '@/components/calendar/calendar-date-field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
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
import { useMyAttendanceDailyRecords } from '@/data/hooks/core.hooks';
import type { AttendanceDailyRecord, AttendanceDailyRecordStatus, PunchType } from '@/data/types/core.types';
import { Link } from '@/i18n';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type DateFilter = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'THIS_YEAR' | 'CUSTOM';

export function MyAttendancePage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate, formatDateTime } = useCalendarPreference();
  const currentDate = addisToday();
  const [dateFilter, setDateFilter] = useState<DateFilter>('THIS_MONTH');
  const [customRange, setCustomRange] = useState({ fromDate: currentDate, toDate: currentDate });
  const range = getDateFilterBounds(dateFilter, customRange);
  const attendance = useMyAttendanceDailyRecords({ dateFrom: range.fromDate, dateTo: range.toDate });
  const records = attendance.data?.attendanceDailyRecords ?? [];
  const exceptions = useMemo(() => summarizeAttendanceExceptions(records), [records]);

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-wrap items-end gap-2">
          <FilterField label={t('attendanceDate')} htmlFor="my-attendance-date-filter">
            <Select value={dateFilter} onValueChange={(value) => setDateFilter(value as DateFilter)}>
              <SelectTrigger id="my-attendance-date-filter" className="w-full sm:w-44">
                <SelectValue />
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
              <FilterField label={t('dateFrom')} htmlFor="my-attendance-date-from">
                <CalendarDateField
                  id="my-attendance-date-from"
                  value={customRange.fromDate}
                  onChange={(fromDate) => setCustomRange((current) => ({ ...current, fromDate }))}
                  className="w-full sm:w-44"
                />
              </FilterField>
              <FilterField label={t('dateTo')} htmlFor="my-attendance-date-to">
                <CalendarDateField
                  id="my-attendance-date-to"
                  value={customRange.toDate}
                  onChange={(toDate) => setCustomRange((current) => ({ ...current, toDate }))}
                  className="w-full sm:w-44"
                />
              </FilterField>
            </>
          ) : null}
        </div>
        <Button asChild variant="outline" className="w-full lg:w-auto">
          <Link href="/attendance-corrections">
            <ClipboardPlus className="size-4" />
            {t('attendanceCorrections')}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2">
        <Summary label={t('records')} value={records.length} />
        <Summary label={t('lateAttendance')} value={exceptions.late.records} detail={t('totalMinutes', { count: exceptions.late.minutes })} />
        <Summary label={t('earlyBreak')} value={exceptions.earlyBreak.records} detail={t('totalMinutes', { count: exceptions.earlyBreak.minutes })} />
        <Summary label={t('earlyOut')} value={exceptions.earlyOut.records} detail={t('totalMinutes', { count: exceptions.earlyOut.minutes })} />
        <Summary label={t('absentSessions')} value={exceptions.absentSessions} />
      </div>

      {attendance.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{common('error')}</AlertTitle>
          <AlertDescription>{attendance.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-lg">
        <CardContent>
          {attendance.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : records.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title={t('noMyAttendance')}
              description={t('noMyAttendanceDescription')}
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table className="min-w-[74rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('attendanceDate')}</TableHead>
                    <TableHead>{t('attendanceSessions')}</TableHead>
                    <TableHead>{t('lateMinutes')}</TableHead>
                    <TableHead>{t('earlyBreak')}</TableHead>
                    <TableHead>{t('earlyLeaveMinutes')}</TableHead>
                    <TableHead>{t('attendanceDays')}</TableHead>
                    <TableHead>{t('absenceDays')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="whitespace-nowrap font-medium">{formatDate(record.attendanceDate)}</TableCell>
                      <TableCell className="min-w-[28rem]">
                        <AttendanceSessions record={record} formatDateTime={formatDateTime} t={t} />
                      </TableCell>
                      <TableCell>
                        <ExceptionMinutes record={record} minutes={totalLateMinutes(record)} />
                      </TableCell>
                      <TableCell>
                        <ExceptionMinutes record={record} minutes={record.earlyBreakMinutes ?? 0} />
                      </TableCell>
                      <TableCell>
                        <ExceptionMinutes record={record} minutes={record.earlyDepartureMinutes ?? 0} />
                      </TableCell>
                      <TableCell>{record.attendanceDays}</TableCell>
                      <TableCell>{record.absenceDays}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <Badge variant={statusVariant(record.status)}>{statusLabel(record.status, t)}</Badge>
                          {record.isHoliday ? <Badge variant="secondary">{record.holiday?.nameEn ?? t('holidayOffDay')}</Badge> : null}
                          {record.isBiometricExempt ? <Badge variant="outline">{t('biometricExempt')}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={correctionHref(record)}>
                            <ClipboardPlus className="size-4" />
                            {t('requestAttendanceCorrection')}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
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

function Summary({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold leading-none">{value}</p>
      {detail ? <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p> : null}
    </div>
  );
}

function correctionHref(record: AttendanceDailyRecord) {
  const sessions = (record.attendanceSessions ?? []).map(materializeAttendanceSession);
  const missingCheckIn = sessions.find((session) => session.checkInStatus === 'MISSING');
  const missingCheckOut = sessions.find((session) => session.checkOutStatus === 'MISSING');
  const punchType: PunchType = missingCheckIn ? 'IN' : missingCheckOut ? 'OUT' : 'UNKNOWN';
  const scheduledTime = missingCheckIn?.scheduledStartAt ?? missingCheckOut?.scheduledEndAt;
  const query = new URLSearchParams({
    open: 'true',
    date: record.attendanceDate,
    punchType,
    ...(scheduledTime ? { requestedPunchTime: toAddisDateTimeLocal(scheduledTime) } : {}),
  });
  return `/attendance-corrections?${query.toString()}`;
}

function toAddisDateTimeLocal(value: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

function statusLabel(status: AttendanceDailyRecordStatus, t: (key: string) => string) {
  switch (status) {
    case 'PENDING_SUPERVISOR': return t('pendingSupervisor');
    case 'RETURNED': return t('returned');
    case 'SUPERVISOR_APPROVED': return t('supervisorApproved');
    case 'HR_APPROVED': return t('hrApproved');
  }
}

function statusVariant(status: AttendanceDailyRecordStatus) {
  if (status === 'HR_APPROVED') return 'default' as const;
  if (status === 'RETURNED') return 'destructive' as const;
  return 'secondary' as const;
}

function addisToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function dateToYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateFilterBounds(filter: DateFilter, custom: { fromDate: string; toDate: string }) {
  if (filter === 'CUSTOM') return custom;
  const current = new Date(`${addisToday()}T12:00:00`);
  const end = new Date(current);

  if (filter === 'TODAY') return { fromDate: dateToYmd(current), toDate: dateToYmd(end) };
  if (filter === 'THIS_WEEK') {
    const start = new Date(current);
    start.setDate(current.getDate() - ((current.getDay() + 6) % 7));
    const weekEnd = new Date(start);
    weekEnd.setDate(start.getDate() + 6);
    return { fromDate: dateToYmd(start), toDate: dateToYmd(weekEnd) };
  }
  if (filter === 'THIS_MONTH') {
    const start = new Date(current.getFullYear(), current.getMonth(), 1);
    end.setMonth(current.getMonth() + 1, 0);
    return { fromDate: dateToYmd(start), toDate: dateToYmd(end) };
  }
  const start = new Date(current.getFullYear(), 0, 1);
  end.setMonth(11, 31);
  return { fromDate: dateToYmd(start), toDate: dateToYmd(end) };
}
