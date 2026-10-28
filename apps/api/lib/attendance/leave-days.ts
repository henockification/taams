/**
 * Leave day value written to an attendance daily record (0–1).
 *
 * - `dateLeaveDays` is leave already valued for this exact date: annual leave, approved date
 *   by date as a full (1.00) or half (0.50) day, and confirmed ISMIS leave days (1.00).
 * - Every other leave type is taken in whole working days, so it covers the whole duty
 *   part of each day in its range: 1.00 on a working day, 0.50 on a half-day holiday
 *   (the holiday covers the other half) and 0 on a rest day or full-day holiday.
 */
export function resolveDayLeaveValue(input: {
  dateLeaveDays: number;
  wholeDayLeave: boolean;
  isNoDutyDay: boolean;
  holidayDays: number;
}) {
  const dutyDays = input.isNoDutyDay ? 0 : Math.max(0, 1 - input.holidayDays);
  return Math.min(1, input.dateLeaveDays + (input.wholeDayLeave ? dutyDays : 0));
}
