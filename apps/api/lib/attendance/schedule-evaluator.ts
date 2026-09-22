export type AttendanceScheduleSegment = {
  startTime: string;
  endTime: string;
  sortOrder?: number | null;
};

export type AttendanceScheduleShift = {
  gracePeriodMinutes?: number | null;
  lateAfterMinutes?: number | null;
  earlyOutBeforeMinutes?: number | null;
  isOvernight?: boolean | null;
  segments?: AttendanceScheduleSegment[];
};

export type AttendancePunchLike = { id: string; punchTime: Date | string; punchType?: string | null };

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
  toleranceStatus: 'NONE' | 'WITHIN_TOLERANCE' | 'LATE' | 'EARLY_BREAK' | 'EARLY_DEPARTURE';
};

function asDate(value: Date | string) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function atTime(date: string, value: string) {
  const [hours, minutes, seconds = '0'] = value.split(':');
  const result = new Date(`${date}T00:00:00`);
  result.setHours(Number(hours), Number(minutes), Number(seconds), 0);
  return result;
}

/**
 * Evaluates the punch sequence against the configured shift segments. Punches
 * are never deleted: this only selects the punches used for attendance and
 * deliberately leaves after-hours punches available as overtime evidence.
 */
export function evaluateAttendancePunches(
  attendanceDate: string,
  punches: AttendancePunchLike[],
  shift?: AttendanceScheduleShift | null,
): AttendanceScheduleEvaluation {
  const sorted = [...punches].sort((a, b) => asDate(a.punchTime).getTime() - asDate(b.punchTime).getTime());
  const ordered = sorted.filter((punch, index) => {
    if (index === 0 || !punch.punchType) return true;
    const previous = sorted[index - 1];
    if (punch.punchType === 'UNKNOWN' && previous.punchType === 'UNKNOWN') {
      return asDate(punch.punchTime).getTime() - asDate(previous.punchTime).getTime() > 2 * 60_000;
    }
    if (punch.punchType === 'UNKNOWN' || previous.punchType === 'UNKNOWN') return true;
    return previous.punchType !== punch.punchType || asDate(punch.punchTime).getTime() - asDate(previous.punchTime).getTime() > 2 * 60_000;
  });
  const segments = [...(shift?.segments ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (!shift || segments.length === 0 || ordered.length === 0) {
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
      toleranceStatus: 'NONE',
    };
  }

  const boundaries: Date[] = [];
  let previousEnd: Date | null = null;
  for (const segment of segments) {
    let start = atTime(attendanceDate, segment.startTime);
    let end = atTime(attendanceDate, segment.endTime);
    if (previousEnd && start.getTime() <= previousEnd.getTime()) start.setDate(start.getDate() + 1);
    if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1);
    boundaries.push(start, end);
    previousEnd = end;
  }

  const first = asDate(ordered[0].punchTime);
  const last = ordered.length > 1 ? asDate(ordered[ordered.length - 1].punchTime) : null;
  const scheduledStartAt = boundaries[0];
  const scheduledEndAt = boundaries[boundaries.length - 1];
  const grace = Math.max(0, Number(shift.gracePeriodMinutes ?? 0));
  const lateAfter = Math.max(0, Number(shift.lateAfterMinutes ?? 0));
  const departureTolerance = Math.max(0, Number(shift.earlyOutBeforeMinutes ?? 0));
  const lateThreshold = new Date(scheduledStartAt.getTime() + lateAfter * 60_000);
  const earlyWindow = new Date(scheduledStartAt.getTime() - grace * 60_000);
  const lateMinutes = first.getTime() > lateThreshold.getTime()
    ? Math.floor((first.getTime() - lateThreshold.getTime()) / 60_000)
    : 0;

  let lateReturnMinutes = 0;
  let earlyBreakMinutes = 0;
  if (segments.length > 1 && ordered.length >= 3) {
    const lunchOut = asDate(ordered[1].punchTime);
    earlyBreakMinutes = lunchOut.getTime() < boundaries[1].getTime()
      ? Math.floor((boundaries[1].getTime() - lunchOut.getTime()) / 60_000)
      : 0;
    const lunchStart = boundaries[2];
    const returnPunch = asDate(ordered[2].punchTime);
    lateReturnMinutes = returnPunch.getTime() > lunchStart.getTime()
      ? Math.floor((returnPunch.getTime() - lunchStart.getTime()) / 60_000)
      : 0;
  }

  const earlyDepartureMinutes = last && last.getTime() < scheduledEndAt.getTime()
    ? Math.floor((scheduledEndAt.getTime() - last.getTime()) / 60_000)
    : 0;
  const unapprovedOvertimeMinutes = last && last.getTime() > scheduledEndAt.getTime() + departureTolerance * 60_000
    ? Math.floor((last.getTime() - scheduledEndAt.getTime()) / 60_000)
    : 0;
  const withinTolerance = first.getTime() >= earlyWindow.getTime() && first.getTime() <= scheduledStartAt.getTime()
    || (last && last.getTime() > scheduledEndAt.getTime() && last.getTime() <= scheduledEndAt.getTime() + departureTolerance * 60_000);

  return {
    checkInAt: first,
    // Do not let an unapproved after-hours punch become the attendance checkout.
    checkOutAt: !last ? null : last.getTime() <= scheduledEndAt.getTime() + departureTolerance * 60_000 ? last : scheduledEndAt,
    scheduledStartAt,
    scheduledEndAt,
    lateMinutes,
    lateReturnMinutes,
    earlyBreakMinutes,
    earlyDepartureMinutes,
    unapprovedOvertimeMinutes,
    toleranceStatus: lateMinutes > 0 || lateReturnMinutes > 0 ? 'LATE' : earlyBreakMinutes > 0 ? 'EARLY_BREAK' : earlyDepartureMinutes > 0 ? 'EARLY_DEPARTURE' : withinTolerance ? 'WITHIN_TOLERANCE' : 'NONE',
  };
}
