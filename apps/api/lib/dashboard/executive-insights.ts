/**
 * Executive dashboard insights, computed from the same classified employee-days as the
 * headline cards (see executive-metrics), so every number here agrees with them:
 *   due      = ON_TIME + LATE + ABSENT (people who have not arrived yet today count as ABSENT)
 *   present  = ON_TIME + LATE
 * Comparisons are like-for-like: a live day is compared with the previous working day at the
 * same clock time, never with a finished day.
 */
import { addisDateAtTime } from '../attendance/schedule-evaluator';
import { num, rate, round1, type ClassifiedDay, type DayStatus } from './executive-metrics';

export type InsightRecord = ClassifiedDay['record'] & {
  lateReturnMinutes?: number | null;
  earlyBreakMinutes?: number | null;
  earlyDepartureMinutes?: number | null;
  scheduledEndAt?: Date | string | null;
};

export type InsightDay = Omit<ClassifiedDay, 'record'> & {
  date: string;
  departmentId: string | null;
  notYetArrived: boolean;
  record: InsightRecord;
};

type Session = {
  scheduledStartAt?: string | Date | null;
  scheduledEndAt?: string | Date | null;
  completionAt?: string | Date | null;
  checkInAt?: string | Date | null;
};

const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;
export const ARRIVAL_CURVE_START_MINUTE = 6 * 60;
export const ARRIVAL_CURVE_END_MINUTE = 12 * 60;
export const ARRIVAL_CURVE_STEP_MINUTES = 15;
/** Same weekday this many weeks back are averaged into the "typical day" arrival curve. */
export const TYPICAL_DAY_SAMPLE = 4;
export const REPEAT_LATE_DAYS = 5;
export const REPEAT_ABSENT_DAYS = 3;
export const WEEKDAY_LATENESS_WEEKS = 8;

export function isPresent(status: DayStatus) {
  return status === 'ON_TIME' || status === 'LATE';
}

export function isDue(status: DayStatus) {
  return status === 'ON_TIME' || status === 'LATE' || status === 'ABSENT';
}

/**
 * The day's status as it stood at `cutoff`: present days whose first check-in came later
 * were still absent then (or on leave, for a part-day leave). Other statuses do not depend
 * on the time of day.
 */
export function statusAsOf(day: Pick<InsightDay, 'status' | 'leave' | 'record'>, cutoff: Date): DayStatus {
  if (!isPresent(day.status)) return day.status;
  const checkIn = day.record.checkInAt ? new Date(day.record.checkInAt) : null;
  // Present without a check-in time (e.g. an approved correction): it cannot be timed, keep it.
  if (!checkIn || checkIn.getTime() <= cutoff.getTime()) return day.status;
  return day.leave ? 'LEAVE' : 'ABSENT';
}

/** Days as they stood at `cutoff` (used for the previous day "at the same time"). */
export function daysAsOf<T extends InsightDay>(days: T[], cutoff: Date): T[] {
  return days.map((day) => {
    const status = statusAsOf(day, cutoff);
    return status === day.status ? day : { ...day, status };
  });
}

/** Latest date before `before` on which anyone in scope was due to work. */
export function previousWorkingDate(days: Array<Pick<InsightDay, 'date' | 'status'>>, before: string) {
  let latest: string | null = null;
  for (const day of days) {
    if (day.date < before && isDue(day.status) && (!latest || day.date > latest)) latest = day.date;
  }
  return latest;
}

/** The same instant of the clock on another date (Addis Ababa has no daylight saving). */
export function sameClockOn(now: Date, fromDate: string, toDate: string) {
  return new Date(now.getTime() - (Date.parse(`${fromDate}T00:00:00Z`) - Date.parse(`${toDate}T00:00:00Z`)));
}

export function addisClock(value: Date | string) {
  const local = new Date(new Date(value).getTime() + ADDIS_OFFSET_MS);
  return `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
}

function minuteLabel(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

/** When the employee counts as arrived; -Infinity for present days without a check-in time. */
function arrivalTime(day: InsightDay) {
  if (!isPresent(day.status)) return null;
  return day.record.checkInAt ? new Date(day.record.checkInAt).getTime() : Number.NEGATIVE_INFINITY;
}

/**
 * Share of staff due who had arrived by each quarter hour of the morning, for the focus day
 * and for a typical day (the same weekday in recent weeks).
 */
export function arrivalCurve(input: { days: InsightDay[]; focusDate: string; now: Date; isLive: boolean }) {
  const dueByDate = new Map<string, InsightDay[]>();
  for (const day of input.days) {
    if (!isDue(day.status)) continue;
    const list = dueByDate.get(day.date);
    if (list) list.push(day);
    else dueByDate.set(day.date, [day]);
  }
  const focusDue = dueByDate.get(input.focusDate) ?? [];
  if (focusDue.length === 0) return null;

  const typicalDates: string[] = [];
  for (let week = 1; week <= TYPICAL_DAY_SAMPLE * 2 && typicalDates.length < TYPICAL_DAY_SAMPLE; week += 1) {
    const date = new Date(Date.parse(`${input.focusDate}T00:00:00Z`) - week * 7 * DAY_MS).toISOString().slice(0, 10);
    if ((dueByDate.get(date) ?? []).length > 0) typicalDates.push(date);
  }

  const arrivedShare = (date: string, minute: number) => {
    const due = dueByDate.get(date) ?? [];
    const cutoff = addisDateAtTime(date, minuteLabel(minute)).getTime();
    const arrived = due.filter((day) => {
      const time = arrivalTime(day);
      return time !== null && time <= cutoff;
    }).length;
    return rate(arrived, due.length);
  };

  const points = [];
  for (let minute = ARRIVAL_CURVE_START_MINUTE; minute <= ARRIVAL_CURVE_END_MINUTE; minute += ARRIVAL_CURVE_STEP_MINUTES) {
    const instant = addisDateAtTime(input.focusDate, minuteLabel(minute));
    const typicalValues = typicalDates.map((date) => arrivedShare(date, minute)).filter((value): value is number => value !== null);
    points.push({
      time: minuteLabel(minute),
      focus: input.isLive && instant.getTime() > input.now.getTime() ? null : arrivedShare(input.focusDate, minute),
      typical: typicalValues.length ? round1(typicalValues.reduce((sum, value) => sum + value, 0) / typicalValues.length) : null,
    });
  }

  return {
    date: input.focusDate,
    due: focusDue.length,
    typicalDates,
    shiftStart: mostCommon(focusDue.map((day) => (day.record.scheduledStartAt ? addisClock(day.record.scheduledStartAt) : null))),
    points,
  };
}

function sessionsOf(record: InsightRecord): Session[] {
  return Array.isArray(record.sessionEvaluations) ? record.sessionEvaluations as Session[] : [];
}

function minutesBetween(from: Date | string | null | undefined, to: Date | string | null | undefined) {
  if (!from || !to) return 0;
  const minutes = (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
  return Number.isFinite(minutes) && minutes > 0 ? minutes : 0;
}

/**
 * Working time lost on due days: late arrivals (all sessions), early departures (before a
 * break and at the end of the day) and scheduled sessions missed entirely. A session counts
 * as missed only once its check-in window has closed with no check-in, so people who may
 * still arrive today lose nothing yet. Days with part-day leave skip missed sessions (the
 * leave covers them).
 */
export function lostTime(days: InsightDay[], now: Date) {
  let lateMinutes = 0;
  let earlyLeaveMinutes = 0;
  let missedMinutes = 0;
  let scheduledMinutes = 0;
  let scheduledDays = 0;

  for (const day of days) {
    if (!isDue(day.status)) continue;
    const record = day.record;
    const sessions = sessionsOf(record);
    const dayScheduled = sessions.length
      ? sessions.reduce((sum, session) => sum + minutesBetween(session.scheduledStartAt, session.scheduledEndAt), 0)
      : minutesBetween(record.scheduledStartAt, record.scheduledEndAt);
    if (dayScheduled > 0) {
      scheduledMinutes += dayScheduled;
      scheduledDays += 1;
    }

    if (isPresent(day.status)) {
      lateMinutes += num(record.lateMinutes) + num(record.lateReturnMinutes);
      earlyLeaveMinutes += num(record.earlyBreakMinutes) + num(record.earlyDepartureMinutes);
    }
    if (num(record.leaveDays) > 0) continue;

    if (sessions.length) {
      for (const session of sessions) {
        const closesAt = session.completionAt ?? session.scheduledEndAt;
        if (session.checkInAt || !closesAt || new Date(closesAt).getTime() > now.getTime()) continue;
        missedMinutes += minutesBetween(session.scheduledStartAt, session.scheduledEndAt);
      }
    } else if (day.status === 'ABSENT' && record.scheduledEndAt && new Date(record.scheduledEndAt).getTime() <= now.getTime()) {
      missedMinutes += dayScheduled;
    }
  }

  const totalMinutes = lateMinutes + earlyLeaveMinutes + missedMinutes;
  const workdayHours = scheduledDays ? round1(scheduledMinutes / scheduledDays / 60) : null;
  return {
    lateHours: round1(lateMinutes / 60),
    earlyLeaveHours: round1(earlyLeaveMinutes / 60),
    missedSessionHours: round1(missedMinutes / 60),
    totalHours: round1(totalMinutes / 60),
    /** Average scheduled hours of a due day in scope, used to express the loss in workdays. */
    workdayHours,
    equivalentWorkdays: workdayHours ? round1(totalMinutes / 60 / workdayHours) : null,
  };
}

/** Average minutes late of the late arrivals (first check-in of the day). */
export function averageLateMinutes(days: InsightDay[]) {
  const late = days.filter((day) => day.status === 'LATE');
  if (!late.length) return null;
  return Math.round(late.reduce((sum, day) => sum + num(day.record.lateMinutes), 0) / late.length);
}

/** Employees with a pattern in the window: late on `lateDays`+ days or absent on `absentDays`+ days. */
export function repeatCases(days: InsightDay[], thresholds = { lateDays: REPEAT_LATE_DAYS, absentDays: REPEAT_ABSENT_DAYS }) {
  const byEmployee = new Map<string, { employeeId: string; lateDays: number; absentDays: number; departmentId: string | null; lastDate: string }>();
  for (const day of days) {
    const late = day.status === 'LATE';
    // Not arrived yet is not a confirmed absence.
    const absent = day.status === 'ABSENT' && !day.notYetArrived;
    if (!late && !absent) continue;
    const entry = byEmployee.get(day.record.employeeId) ?? {
      employeeId: day.record.employeeId, lateDays: 0, absentDays: 0, departmentId: day.departmentId, lastDate: day.date,
    };
    if (late) entry.lateDays += 1;
    if (absent) entry.absentDays += 1;
    if (day.date >= entry.lastDate) {
      entry.lastDate = day.date;
      entry.departmentId = day.departmentId;
    }
    byEmployee.set(day.record.employeeId, entry);
  }
  const employees = [...byEmployee.values()]
    .filter((entry) => entry.lateDays >= thresholds.lateDays || entry.absentDays >= thresholds.absentDays)
    .sort((left, right) => right.absentDays - left.absentDays || right.lateDays - left.lateDays || left.employeeId.localeCompare(right.employeeId));
  return {
    lateThreshold: thresholds.lateDays,
    absentThreshold: thresholds.absentDays,
    lateCount: employees.filter((entry) => entry.lateDays >= thresholds.lateDays).length,
    absentCount: employees.filter((entry) => entry.absentDays >= thresholds.absentDays).length,
    employees: employees.map(({ lastDate: _lastDate, ...entry }) => entry),
  };
}

/** Late arrivals by weekday (1 = Monday … 7 = Sunday) as a share of those present. */
export function weekdayLateness(days: InsightDay[]) {
  const stats = new Map<number, { present: number; late: number; lateMinutes: number }>();
  for (const day of days) {
    if (!isPresent(day.status)) continue;
    const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay() || 7;
    const entry = stats.get(weekday) ?? { present: 0, late: 0, lateMinutes: 0 };
    entry.present += 1;
    if (day.status === 'LATE') {
      entry.late += 1;
      entry.lateMinutes += num(day.record.lateMinutes);
    }
    stats.set(weekday, entry);
  }
  return [...stats.entries()]
    .sort(([left], [right]) => left - right)
    .map(([weekday, entry]) => ({
      weekday,
      present: entry.present,
      late: entry.late,
      lateRate: rate(entry.late, entry.present) ?? 0,
      averageLateMinutes: entry.late ? Math.round(entry.lateMinutes / entry.late) : null,
    }));
}

/** Departments whose attendance rate rose or fell most against the comparison. */
export function departmentMovers<T extends { attendanceRate: number | null; comparisonRate: number | null; dueDays: number; comparisonDueDays: number }>(
  departments: T[],
  minDueDays: number,
  limit = 3,
) {
  const changes = departments
    .filter((department) => (
      department.attendanceRate !== null && department.comparisonRate !== null
      && department.dueDays >= minDueDays && department.comparisonDueDays >= minDueDays
    ))
    .map((department) => ({ ...department, change: round1(department.attendanceRate! - department.comparisonRate!) }));
  return {
    improved: changes.filter((item) => item.change > 0).sort((left, right) => right.change - left.change).slice(0, limit),
    declined: changes.filter((item) => item.change < 0).sort((left, right) => left.change - right.change).slice(0, limit),
  };
}

function mostCommon(values: Array<string | null>) {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: string | null = null;
  for (const [value, count] of counts) {
    if (best === null || count > counts.get(best)! || (count === counts.get(best)! && value < best)) best = value;
  }
  return best;
}
