/**
 * Executive dashboard metrics, computed from attendance daily records (the same
 * records supervisors and HR approve and payroll reads) rather than raw punches.
 *
 * Every employee-day gets exactly one status, applied in this order:
 *   REST            scheduled off day or full-day holiday (not a working day)
 *   LEAVE           approved leave covering the day (leave, official duty, remote, unpaid)
 *   EXEMPT          biometric-exempt: not expected to punch
 *   ON_TIME / LATE  checked in; LATE when the first session check-in was late
 *   NO_SCHEDULE     no work schedule, so we cannot tell whether they were due
 *   NOT_YET_ARRIVED today only, while the first session is still open
 *   ABSENT          due to work, no check-in
 * Rates exclude days that are not due (rest, leave, exempt, no schedule) and, for
 * today, people who may still arrive.
 */

export type DayStatus = 'REST' | 'LEAVE' | 'EXEMPT' | 'ON_TIME' | 'LATE' | 'NO_SCHEDULE' | 'NOT_YET_ARRIVED' | 'ABSENT';
export type LeaveCategory = 'LEAVE' | 'OFFICIAL_DUTY' | 'REMOTE' | 'UNPAID';

export type MetricRecord = {
  employeeId: string;
  attendanceDate: string;
  departmentId: string | null;
  status: string;
  checkInAt: Date | string | null;
  checkOutAt: Date | string | null;
  lateMinutes: number | null;
  attendanceDays: string | number | null;
  leaveDays: string | number | null;
  holidayDays: string | number | null;
  isOffDay: boolean | null;
  isBiometricExempt: boolean | null;
  scheduledStartAt: Date | string | null;
  sessionEvaluations: unknown;
  returnedAt?: Date | string | null;
};

export type LeaveCover = {
  employeeId: string;
  startDate: string;
  endDate: string;
  category: LeaveCategory;
  typeKey: string;
  typeLabel: string;
  /** Annual leave lists its approved dates; other leave covers start..end. */
  dates?: string[] | null;
  /**
   * Confirmed ISMIS leave: a full day of leave on its own, even before the attendance record
   * has been recalculated with the import (records are only refreshed for the confirmed range).
   */
  fullDay?: boolean;
};

export type ClassifiedDay = {
  record: MetricRecord;
  status: DayStatus;
  leave: { category: LeaveCategory; typeKey: string; typeLabel: string; days: number } | null;
};

export const ISMIS_LEAVE = { typeKey: 'ISMIS', typeLabel: 'Leave (ISMIS)' };

export function classifyDay(record: MetricRecord, covers: LeaveCover[], now: Date, today: string): ClassifiedDay {
  const date = String(record.attendanceDate).slice(0, 10);
  if (record.isOffDay || num(record.holidayDays) >= 1) return { record, status: 'REST', leave: null };

  const leaveDays = num(record.leaveDays);
  const cover = covers.find((item) => item.employeeId === record.employeeId && coversDate(item, date));
  const present = Boolean(record.checkInAt) || num(record.attendanceDays) > 0;
  // Unpaid leave is not counted in leaveDays (payroll treats it as absence) but the
  // employee is still on approved leave, not a no-show.
  const onLeave = leaveDays > 0 || cover?.category === 'UNPAID' || Boolean(cover?.fullDay);
  const leave = onLeave
    ? {
      category: cover?.category ?? 'LEAVE',
      typeKey: cover?.typeKey ?? ISMIS_LEAVE.typeKey,
      typeLabel: cover?.typeLabel ?? ISMIS_LEAVE.typeLabel,
      days: leaveDays > 0 && !cover?.fullDay ? Math.min(1, leaveDays) : 1,
    }
    : null;

  if (leave && (leaveDays >= 1 || cover?.category === 'UNPAID' || cover?.fullDay || !present)) return { record, status: 'LEAVE', leave };
  if (record.isBiometricExempt) return { record, status: 'EXEMPT', leave: null };
  if (present) return { record, status: num(record.lateMinutes) > 0 ? 'LATE' : 'ON_TIME', leave: null };

  const sessions = Array.isArray(record.sessionEvaluations) ? record.sessionEvaluations as Array<{ completionAt?: string }> : [];
  if (!record.scheduledStartAt && sessions.length === 0) return { record, status: 'NO_SCHEDULE', leave: null };
  if (date === today) {
    const firstClosesAt = sessions[0]?.completionAt ? new Date(sessions[0].completionAt) : null;
    if (!firstClosesAt || firstClosesAt.getTime() > now.getTime()) return { record, status: 'NOT_YET_ARRIVED', leave: null };
  }
  return { record, status: 'ABSENT', leave: null };
}

/**
 * Dashboards count anyone due who is not present as absent, so people who have not
 * arrived yet today are absent until they check in. `notYetArrived` keeps them visible.
 */
export function absentUntilArrived<T extends ClassifiedDay>(days: T[]): Array<T & { notYetArrived: boolean }> {
  return days.map((day) => (day.status === 'NOT_YET_ARRIVED'
    ? { ...day, status: 'ABSENT', notYetArrived: true }
    : { ...day, notYetArrived: false }));
}

export type StatusCounts =Record<DayStatus, number> & { officialDuty: number; remote: number; unpaid: number };

export function countStatuses(days: ClassifiedDay[]): StatusCounts {
  const counts: StatusCounts = {
    REST: 0, LEAVE: 0, EXEMPT: 0, ON_TIME: 0, LATE: 0, NO_SCHEDULE: 0, NOT_YET_ARRIVED: 0, ABSENT: 0,
    officialDuty: 0, remote: 0, unpaid: 0,
  };
  for (const day of days) {
    counts[day.status] += 1;
    if (day.status === 'LEAVE') {
      if (day.leave?.category === 'OFFICIAL_DUTY') counts.officialDuty += 1;
      if (day.leave?.category === 'REMOTE') counts.remote += 1;
      if (day.leave?.category === 'UNPAID') counts.unpaid += 1;
    }
  }
  return counts;
}

/** Present ÷ (present + absent). Null when nobody was due, so no fake 0% or 100%. */
export function attendanceRate(counts: StatusCounts) {
  const present = counts.ON_TIME + counts.LATE;
  return rate(present, present + counts.ABSENT);
}

/** On time ÷ present. */
export function punctualityRate(counts: StatusCounts) {
  return rate(counts.ON_TIME, counts.ON_TIME + counts.LATE);
}

/** Leave days (all categories) ÷ scheduled working days. */
export function leaveRate(counts: StatusCounts) {
  const scheduled = counts.LEAVE + counts.EXEMPT + counts.ON_TIME + counts.LATE + counts.NOT_YET_ARRIVED + counts.ABSENT;
  return rate(counts.LEAVE, scheduled);
}

/** Headline cards. `notYetArrived` is the part of absent still inside today's check-in window. */
export function workforceStatus(counts: StatusCounts, totalEmployees: number, notYetArrived: number) {
  return {
    totalEmployees,
    presentToday: counts.ON_TIME + counts.LATE,
    absentToday: counts.ABSENT,
    // Everyone on approved leave, as on the HR dashboard; field duty and remote are also shown on their own cards.
    onApprovedLeave: counts.LEAVE,
    lateArrivals: counts.LATE,
    workingRemotely: counts.remote,
    officialAssignment: counts.officialDuty,
    attendanceRate: attendanceRate(counts) ?? 0,
    notYetArrived,
    biometricExempt: counts.EXEMPT,
    restDays: counts.REST,
    noSchedule: counts.NO_SCHEDULE,
    punctualityRate: punctualityRate(counts),
  };
}

/** Mutually exclusive segments that add up to every classified employee-day. */
export function workforceDistribution(counts: StatusCounts, missingRecords: number) {
  const segments = [
    { id: 'onTime', label: 'Present on time', count: counts.ON_TIME },
    { id: 'late', label: 'Late', count: counts.LATE },
    { id: 'leave', label: 'On leave', count: counts.LEAVE - counts.officialDuty - counts.remote },
    { id: 'officialDuty', label: 'Official duty / remote', count: counts.officialDuty + counts.remote },
    { id: 'absent', label: 'Absent', count: counts.ABSENT },
    { id: 'notYetArrived', label: 'Not yet arrived', count: counts.NOT_YET_ARRIVED },
    { id: 'exempt', label: 'Biometric exempt', count: counts.EXEMPT },
    { id: 'rest', label: 'Rest day / holiday', count: counts.REST },
    { id: 'noSchedule', label: 'No work schedule', count: counts.NO_SCHEDULE },
    { id: 'notGenerated', label: 'Attendance not generated', count: missingRecords },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);
  return segments
    .filter((segment) => segment.count > 0)
    .map((segment) => ({ ...segment, percentage: rate(segment.count, total) ?? 0 }));
}

export function leaveSummary(days: ClassifiedDay[]) {
  const grouped = new Map<string, { id: string; label: string; category: LeaveCategory; days: number; employees: Set<string> }>();
  for (const day of days) {
    if (day.status !== 'LEAVE' || !day.leave) continue;
    const current = grouped.get(day.leave.typeKey) ?? {
      id: day.leave.typeKey, label: day.leave.typeLabel, category: day.leave.category, days: 0, employees: new Set<string>(),
    };
    current.days += day.leave.days;
    current.employees.add(day.record.employeeId);
    grouped.set(day.leave.typeKey, current);
  }
  return [...grouped.values()]
    .map((item) => ({ id: item.id, label: item.label, category: item.category, count: item.employees.size, days: round1(item.days) }))
    .sort((left, right) => right.days - left.days || left.label.localeCompare(right.label));
}

/** Rate trend compared with the previous period of the same length (±1 point = flat). */
export function trendDirection(current: number | null, previous: number | null): 'UP' | 'DOWN' | 'FLAT' | null {
  if (current === null || previous === null) return null;
  if (current - previous >= 1) return 'UP';
  if (previous - current >= 1) return 'DOWN';
  return 'FLAT';
}

export function coversDate(cover: LeaveCover, date: string) {
  if (cover.dates?.length) return cover.dates.includes(date);
  return cover.startDate <= date && cover.endDate >= date;
}

export function categorizeLeaveType(leaveType: { code?: string | null; nameEn?: string | null; nameAm?: string | null } | null | undefined): LeaveCategory {
  const code = String(leaveType?.code ?? '').trim().toUpperCase();
  if (code === 'UNPAID') return 'UNPAID';
  const text = `${leaveType?.code ?? ''} ${leaveType?.nameEn ?? ''}`.toLowerCase();
  if (text.includes('remote') || text.includes('work from home')) return 'REMOTE';
  if (text.includes('field') || text.includes('official') || text.includes('assignment') || text.includes('duty') || text.includes('training')) return 'OFFICIAL_DUTY';
  return 'LEAVE';
}

/** Dates (YYYY-MM-DD) from start to end inclusive, computed in UTC so no timezone drift. */
export function datesBetween(start: string, end: string) {
  const result: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Monday..Sunday week containing the date. */
export function weekRange(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  const start = addDays(date, day === 0 ? -6 : 1 - day);
  return { start, end: addDays(start, 6) };
}

export function monthRange(month: string) {
  const [year, monthNumber] = month.split('-').map(Number);
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, '0')}` };
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthNumber] = month.split('-').map(Number);
  const value = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return value.toISOString().slice(0, 7);
}

export function rate(value: number, total: number) {
  if (total <= 0) return null;
  return Math.round((value / total) * 1000) / 10;
}

export function num(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function round1(value: number) {
  return Math.round(value * 10) / 10;
}
