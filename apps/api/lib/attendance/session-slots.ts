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
  return [...((record.sessionEvaluations ?? []) as AttendanceSession[])]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(materializeSession);
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
  slots.session1In = formatAddisTime(record.checkInAt);
  slots[`session${slotCount}Out`] = formatAddisTime(record.checkOutAt);
  slots.session1Status = isNoDutyDay(record)
    ? record.isHoliday ? `Holiday${record.holiday?.nameEn ? `: ${record.holiday.nameEn}` : ''}` : 'Off day'
    : '';
  return slots;
}
