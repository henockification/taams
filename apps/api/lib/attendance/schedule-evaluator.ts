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
// An undeclared punch this long after the check-in means the employee left
// (early checkout); anything sooner is treated as an accidental duplicate.
const EARLY_CHECKOUT_GAP = 60 * MINUTE;
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

function sessionPunches(
  punches: AttendancePunchLike[],
  spanStart: Date,
  spanEnd: Date,
  midpoint: Date,
) {
  const inSpan = punches.filter((punch) => {
    const at = asDate(punch.punchTime).getTime();
    return at >= spanStart.getTime() && at < spanEnd.getTime();
  });
  // The earliest check-in wins. Undeclared punches in the first half of the
  // session are check-ins, so a duplicate 08:40 after an 08:24 check-in is ignored.
  const checkIn = inSpan.find((punch) => {
    const declaredDirection = punchDirection(punch.punchType);
    return declaredDirection ? declaredDirection === 'IN' : asDate(punch.punchTime).getTime() < midpoint.getTime();
  }) ?? null;
  const checkInTime = checkIn ? asDate(checkIn.punchTime).getTime() : null;
  // The latest checkout wins, so repeated punches (12:02 then 12:14) collapse to
  // the last one. An undeclared punch in the second half is a checkout, as is
  // one at least EARLY_CHECKOUT_GAP after the check-in (the employee left early).
  const checkOut = inSpan.filter((punch) => {
    if (punch === checkIn) return false;
    const declaredDirection = punchDirection(punch.punchType);
    if (declaredDirection) return declaredDirection === 'OUT';
    const at = asDate(punch.punchTime).getTime();
    return at >= midpoint.getTime() || (checkInTime !== null && at - checkInTime >= EARLY_CHECKOUT_GAP);
  }).at(-1) ?? null;
  return { checkIn, checkOut };
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
  // Shift tolerances:
  // - gracePeriodMinutes: approved early check-in before the first session (08:00-08:30).
  // - lateAfterMinutes: minutes after a session start before a check-in counts as late.
  // - earlyOutBeforeMinutes: approved checkout window after each session end
  //   (12:30-12:45, 17:30-17:45) and approved early return before later sessions (13:15-13:30).
  // A checkout before the session end is early; a check-in after start + lateAfter is late.
  const grace = Math.max(0, Number(shift.gracePeriodMinutes ?? 0));
  const lateAfter = Math.max(0, Number(shift.lateAfterMinutes ?? 0));
  const departureTolerance = Math.max(0, Number(shift.earlyOutBeforeMinutes ?? 0));
  const asOf = options.asOf ?? new Date();
  const approvedCheckInOpen = (index: number) => new Date(
    scheduled[index].start.getTime() - (index === 0 ? grace : departureTolerance) * MINUTE,
  );
  const approvedCheckOutClose = (index: number) => new Date(scheduled[index].end.getTime() + departureTolerance * MINUTE);
  // Punches between two sessions belong to the earlier session's checkout or the
  // later session's check-in, split halfway between the two approved windows.
  const boundaries = scheduled.slice(0, -1).map((_, index) => {
    const checkOutClose = approvedCheckOutClose(index).getTime();
    const checkInOpen = approvedCheckInOpen(index + 1).getTime();
    const [from, to] = checkOutClose <= checkInOpen
      ? [checkOutClose, checkInOpen]
      : [scheduled[index].end.getTime(), scheduled[index + 1].start.getTime()];
    return new Date(from + (to - from) / 2);
  });
  const offDuty = DAY - (scheduled.at(-1)!.end.getTime() - scheduled[0].start.getTime());
  const firstSpanStart = offDuty > 0
    ? new Date(Math.min(approvedCheckInOpen(0).getTime(), scheduled[0].start.getTime() - offDuty / 2))
    : approvedCheckInOpen(0);
  const lastSpanEnd = offDuty > 0
    ? new Date(Math.max(approvedCheckOutClose(scheduled.length - 1).getTime(), scheduled.at(-1)!.end.getTime() + offDuty / 2))
    : new Date(scheduled.at(-1)!.end.getTime() + DAY);

  const sessions: AttendanceSessionEvaluation[] = scheduled.map(({ segment, start, end }, index) => {
    const next = scheduled[index + 1];
    const spanStart = index === 0 ? firstSpanStart : boundaries[index - 1];
    const spanEnd = next ? boundaries[index] : lastSpanEnd;
    const midpoint = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
    const completionAt = next ? spanEnd : approvedCheckOutClose(index);
    const { checkIn: checkInPunch, checkOut: checkOutPunch } = sessionPunches(ordered, spanStart, spanEnd, midpoint);
    const checkInAt = checkInPunch ? asDate(checkInPunch.punchTime) : null;
    const checkOutAt = checkOutPunch ? asDate(checkOutPunch.punchTime) : null;
    const completed = asOf.getTime() >= completionAt.getTime();
    const lateThreshold = start.getTime() + lateAfter * MINUTE;
    const approvedCheckoutEnd = approvedCheckOutClose(index).getTime();
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
