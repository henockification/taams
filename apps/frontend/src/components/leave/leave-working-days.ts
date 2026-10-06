import type { LeaveCalendarDay } from '@/data/types/core.types';

/** Server-classified leave dates keyed by ISO date (see GET /leave/working-calendar). */
export type LeaveCalendar = Map<string, LeaveCalendarDay>;

export type AnnualDateSelection = {
  date: string;
  dayValue: string;
};

export function toLeaveCalendar(days: LeaveCalendarDay[] | undefined | null): LeaveCalendar {
  return new Map((days ?? []).map((day) => [day.date, day]));
}

export function isoDateRange(startDate: string, endDate: string): string[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export function addIsoDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole working days for other leave: off days and any holiday (incl. half-day) are skipped. */
export function leaveWorkingDates(startDate: string, endDate: string, calendar: LeaveCalendar) {
  return isoDateRange(startDate, endDate).filter((date) => calendar.get(date)?.status === 'WORKING');
}

export function parseAllowedDays(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

/** Last date that keeps the request within allowedDays, or null if it is beyond the loaded calendar. */
export function maxEndDateForAllowedDays(startDate: string, allowedDays: number, calendar: LeaveCalendar) {
  if (!startDate || allowedDays <= 0 || calendar.size === 0) return null;

  let found = 0;
  let current = startDate;
  while (calendar.has(current)) {
    if (calendar.get(current)?.status === 'WORKING') {
      found += 1;
      if (found >= allowedDays) return current;
    }
    current = addIsoDays(current, 1);
  }
  return null;
}

export function clampLeaveEndDate(
  startDate: string,
  endDate: string,
  allowedDays: number | null,
  calendar: LeaveCalendar,
) {
  let nextEnd = endDate;
  if (!startDate) return nextEnd;
  if (!nextEnd || nextEnd < startDate) nextEnd = startDate;
  if (allowedDays) {
    const maxEnd = maxEndDateForAllowedDays(startDate, allowedDays, calendar);
    if (maxEnd && nextEnd > maxEnd) nextEnd = maxEnd;
  }
  return nextEnd;
}

/**
 * Annual leave dates for "Add working days": scheduled working days only, with
 * weekends/off days and full-day holidays skipped and half-day holidays
 * limited to a half day. Skipped dates are returned so the UI can explain them.
 */
export function annualLeaveDatesInRange(startDate: string, endDate: string, calendar: LeaveCalendar) {
  const dates: AnnualDateSelection[] = [];
  const skipped = { offDays: [] as string[], holidays: [] as string[], noSchedule: [] as string[] };
  for (const date of isoDateRange(startDate, endDate)) {
    const day = calendar.get(date);
    if (!day || day.status === 'NO_SCHEDULE') skipped.noSchedule.push(date);
    else if (day.status === 'OFF_DAY') skipped.offDays.push(date);
    else if (day.status === 'HOLIDAY') skipped.holidays.push(date);
    else dates.push({ date, dayValue: day.status === 'HALF_DAY_HOLIDAY' ? '0.50' : '1.00' });
  }
  return { dates, skipped };
}

export function mergeAnnualDates(current: AnnualDateSelection[], additions: AnnualDateSelection[]) {
  const existing = new Set(current.map((item) => item.date));
  const added = additions.filter((item) => !existing.has(item.date));
  if (added.length === 0) return current;
  return [...current, ...added].sort((a, b) => a.date.localeCompare(b.date));
}
