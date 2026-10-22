/**
 * Per-session check-in/check-out cells for attendance reports. A shift splits the day into
 * sessions (e.g. Morning and Afternoon), each with its own check-in and check-out, shown the same
 * way as on the attendance approval screen.
 */

export type AttendanceSession = {
  segmentId: string;
  name: string;
  sortOrder: number;
  scheduledStartAt: string;
  scheduledEndAt: string;
  completionAt?: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  checkInStatus: string;
  checkOutStatus: string;
  attendanceStatus: string;
  lateMinutes: number;
  earlyCheckoutMinutes: number;
  lateCheckoutMinutes?: number;
};

/**
 * Once a session's completion time has passed, unresolved punches become final (missing punch,
 * absent session). Mirrors materializeAttendanceSession on the attendance approval screen.
 */
export function materializeSession(session: AttendanceSession): AttendanceSession {
  if (new Date(session.completionAt ?? session.scheduledEndAt).getTime() > Date.now()) return session;
  return {
    ...session,
    checkInStatus: session.checkInAt ? (session.checkInStatus === 'PENDING' ? 'ON_TIME' : session.checkInStatus) : 'MISSING',
    checkOutStatus: session.checkOutAt
      ? session.checkOutStatus === 'PENDING'
        ? session.earlyCheckoutMinutes > 0 ? 'EARLY' : 'ON_TIME'
        : session.checkOutStatus
      : 'MISSING',
    lateCheckoutMinutes: session.lateCheckoutMinutes ?? 0,
    attendanceStatus: session.checkInAt && session.checkOutAt ? 'PRESENT' : 'ABSENT',
  };
}

export function recordSessions(record: any): AttendanceSession[] {
  return applyLeaveToSessions(record, [...((record.sessionEvaluations ?? []) as AttendanceSession[])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(materializeSession));
}

/**
 * Leave (TAAMS or imported from ISMIS) is stored as day values, not per session: a full
 * leave day covers every missed session, half a day covers half of them. Covered sessions
 * read "On leave" instead of "Absent".
 */
export function applyLeaveToSessions<T extends AttendanceSession>(record: any, sessions: T[]): T[] {
  const leaveDays = Math.min(1, Math.max(0, Number(record.leaveDays ?? 0)));
  let covered = Math.round(leaveDays * sessions.length);
  return sessions.map((session) => {
    if (covered <= 0 || session.attendanceStatus !== 'ABSENT') return session;
    covered -= 1;
    return {
      ...session,
      checkInStatus: session.checkInAt ? session.checkInStatus : 'ON_LEAVE',
      checkOutStatus: session.checkOutAt ? session.checkOutStatus : 'ON_LEAVE',
      attendanceStatus: 'ON_LEAVE',
    };
  });
}

/**
 * Late, late-return, early-break and early-departure minutes for a day, derived from its sessions
 * exactly as the attendance approval screen derives them. Days without sessions keep the stored totals.
 */
export function recordExceptionMinutes(record: any, sessions: AttendanceSession[] = recordSessions(record)) {
  if (sessions.length === 0) {
    return {
      lateMinutes: record.lateMinutes ?? 0,
      lateReturnMinutes: record.lateReturnMinutes ?? 0,
      earlyBreakMinutes: record.earlyBreakMinutes ?? 0,
      earlyDepartureMinutes: record.earlyDepartureMinutes ?? 0,
    };
  }
  const finalSession = sessions[sessions.length - 1];
  return {
    lateMinutes: sessions[0].lateMinutes ?? 0,
    lateReturnMinutes: sessions.slice(1).reduce((total, session) => total + (session.lateMinutes ?? 0), 0),
    earlyBreakMinutes: sessions.slice(0, -1).reduce(
      (total, session) => total + (session.checkOutStatus === 'EARLY' ? session.earlyCheckoutMinutes ?? 0 : 0),
      0,
    ),
    earlyDepartureMinutes: finalSession.checkOutStatus === 'EARLY' ? finalSession.earlyCheckoutMinutes ?? 0 : 0,
  };
}

/** Minutes between check-in and check-out of every completed session, or of the day's first and last punch. */
export function recordWorkedMinutes(record: any, sessions: AttendanceSession[] = recordSessions(record)) {
  const span = (from: string | Date | null | undefined, to: string | Date | null | undefined) => (
    from && to ? Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60_000)) : 0
  );
  if (sessions.length === 0) return span(record.checkInAt, record.checkOutAt);
  return sessions.reduce((total, session) => total + span(session.checkInAt, session.checkOutAt), 0);
}

/** 125 -> "2h 05m", for durations people read rather than add up. */
export function formatDuration(minutes: number) {
  if (!minutes) return '0m';
  const hours = Math.floor(minutes / 60);
  const rest = String(minutes % 60).padStart(2, '0');
  return hours > 0 ? `${hours}h ${rest}m` : `${minutes % 60}m`;
}

export function minutesToHours(minutes: number) {
  return Math.round((minutes / 60) * 100) / 100;
}

export function formatAddisTime(value: string | Date | null | undefined) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Addis_Ababa',
  }).format(new Date(value));
}

/** Same wording as the attendance approval screen: time plus late/early detail, or why it is missing. */
export function sessionPunchLabel(session: AttendanceSession, direction: 'IN' | 'OUT') {
  const value = direction === 'IN' ? session.checkInAt : session.checkOutAt;
  const status = direction === 'IN' ? session.checkInStatus : session.checkOutStatus;
  if (!value && status === 'ON_LEAVE') return '';
  if (!value) return status === 'PENDING' ? 'Pending' : direction === 'IN' ? 'Missing check-in' : 'Missing check-out';
  const time = formatAddisTime(value);
  if (direction === 'IN' && status === 'LATE') return `${time} Late (${session.lateMinutes} min)`;
  if (direction === 'IN' && new Date(value).getTime() < new Date(session.scheduledStartAt).getTime()) return `${time} Early check-in`;
  if (direction === 'OUT' && status === 'EARLY') return `${time} Early (${session.earlyCheckoutMinutes} min)`;
  if (direction === 'OUT' && status === 'LATE') return `${time} Late check-out (${session.lateCheckoutMinutes ?? 0} min)`;
  if (status === 'PENDING') return `${time} Pending`;
  return time;
}

export function sessionStatusLabel(session: AttendanceSession) {
  if (session.attendanceStatus === 'PRESENT') return 'Present';
  if (session.attendanceStatus === 'ABSENT') return 'Absent';
  if (session.attendanceStatus === 'ON_LEAVE') return 'On leave';
  return 'Pending';
}

export function isNoDutyDay(record: any) {
  return record.isOffDay || (record.isHoliday && !(record.sessionEvaluations ?? []).length);
}

/**
 * One check-in, check-out and status column per session. Each slot is named after its session
 * (e.g. Morning, Afternoon) when every shift in the report agrees, otherwise it is numbered.
 */
export function buildSessionSlotColumns(sessionsByRow: AttendanceSession[][]) {
  const slotCount = Math.max(1, ...sessionsByRow.map((sessions) => sessions.length));
  const slotNames = Array.from({ length: slotCount }, (_, index) => {
    const names = new Set(sessionsByRow.map((sessions) => sessions[index]?.name).filter(Boolean));
    return names.size === 1 ? [...names][0] : `Session ${index + 1}`;
  });
  const columns = slotNames.flatMap((name, index) => [
    { key: `session${index + 1}In`, label: `${name} check-in` },
    { key: `session${index + 1}Out`, label: `${name} check-out` },
    { key: `session${index + 1}Status`, label: `${name} status` },
  ]);
  return { slotCount, columns };
}

export function sessionSlotValues(record: any, sessions: AttendanceSession[], slotCount: number) {
  const slots: Record<string, string> = {};
  if (sessions.length > 0) {
    sessions.forEach((session, index) => {
      slots[`session${index + 1}In`] = sessionPunchLabel(session, 'IN');
      slots[`session${index + 1}Out`] = sessionPunchLabel(session, 'OUT');
      slots[`session${index + 1}Status`] = sessionStatusLabel(session);
    });
    return slots;
  }

  // Off days, holidays and records without a shift: first and last punch only.
  const noDuty = isNoDutyDay(record);
  slots.session1In = formatAddisTime(record.checkInAt) || (noDuty ? '' : 'No punches');
  slots[`session${slotCount}Out`] = formatAddisTime(record.checkOutAt);
  slots.session1Status = noDuty
    ? record.isHoliday ? `Holiday${record.holiday?.nameEn ? `: ${record.holiday.nameEn}` : ''}` : 'Off day'
    : dayStatusLabel(record);
  return slots;
}

/** Status for a duty day that has no session breakdown, from its payroll day values. */
function dayStatusLabel(record: any) {
  if (Number(record.leaveDays ?? 0) > 0) return 'On leave';
  if (record.isBiometricExempt) return 'Exempt';
  if (Number(record.absenceDays ?? 0) > 0) return 'Absent';
  if (Number(record.attendanceDays ?? 0) > 0) return 'Present';
  return '';
}
