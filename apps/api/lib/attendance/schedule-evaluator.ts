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
  checkInAt: Date | null;
  checkOutAt: Date | null;
  checkInStatus: 'ON_TIME' | 'LATE' | 'MISSING' | 'PENDING';
  checkOutStatus: 'ON_TIME' | 'EARLY' | 'MISSING' | 'PENDING';
  attendanceStatus: 'PRESENT' | 'ABSENT' | 'PENDING';
  lateMinutes: number;
  earlyCheckoutMinutes: number;
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

type Slot = { at: Date; direction: 'IN' | 'OUT' };

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

/** Align punches to schedule slots while preserving chronological order. */
function matchPunchesToSlots(punches: AttendancePunchLike[], slots: Slot[]) {
  const missingSlotCost = 6 * 60;
  const unusedPunchCost = 6 * 60;
  const rows = punches.length + 1;
  const columns = slots.length + 1;
  const costs = Array.from({ length: rows }, () => Array<number>(columns).fill(Number.POSITIVE_INFINITY));
  const actions = Array.from({ length: rows }, () => Array<'MATCH' | 'SKIP_PUNCH' | 'SKIP_SLOT' | null>(columns).fill(null));
  costs[0][0] = 0;

  for (let punchIndex = 0; punchIndex < rows; punchIndex += 1) {
    for (let slotIndex = 0; slotIndex < columns; slotIndex += 1) {
      const current = costs[punchIndex][slotIndex];
      if (!Number.isFinite(current)) continue;
      if (punchIndex < punches.length && current + unusedPunchCost < costs[punchIndex + 1][slotIndex]) {
        costs[punchIndex + 1][slotIndex] = current + unusedPunchCost;
        actions[punchIndex + 1][slotIndex] = 'SKIP_PUNCH';
      }
      if (slotIndex < slots.length && current + missingSlotCost < costs[punchIndex][slotIndex + 1]) {
        costs[punchIndex][slotIndex + 1] = current + missingSlotCost;
        actions[punchIndex][slotIndex + 1] = 'SKIP_SLOT';
      }
      if (punchIndex < punches.length && slotIndex < slots.length) {
        const direction = punchDirection(punches[punchIndex].punchType);
        if (direction && direction !== slots[slotIndex].direction) continue;
        const distance = Math.abs(asDate(punches[punchIndex].punchTime).getTime() - slots[slotIndex].at.getTime()) / MINUTE;
        if (current + distance <= costs[punchIndex + 1][slotIndex + 1]) {
          costs[punchIndex + 1][slotIndex + 1] = current + distance;
          actions[punchIndex + 1][slotIndex + 1] = 'MATCH';
        }
      }
    }
  }

  const matches = new Map<number, AttendancePunchLike>();
  let punchIndex = punches.length;
  let slotIndex = slots.length;
  while (punchIndex > 0 || slotIndex > 0) {
    const action = actions[punchIndex][slotIndex];
    if (action === 'MATCH') {
      matches.set(slotIndex - 1, punches[punchIndex - 1]);
      punchIndex -= 1;
      slotIndex -= 1;
    } else if (action === 'SKIP_PUNCH') {
      punchIndex -= 1;
    } else if (action === 'SKIP_SLOT') {
      slotIndex -= 1;
    } else {
      break;
    }
  }
  return matches;
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
  const slots = scheduled.flatMap((item): Slot[] => [
    { at: item.start, direction: 'IN' },
    { at: item.end, direction: 'OUT' },
  ]);
  const matches = matchPunchesToSlots(ordered, slots);
  const grace = Math.max(0, Number(shift.gracePeriodMinutes ?? 0));
  const lateAfter = Math.max(0, Number(shift.lateAfterMinutes ?? 0));
  const departureTolerance = Math.max(0, Number(shift.earlyOutBeforeMinutes ?? 0));
  const asOf = options.asOf ?? new Date();

  const sessions: AttendanceSessionEvaluation[] = scheduled.map(({ segment, start, end }, index) => {
    const checkInAt = matches.get(index * 2) ? asDate(matches.get(index * 2)!.punchTime) : null;
    const checkOutAt = matches.get(index * 2 + 1) ? asDate(matches.get(index * 2 + 1)!.punchTime) : null;
    const completed = asOf.getTime() >= end.getTime();
    const lateThreshold = start.getTime() + (grace + lateAfter) * MINUTE;
    const earlyThreshold = end.getTime() - departureTolerance * MINUTE;
    const lateMinutes = checkInAt && checkInAt.getTime() > lateThreshold
      ? Math.max(0, Math.floor((checkInAt.getTime() - start.getTime()) / MINUTE))
      : 0;
    const earlyCheckoutMinutes = checkOutAt && checkOutAt.getTime() < earlyThreshold
      ? Math.max(0, Math.floor((end.getTime() - checkOutAt.getTime()) / MINUTE))
      : 0;

    return {
      segmentId: segment.id ?? `${attendanceDate}:${segment.sortOrder ?? index + 1}`,
      name: segment.nameEn ?? `Session ${index + 1}`,
      sortOrder: segment.sortOrder ?? index + 1,
      scheduledStartAt: start,
      scheduledEndAt: end,
      checkInAt,
      checkOutAt,
      checkInStatus: checkInAt ? (lateMinutes > 0 ? 'LATE' : 'ON_TIME') : completed ? 'MISSING' : 'PENDING',
      checkOutStatus: checkOutAt ? (earlyCheckoutMinutes > 0 ? 'EARLY' : completed ? 'ON_TIME' : 'PENDING') : completed ? 'MISSING' : 'PENDING',
      attendanceStatus: checkInAt && checkOutAt ? 'PRESENT' : completed ? 'ABSENT' : 'PENDING',
      lateMinutes,
      earlyCheckoutMinutes,
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
  const latestPunch = ordered.at(-1) ? asDate(ordered.at(-1)!.punchTime) : null;
  const unapprovedOvertimeMinutes = latestPunch && latestPunch.getTime() > scheduledEndAt.getTime() + departureTolerance * MINUTE
    ? Math.floor((latestPunch.getTime() - scheduledEndAt.getTime()) / MINUTE)
    : 0;
  const attendanceDays = sessions.filter((session) => session.attendanceStatus === 'PRESENT').length / sessions.length;

  return {
    checkInAt: firstCheckIn,
    checkOutAt: !lastCheckOut ? null : lastCheckOut.getTime() <= scheduledEndAt.getTime() + departureTolerance * MINUTE ? lastCheckOut : scheduledEndAt,
    scheduledStartAt,
    scheduledEndAt,
    lateMinutes,
    lateReturnMinutes,
    earlyBreakMinutes,
    earlyDepartureMinutes,
    unapprovedOvertimeMinutes,
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
