export type AttendanceScheduleSegment = {
  id?: string | null;
  nameEn?: string | null;
  startTime: string;
  endTime: string;
  sortOrder?: number | null;
  isActive?: boolean | null;
};

export type AttendanceScheduleShift = {
  gracePeriodMinutes?: number | null;
  lateAfterMinutes?: number | null;
  earlyOutBeforeMinutes?: number | null;
  isOvernight?: boolean | null;
  segments?: AttendanceScheduleSegment[];
};

export type AttendancePunchLike = { id: string; punchTime: Date | string; punchType?: string | null };

export type AttendanceSessionEvaluation = {
  segmentId: string;
  name: string;
  sortOrder: number;
  scheduledStartAt: Date;
  scheduledEndAt: Date;
  completionAt: Date;
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInStatus: 'ON_TIME' | 'LATE' | 'MISSING' | 'PENDING';
  checkOutStatus: 'ON_TIME' | 'EARLY' | 'LATE' | 'MISSING' | 'PENDING';
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'PENDING';
  lateMinutes: number;
  earlyCheckoutMinutes: number;
  lateCheckoutMinutes: number;
};

export type AttendanceScheduleEvaluation = {
  checkInAt: Date | null;
  checkOutAt: Date | null;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  lateMinutes: number;
  lateReturnMinutes: number;
  earlyBreakMinutes: number;
  earlyDepartureMinutes: number;
  unapprovedOvertimeMinutes: number;
  attendanceDays: number;
  sessions: AttendanceSessionEvaluation[];
  toleranceStatus: 'NONE' | 'WITHIN_TOLERANCE' | 'LATE' | 'EARLY_BREAK' | 'EARLY_DEPARTURE';
};

const MINUTE = 60_000;
const DAY = 86_400_000;
const ADDIS_OFFSET_HOURS = 3;

function asDate(value: Date | string) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

/** Convert an Ethiopian wall-clock schedule value into its UTC instant. */
export function addisDateAtTime(date: string, value: string) {
  const [year, month, day] = date.split('-').map(Number);
  const [hours, minutes, seconds = '0'] = value.split(':');
  return new Date(Date.UTC(year, month - 1, day, Number(hours) - ADDIS_OFFSET_HOURS, Number(minutes), Number(seconds), 0));
}

export function addisDayRange(date: string) {
  const start = addisDateAtTime(date, '00:00:00');
  return { start, end: new Date(start.getTime() + DAY - 1) };
}

export function addisToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function punchDirection(punchType?: string | null): 'IN' | 'OUT' | null {
  if (punchType === 'IN' || punchType === 'BREAK_IN') return 'IN';
  if (punchType === 'OUT' || punchType === 'BREAK_OUT') return 'OUT';
  return null;
}

function deduplicatePunches(punches: AttendancePunchLike[]) {
  const sorted = [...punches].sort((a, b) => asDate(a.punchTime).getTime() - asDate(b.punchTime).getTime());
  return sorted.filter((punch, index) => {
    if (index === 0) return true;
    const previous = sorted[index - 1];
    const elapsed = asDate(punch.punchTime).getTime() - asDate(previous.punchTime).getTime();
    if (elapsed > 2 * MINUTE) return true;
    const direction = punchDirection(punch.punchType);
    const previousDirection = punchDirection(previous.punchType);
    return direction !== previousDirection || (direction === null && punch.punchType !== previous.punchType);
  });
}

function punchInWindow(
  punches: AttendancePunchLike[],
  direction: 'IN' | 'OUT',
  windowStart: Date,
  windowEnd: Date,
  preference: 'FIRST' | 'LAST',
) {
  const candidates = punches.filter((punch) => {
    const at = asDate(punch.punchTime).getTime();
    const declaredDirection = punchDirection(punch.punchType);
    return at >= windowStart.getTime()
      && at < windowEnd.getTime()
      && (!declaredDirection || declaredDirection === direction);
  });
  return preference === 'FIRST' ? candidates[0] ?? null : candidates.at(-1) ?? null;
}

/** Evaluate every configured schedule segment as an independent attendance session. */
export function evaluateAttendancePunches(
  attendanceDate: string,
  punches: AttendancePunchLike[],
  shift?: AttendanceScheduleShift | null,
  options: { asOf?: Date } = {},
): AttendanceScheduleEvaluation {
  const ordered = deduplicatePunches(punches);
  const segments = [...(shift?.segments ?? [])]
    .filter((segment) => segment.isActive !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (!shift || segments.length === 0) {
    return {
      checkInAt: ordered[0] ? asDate(ordered[0].punchTime) : null,
      checkOutAt: ordered.length > 1 ? asDate(ordered[ordered.length - 1].punchTime) : null,
      scheduledStartAt: null,
      scheduledEndAt: null,
      lateMinutes: 0,
      lateReturnMinutes: 0,
      earlyBreakMinutes: 0,
      earlyDepartureMinutes: 0,
      unapprovedOvertimeMinutes: 0,
      attendanceDays: ordered.length === 0 ? 0 : ordered.length === 1 ? 0.5 : 1,
      sessions: [],
      toleranceStatus: 'NONE',
    };
  }

  const scheduled: Array<{ segment: AttendanceScheduleSegment; start: Date; end: Date }> = [];
  for (const segment of segments) {
    let start = addisDateAtTime(attendanceDate, segment.startTime);
    if (scheduled.length > 0 && start.getTime() < scheduled.at(-1)!.end.getTime()) start = new Date(start.getTime() + DAY);
    let end = addisDateAtTime(attendanceDate, segment.endTime);
    while (end.getTime() <= start.getTime()) end = new Date(end.getTime() + DAY);
    scheduled.push({ segment, start, end });
  }
  const grace = Math.max(0, Number(shift.gracePeriodMinutes ?? 0));
  const lateAfter = Math.max(0, Number(shift.lateAfterMinutes ?? 0));
  const departureTolerance = Math.max(0, Number(shift.earlyOutBeforeMinutes ?? 0));
  const asOf = options.asOf ?? new Date();

  const sessions: AttendanceSessionEvaluation[] = scheduled.map(({ segment, start, end }, index) => {
    const next = scheduled[index + 1];
    // Session windows are intentionally non-overlapping. UNKNOWN punches in
    // the check-in window remain check-ins (the earliest wins), so a repeated
    // 09:24 punch cannot become a 12:30 checkout. The configured tolerances
    // define the approved early-arrival and checkout boundary windows.
    const checkInWindowStart = new Date(start.getTime() - (index === 0 ? grace : departureTolerance) * MINUTE);
    const checkOutWindowStart = new Date(end.getTime() - departureTolerance * MINUTE);
    const checkInWindowEnd = checkOutWindowStart.getTime() > checkInWindowStart.getTime()
      ? checkOutWindowStart
      : new Date(start.getTime() + Math.max(MINUTE, (end.getTime() - start.getTime()) / 2));
    const checkOutWindowEnd = next
      ? new Date(next.start.getTime() - departureTolerance * MINUTE)
      : new Date(end.getTime() + DAY);
    const completionAt = next ? checkOutWindowEnd : new Date(end.getTime() + departureTolerance * MINUTE);
    const checkInPunch = punchInWindow(ordered, 'IN', checkInWindowStart, checkInWindowEnd, 'FIRST');
    const checkOutPunch = punchInWindow(ordered, 'OUT', checkOutWindowStart, checkOutWindowEnd, 'LAST');
    const checkInAt = checkInPunch ? asDate(checkInPunch.punchTime) : null;
    const checkOutAt = checkOutPunch ? asDate(checkOutPunch.punchTime) : null;
    const completed = asOf.getTime() >= completionAt.getTime();
    const lateThreshold = start.getTime() + lateAfter * MINUTE;
    const approvedCheckoutEnd = end.getTime() + departureTolerance * MINUTE;
    const lateMinutes = checkInAt && checkInAt.getTime() > lateThreshold
      ? Math.max(0, Math.floor((checkInAt.getTime() - start.getTime()) / MINUTE))
      : 0;
    const earlyCheckoutMinutes = checkOutAt && checkOutAt.getTime() < end.getTime()
      ? Math.max(0, Math.floor((end.getTime() - checkOutAt.getTime()) / MINUTE))
      : 0;
    const lateCheckoutMinutes = checkOutAt && checkOutAt.getTime() > approvedCheckoutEnd
      ? Math.max(0, Math.floor((checkOutAt.getTime() - approvedCheckoutEnd) / MINUTE))
      : 0;

    return {
      segmentId: segment.id ?? `${attendanceDate}:${segment.sortOrder ?? index + 1}`,
      name: segment.nameEn ?? `Session ${index + 1}`,
      sortOrder: segment.sortOrder ?? index + 1,
      scheduledStartAt: start,
      scheduledEndAt: end,
      completionAt,
      checkInAt,
      checkOutAt,
      checkInStatus: checkInAt ? (lateMinutes > 0 ? 'LATE' : 'ON_TIME') : completed ? 'MISSING' : 'PENDING',
      checkOutStatus: checkOutAt
        ? earlyCheckoutMinutes > 0
          ? 'EARLY'
          : lateCheckoutMinutes > 0
            ? 'LATE'
            : 'ON_TIME'
        : completed ? 'MISSING' : 'PENDING',
      attendanceStatus: checkInAt && checkOutAt ? 'PRESENT' : completed ? 'ABSENT' : 'PENDING',
      lateMinutes,
      earlyCheckoutMinutes,
      lateCheckoutMinutes,
    };
  });

  const firstCheckIn = sessions.find((session) => session.checkInAt)?.checkInAt ?? null;
  const lastCheckOut = [...sessions].reverse().find((session) => session.checkOutAt)?.checkOutAt ?? null;
  const scheduledStartAt = scheduled[0].start;
  const scheduledEndAt = scheduled.at(-1)!.end;
  const lateMinutes = sessions[0]?.lateMinutes ?? 0;
  const lateReturnMinutes = sessions.slice(1).reduce((total, session) => total + session.lateMinutes, 0);
  const earlyBreakMinutes = sessions.slice(0, -1).reduce((total, session) => total + (session.checkOutStatus === 'EARLY' ? session.earlyCheckoutMinutes : 0), 0);
  const finalSession = sessions.at(-1);
  const earlyDepartureMinutes = finalSession?.checkOutStatus === 'EARLY' ? finalSession.earlyCheckoutMinutes : 0;
  const attendanceDays = sessions.filter((session) => session.attendanceStatus === 'PRESENT').length / sessions.length;

  return {
    checkInAt: firstCheckIn,
    checkOutAt: lastCheckOut,
    scheduledStartAt,
    scheduledEndAt,
    lateMinutes,
    lateReturnMinutes,
    earlyBreakMinutes,
    earlyDepartureMinutes,
    unapprovedOvertimeMinutes: 0,
    attendanceDays,
    sessions,
    toleranceStatus: lateMinutes > 0 || lateReturnMinutes > 0
      ? 'LATE'
      : earlyBreakMinutes > 0
        ? 'EARLY_BREAK'
        : earlyDepartureMinutes > 0
          ? 'EARLY_DEPARTURE'
          : sessions.some((session) => session.checkInAt || session.checkOutAt)
            ? 'WITHIN_TOLERANCE'
            : 'NONE',
  };
}
