'use client';

import { Badge } from '@/components/ui/badge';
import type { AttendanceDailyRecord, AttendanceSessionEvaluation } from '@/data/types/core.types';

type AttendanceTranslator = (key: string, values?: Record<string, string | number>) => string;
type DateTimeFormatter = (
  value: Date | string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
) => string;

/** Scheduled rest days and full-day holidays carry no shift, so no late/early/absent rules apply. */
export function isNoDutyDay(record: AttendanceDailyRecord) {
  return record.isOffDay || (record.isHoliday && !record.attendanceSessions?.length);
}

/** Minutes for an exception column; a dash on days without duty instead of a misleading 0. */
export function ExceptionMinutes({ record, minutes }: { record: AttendanceDailyRecord; minutes: number }) {
  if (isNoDutyDay(record)) return <span className="text-muted-foreground">-</span>;
  return <span className={minutes > 0 ? 'font-medium text-amber-600' : undefined}>{minutes} min</span>;
}

export function totalLateMinutes(record: AttendanceDailyRecord) {
  return (record.lateMinutes ?? 0) + (record.lateReturnMinutes ?? 0);
}

export function summarizeAttendanceExceptions(records: AttendanceDailyRecord[]) {
  return records.reduce((summary, record) => {
    const sessions = (record.attendanceSessions ?? []).map(materializeAttendanceSession);
    const lateMinutes = sessions.length
      ? sessions.reduce((total, session) => total + session.lateMinutes, 0)
      : totalLateMinutes(record);
    const earlyBreakMinutes = sessions.length
      ? sessions.slice(0, -1).reduce(
        (total, session) => total + (session.checkOutStatus === 'EARLY' ? session.earlyCheckoutMinutes : 0),
        0,
      )
      : record.earlyBreakMinutes ?? 0;
    const finalSession = sessions.at(-1);
    const earlyOutMinutes = sessions.length
      ? finalSession?.checkOutStatus === 'EARLY' ? finalSession.earlyCheckoutMinutes : 0
      : record.earlyDepartureMinutes ?? 0;

    if (lateMinutes > 0) {
      summary.late.records += 1;
      summary.late.minutes += lateMinutes;
    }
    if (earlyBreakMinutes > 0) {
      summary.earlyBreak.records += 1;
      summary.earlyBreak.minutes += earlyBreakMinutes;
    }
    if (earlyOutMinutes > 0) {
      summary.earlyOut.records += 1;
      summary.earlyOut.minutes += earlyOutMinutes;
    }
    summary.absentSessions += sessions.filter((session) => session.attendanceStatus === 'ABSENT').length;
    return summary;
  }, {
    late: { records: 0, minutes: 0 },
    earlyBreak: { records: 0, minutes: 0 },
    earlyOut: { records: 0, minutes: 0 },
    absentSessions: 0,
  });
}

export function AttendanceSessions({
  record,
  formatDateTime,
  t,
}: {
  record: AttendanceDailyRecord;
  formatDateTime: DateTimeFormatter;
  t: AttendanceTranslator;
}) {
  if (isNoDutyDay(record)) {
    return <NoDutyDay record={record} formatDateTime={formatDateTime} t={t} />;
  }

  if (!record.attendanceSessions?.length) {
    return <span className="text-sm text-muted-foreground">{legacyAttendanceRule(record)}</span>;
  }

  return <div className="space-y-2">{record.attendanceSessions.map(materializeAttendanceSession).map((session) => (
    <div key={`${record.id}:${session.segmentId}`} className="flex flex-wrap items-center gap-1.5 text-sm">
      <span className="min-w-24 font-medium">{session.name}</span>
      <span>{sessionPunchLabel(session, 'IN', formatDateTime, t)}</span>
      <span className="text-muted-foreground">/</span>
      <span>{sessionPunchLabel(session, 'OUT', formatDateTime, t)}</span>
      <Badge variant={session.attendanceStatus === 'PRESENT' ? 'default' : session.attendanceStatus === 'ABSENT' ? 'destructive' : 'secondary'}>
        {t(session.attendanceStatus === 'PRESENT' ? 'sessionPresent' : session.attendanceStatus === 'ABSENT' ? 'sessionAbsent' : 'sessionPending')}
      </Badge>
    </div>
  ))}</div>;
}

function NoDutyDay({
  record,
  formatDateTime,
  t,
}: {
  record: AttendanceDailyRecord;
  formatDateTime: DateTimeFormatter;
  t: AttendanceTranslator;
}) {
  const time = (value: string | null | undefined) => formatDateTime(value, {
    year: undefined,
    month: undefined,
    day: undefined,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Addis_Ababa',
  });

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-sm">
      <Badge variant="secondary">{record.isHoliday ? record.holiday?.nameEn ?? t('holidayOffDay') : t('offDay')}</Badge>
      {record.checkInAt ? (
        <span className="text-muted-foreground">
          {t('checkIn')} {time(record.checkInAt)}
          {record.checkOutAt ? ` / ${t('checkOut')} ${time(record.checkOutAt)}` : null}
        </span>
      ) : null}
    </div>
  );
}

export function materializeAttendanceSession(session: AttendanceSessionEvaluation): AttendanceSessionEvaluation {
  if (new Date(session.completionAt ?? session.scheduledEndAt).getTime() > Date.now()) return session;
  return {
    ...session,
    checkInStatus: session.checkInAt ? session.checkInStatus === 'PENDING' ? 'ON_TIME' : session.checkInStatus : 'MISSING',
    checkOutStatus: session.checkOutAt
      ? session.checkOutStatus === 'PENDING'
        ? session.earlyCheckoutMinutes > 0 ? 'EARLY' : 'ON_TIME'
        : session.checkOutStatus
      : 'MISSING',
    lateCheckoutMinutes: session.lateCheckoutMinutes ?? 0,
    attendanceStatus: session.checkInAt && session.checkOutAt ? 'PRESENT' : 'ABSENT',
  };
}

function sessionPunchLabel(
  session: AttendanceSessionEvaluation,
  direction: 'IN' | 'OUT',
  formatDateTime: DateTimeFormatter,
  t: AttendanceTranslator,
) {
  const value = direction === 'IN' ? session.checkInAt : session.checkOutAt;
  const status = direction === 'IN' ? session.checkInStatus : session.checkOutStatus;
  if (!value) return t(status === 'PENDING' ? 'sessionPendingPunch' : direction === 'IN' ? 'missingCheckIn' : 'missingCheckOut');
  const time = formatDateTime(value, {
    year: undefined,
    month: undefined,
    day: undefined,
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Addis_Ababa',
  });
  if (direction === 'IN' && status === 'LATE') return `${time} ${t('lateCheckIn')} (${session.lateMinutes} min)`;
  if (direction === 'IN' && new Date(value).getTime() < new Date(session.scheduledStartAt).getTime()) {
    return `${time} ${t('earlyCheckIn')}`;
  }
  if (direction === 'OUT' && status === 'EARLY') return `${time} ${t('earlyCheckOut')} (${session.earlyCheckoutMinutes} min)`;
  if (direction === 'OUT' && status === 'LATE') return `${time} ${t('lateCheckOut')} (${session.lateCheckoutMinutes} min)`;
  if (status === 'PENDING') return `${time} ${t('sessionPending')}`;
  return `${time} ${t(direction === 'IN' ? 'checkIn' : 'checkOut')}`;
}

function legacyAttendanceRule(record: AttendanceDailyRecord) {
  if (record.checkInAt && record.checkOutAt) {
    if ((record.lateMinutes ?? 0) > 0 && (record.earlyDepartureMinutes ?? 0) > 0) return 'Late check-in / early check-out';
    if ((record.lateMinutes ?? 0) > 0) return 'Late check-in / check-out';
    if ((record.earlyDepartureMinutes ?? 0) > 0) return 'Check-in / early check-out';
    return 'Check-in / check-out';
  }
  if (!record.checkInAt) return 'No punch direction available';
  if (record.scheduledStartAt && record.scheduledEndAt) {
    const start = new Date(record.scheduledStartAt).getTime();
    const end = new Date(record.scheduledEndAt).getTime();
    if (new Date(record.checkInAt).getTime() <= start + (end - start) / 2) {
      if ((record.lateMinutes ?? 0) > 0) return 'Late check-in';
      return new Date(record.checkInAt).getTime() < start ? 'Early check-in' : 'Schedule-based check-in';
    }
    return (record.earlyDepartureMinutes ?? 0) > 0 ? 'Early check-out' : 'Schedule-based check-out';
  }
  return 'Direction not supplied by device';
}
