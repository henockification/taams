import { isEmployeeBiometricExempt } from '../biometric-exemptions';
import { isIndefinitelyAbsent } from '../employees/absence';
import { rosterCycleIndex } from '../attendance/roster';
import { ethiopianToGregorian, pagumeDays } from '../ethiopian-calendar';

export type IfmisReadinessIssueCode =
  | 'MISSING_SCHEDULE'
  | 'INVALID_SCHEDULE'
  | 'MISSING_RECORD'
  /** Daily record still with the supervisor (PENDING_SUPERVISOR). */
  | 'AWAITING_SUPERVISOR'
  /** Daily record returned to the supervisor for correction. */
  | 'RETURNED'
  /** Supervisor approved; HR approval outstanding. */
  | 'AWAITING_HR'
  /** The pay month has not ended, so its remaining days cannot be approved yet. */
  | 'PERIOD_NOT_ENDED'
  | 'LEAVE_NOT_VERIFIED'
  | 'DUPLICATE_NAME';

/** One issue per employee and kind; `dates` lists every affected day (empty when not date-based). */
export type IfmisReadinessIssue = {
  code: IfmisReadinessIssueCode;
  employeeId: string;
  employeeName: string;
  employeeCode: string | null;
  employmentType: string | null;
  departmentName: string | null;
  /** First affected date. */
  date: string | null;
  dates: string[];
  message: string;
};

const STATUS_ISSUES: Record<string, { code: IfmisReadinessIssueCode; label: string }> = {
  PENDING_SUPERVISOR: { code: 'AWAITING_SUPERVISOR', label: 'awaiting supervisor approval' },
  RETURNED: { code: 'RETURNED', label: 'returned for correction' },
  SUPERVISOR_APPROVED: { code: 'AWAITING_HR', label: 'awaiting HR approval' },
};

export type IfmisAttendanceRow = {
  employeeId: string;
  ifmisNo: number | null;
  nationalId: string | null;
  orgId: string | null;
  firstName: string;
  fatherName: string | null;
  grandName: string;
  firstNameAmharic: string | null;
  fatherNameAmharic: string | null;
  grandNameAmharic: string | null;
  absenteeism: number;
  late: number;
  currentStatus: string;
  approved: 'YES';
  payMonth: number;
  payYear: number;
};

/** A row as previewed: the IFMIS row plus how its absenteeism was reached. */
export type IfmisAttendancePreviewRow = IfmisAttendanceRow & {
  /** For finding and filtering rows on the page; not sent to IFMIS. */
  employeeCode: string | null;
  employmentType: string | null;
  departmentId: string | null;
  departmentName: string | null;
  /** Biometric exempt on at least one day of the month (absences come from leave, not records). */
  isBiometricExempt: boolean;
  /** Absenteeism before finance's adjustment. */
  calculatedAbsenteeism: number;
  absenteeismAdjusted: boolean;
  adjustmentNote: string | null;
};

export type IfmisAbsenceAdjustment = { absentDays: number; note: string | null };

export type IfmisAttendanceSource = {
  employees: any[];
  attendanceRecords: any[];
  scheduleAssignments: any[];
  biometricExemptions?: any[];
  /** Unpaid leave day value per `${employeeId}:${date}`. */
  unpaidLeaveDays?: Map<string, number>;
  /** Finance's absent-days override per employee for this pay month. */
  absenceAdjustments?: Map<string, IfmisAbsenceAdjustment>;
  /** Addis Ababa date the preview is built on; later days of the month are not checked yet. */
  today?: string;
};

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/**
 * Gregorian date range of an Ethiopian payroll month (payMonth 1–12, payYear in the Ethiopian
 * calendar). Pagume belongs to Nehase's payroll, so month 12 runs to the end of Pagume.
 * E.g. Tikimt (2) 2019 is 2026-10-11 to 2026-11-09.
 */
export function getPayPeriodRange(payMonth: number, payYear: number) {
  validatePeriod(payMonth, payYear);
  const start = ethiopianToGregorian(payYear, payMonth, 1);
  const end = payMonth === 12
    ? ethiopianToGregorian(payYear, 13, pagumeDays(payYear))
    : ethiopianToGregorian(payYear, payMonth, 30);
  return { start, end };
}

export function buildIfmisAttendancePreview(
  source: IfmisAttendanceSource,
  payMonth: number,
  payYear: number,
) {
  const { start, end } = getPayPeriodRange(payMonth, payYear);
  const recordsByEmployeeDate = new Map(
    source.attendanceRecords.map((record) => [`${record.employeeId}:${String(record.attendanceDate)}`, record]),
  );
  const schedulesByEmployee = groupBy(source.scheduleAssignments, (assignment) => assignment.employeeId);
  const issues = new IssueCollector();
  const rows: IfmisAttendancePreviewRow[] = [];
  // Days after today cannot have approved records yet; the month is blocked once instead.
  const lastCheckedDate = source.today && source.today < end ? previousDate(source.today) : end;
  if (lastCheckedDate < end) {
    issues.add('PERIOD_NOT_ENDED', null, null, `This payroll month runs until ${end}; export it after the month has ended`);
  }

  for (const employee of source.employees) {
    // Employees not paid through IFMIS are never exported (nor checked for readiness).
    if (employee.paidByIfmis === false) continue;
    const employeeName = englishName(employee);
    const assignments = schedulesByEmployee.get(employee.id) ?? [];
    const applicableDates: Array<{ date: string; window: ScheduleWindow }> = [];
    let absenteeism = 0;
    let late = 0;
    let isBiometricExempt = false;

    // Employees flagged as away indefinitely are not sent to IFMIS until the flag is cleared.
    if (isIndefinitelyAbsent(employee)) continue;

    const hireDate = employee.hireDate ? String(employee.hireDate).slice(0, 10) : null;
    for (const date of datesInclusive(start, lastCheckedDate)) {
      // No attendance is expected before the employee was hired.
      if (hireDate && date < hireDate) continue;
      // Biometric-exempt days have no daily record: the employee counts as present, except
      // for approved unpaid leave. Finance can override the month's total.
      if (isEmployeeBiometricExempt(employee, source.biometricExemptions ?? [], date)) {
        isBiometricExempt = true;
        absenteeism += source.unpaidLeaveDays?.get(`${employee.id}:${date}`) ?? 0;
        continue;
      }
      const resolution = resolveScheduleWindow(date, assignments);
      if (resolution.kind === 'missing-assignment') {
        issues.add('MISSING_SCHEDULE', employee, date, 'No work schedule assigned');
        continue;
      }
      if (resolution.kind === 'off-day') continue;
      if (resolution.kind === 'invalid') {
        issues.add('INVALID_SCHEDULE', employee, date, 'The scheduled shift has no valid active sessions');
        continue;
      }
      applicableDates.push({ date, window: resolution.window });
    }

    for (const { date, window } of applicableDates) {
      const record = recordsByEmployeeDate.get(`${employee.id}:${date}`);
      if (!record) {
        issues.add('MISSING_RECORD', employee, date, 'No daily attendance record');
        continue;
      }
      if (record.status !== 'HR_APPROVED') {
        const statusIssue = STATUS_ISSUES[record.status] ?? { code: 'AWAITING_SUPERVISOR' as const, label: `is ${record.status}` };
        issues.add(statusIssue.code, employee, date, `Attendance ${statusIssue.label}`);
        continue;
      }

      absenteeism += numberValue(record.absenceDays);
      if (record.checkInAt) {
        const lateMinutes = Math.max(0, Math.floor((new Date(record.checkInAt).getTime() - window.lateThreshold.getTime()) / 60_000));
        late += lateMinutes / window.scheduledMinutes;
      }
    }

    // Adjustments apply only to exempt employees; a stale one is ignored once the exemption ends.
    const adjustment = isBiometricExempt ? source.absenceAdjustments?.get(employee.id) : undefined;
    rows.push({
      employeeId: employee.id,
      ifmisNo: null,
      nationalId: nullableText(employee.nationalId),
      orgId: null,
      firstName: employee.firstNameEn,
      fatherName: nullableText(employee.middleNameEn),
      grandName: employee.lastNameEn,
      firstNameAmharic: nullableText(employee.firstNameAm),
      fatherNameAmharic: nullableText(employee.middleNameAm),
      grandNameAmharic: nullableText(employee.lastNameAm),
      employeeCode: nullableText(employee.employeeCode),
      employmentType: nullableText(employee.employmentType),
      departmentId: nullableText(employee.departmentId),
      departmentName: departmentName(employee),
      absenteeism: roundTwo(adjustment ? adjustment.absentDays : absenteeism),
      late: roundTwo(late),
      currentStatus: employee.employmentStatus,
      approved: 'YES',
      payMonth,
      payYear,
      isBiometricExempt,
      calculatedAbsenteeism: roundTwo(absenteeism),
      absenteeismAdjusted: Boolean(adjustment),
      adjustmentNote: adjustment?.note ?? null,
    });
  }

  const duplicateGroups = groupBy(rows, namePeriodKey);
  for (const duplicates of duplicateGroups.values()) {
    if (duplicates.length < 2) continue;
    for (const row of duplicates) {
      const employee = source.employees.find((candidate) => candidate.id === row.employeeId);
      issues.add('DUPLICATE_NAME', employee, null, 'Another employee has the same English name in this payroll period');
    }
  }

  const issueList = issues.list();
  return { rows, issues: issueList, ready: rows.length > 0 && issueList.length === 0 };
}

/** Collects issues as one entry per employee and kind, with the affected dates. */
class IssueCollector {
  private readonly issues = new Map<string, IfmisReadinessIssue>();

  add(code: IfmisReadinessIssueCode, employee: any, date: string | null, message: string) {
    const key = `${code}:${employee?.id ?? ''}`;
    const existing = this.issues.get(key);
    if (existing) {
      if (date) existing.dates.push(date);
      return;
    }
    this.issues.set(key, {
      code,
      employeeId: employee?.id ?? '',
      employeeName: englishName(employee),
      employeeCode: nullableText(employee?.employeeCode),
      employmentType: nullableText(employee?.employmentType),
      departmentName: departmentName(employee),
      date,
      dates: date ? [date] : [],
      message,
    });
  }

  list() {
    return [...this.issues.values()];
  }
}

type ScheduleWindow = { lateThreshold: Date; scheduledMinutes: number };
type ScheduleResolution =
  | { kind: 'missing-assignment' }
  | { kind: 'off-day' }
  | { kind: 'invalid' }
  | { kind: 'working'; window: ScheduleWindow };

function resolveScheduleWindow(date: string, assignments: any[]): ScheduleResolution {
  const assignment = [...assignments]
    .sort((left, right) => String(right.effectiveFrom).localeCompare(String(left.effectiveFrom)))
    .find((item) => item.effectiveFrom <= date && (!item.effectiveTo || item.effectiveTo >= date));
  if (!assignment) return { kind: 'missing-assignment' };

  // Same rules as daily record generation: a roster works its duty days counted from the
  // assignment's start (e.g. 1 on / 2 off), a weekly schedule the weekdays it lists.
  const schedule = assignment.workSchedule;
  const isRoster = schedule?.scheduleType === 'ROSTER';
  if (isRoster) {
    const onDays = Number(schedule.rosterOnDays ?? 1);
    const offDays = Number(schedule.rosterOffDays ?? 0);
    if (rosterCycleIndex(date, String(assignment.effectiveFrom).slice(0, 10), onDays, offDays) >= onDays) return { kind: 'off-day' };
  }
  const dayName = DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];
  const day = schedule?.days?.find((candidate: any) => candidate.isActive
    && (isRoster || String(candidate.dayOfWeek).toUpperCase() === dayName || String(candidate.dayOfWeek).toUpperCase() === 'ROSTER'));
  if (!day || day.isOffDay) return { kind: 'off-day' };
  const shift = day.shift;
  const segments = [...(shift?.segments ?? [])]
    .filter((segment: any) => segment.isActive)
    .sort((left: any, right: any) => Number(left.sortOrder ?? 0) - Number(right.sortOrder ?? 0));
  if (!shift || segments.length === 0) return { kind: 'invalid' };

  const scheduledMinutes = segments.reduce((total: number, segment: any) => total + segmentMinutes(segment.startTime, segment.endTime), 0);
  if (!Number.isFinite(scheduledMinutes) || scheduledMinutes <= 0) return { kind: 'invalid' };

  const scheduledStart = new Date(`${date}T${segments[0].startTime}`);
  if (!Number.isFinite(scheduledStart.getTime())) return { kind: 'invalid' };
  const lateThreshold = new Date(scheduledStart);
  lateThreshold.setMinutes(lateThreshold.getMinutes() + Number(shift.gracePeriodMinutes ?? 0) + Number(shift.lateAfterMinutes ?? 0));
  return { kind: 'working', window: { lateThreshold, scheduledMinutes } };
}

function segmentMinutes(startTime: string, endTime: string) {
  const start = clockMinutes(startTime);
  let end = clockMinutes(endTime);
  if (end <= start) end += 24 * 60;
  return end - start;
}

function clockMinutes(value: string) {
  const [hours, minutes] = String(value).split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return Number.NaN;
  return hours * 60 + minutes;
}

function datesInclusive(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function validatePeriod(payMonth: number, payYear: number) {
  if (!Number.isInteger(payMonth) || payMonth < 1 || payMonth > 12) throw new Error('Invalid pay month');
  if (!Number.isInteger(payYear) || payYear < 2000 || payYear > 2200) throw new Error('Invalid pay year');
}

function departmentName(employee: any) {
  return nullableText(employee?.department?.nameEn ?? employee?.sourceDepartmentName);
}

function previousDate(date: string) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function englishName(employee: any) {
  return [employee?.firstNameEn, employee?.middleNameEn, employee?.lastNameEn].filter(Boolean).join(' ');
}

function namePeriodKey(row: IfmisAttendanceRow) {
  return [row.firstName, row.fatherName ?? '', row.grandName, row.payMonth, row.payYear]
    .map((value) => String(value).trim().toLocaleUpperCase())
    .join('|');
}

function groupBy<T>(values: T[], key: (value: T) => string) {
  const grouped = new Map<string, T[]>();
  for (const value of values) grouped.set(key(value), [...(grouped.get(key(value)) ?? []), value]);
  return grouped;
}

function nullableText(value: unknown) {
  const text = String(value ?? '').trim();
  return text || null;
}

function numberValue(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function roundTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
