const WEEKDAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

type HolidayRange = {
  isActive: boolean;
  startDate: string;
  endDate: string;
};

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

export function weekdayName(isoDate: string) {
  return WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
}

export function holidayIsoDates(holidays: HolidayRange[]): Set<string> {
  const dates = new Set<string>();
  for (const holiday of holidays) {
    if (!holiday.isActive) continue;
    for (const date of isoDateRange(holiday.startDate, holiday.endDate)) {
      dates.add(date);
    }
  }
  return dates;
}

export function isChargeableLeaveDay(
  isoDate: string,
  scheduledWorkingDays: Set<string>,
  holidayDates: Set<string>,
) {
  if (holidayDates.has(isoDate)) return false;
  return scheduledWorkingDays.has(weekdayName(isoDate));
}

export function leaveWorkingDates(
  startDate: string,
  endDate: string,
  scheduledWorkingDays: Set<string>,
  holidayDates: Set<string>,
) {
  return isoDateRange(startDate, endDate).filter((date) => (
    isChargeableLeaveDay(date, scheduledWorkingDays, holidayDates)
  ));
}

export function parseAllowedDays(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

export function maxEndDateForAllowedDays(
  startDate: string,
  allowedDays: number,
  scheduledWorkingDays: Set<string>,
  holidayDates: Set<string>,
) {
  if (!startDate || allowedDays <= 0 || scheduledWorkingDays.size === 0) return null;

  const current = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(current.getTime())) return null;

  let found = 0;
  const maxSteps = Math.max(400, Math.ceil(allowedDays * 3) + 60);
  for (let step = 0; step < maxSteps; step += 1) {
    const iso = current.toISOString().slice(0, 10);
    if (isChargeableLeaveDay(iso, scheduledWorkingDays, holidayDates)) {
      found += 1;
      if (found >= allowedDays) return iso;
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return null;
}

export function clampLeaveEndDate(
  startDate: string,
  endDate: string,
  allowedDays: number | null,
  scheduledWorkingDays: Set<string>,
  holidayDates: Set<string>,
) {
  let nextEnd = endDate;
  if (!startDate) return nextEnd;
  if (!nextEnd || nextEnd < startDate) nextEnd = startDate;
  if (allowedDays) {
    const maxEnd = maxEndDateForAllowedDays(startDate, allowedDays, scheduledWorkingDays, holidayDates);
    if (maxEnd && nextEnd > maxEnd) nextEnd = maxEnd;
  }
  return nextEnd;
}
