export type IfmisReadinessIssueCode =
  | 'MISSING_SCHEDULE'
  | 'INVALID_SCHEDULE'
  | 'MISSING_RECORD'
  | 'NOT_HR_APPROVED'
  | 'DUPLICATE_NAME';

export type IfmisReadinessIssue = {
  code: IfmisReadinessIssueCode;
  employeeId: string;
  employeeName: string;
  date: string | null;
  message: string;
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

export type IfmisAttendanceSource = {
  employees: any[];
  attendanceRecords: any[];
  scheduleAssignments: any[];
};

const DAY_NAMES = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

export function getGregorianMonthRange(payMonth: number, payYear: number) {
  validatePeriod(payMonth, payYear);
  const start = `${payYear}-${String(payMonth).padStart(2, '0')}-01`;
  const endDate = new Date(Date.UTC(payYear, payMonth, 0));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

export function buildIfmisAttendancePreview(
  source: IfmisAttendanceSource,
  payMonth: number,
  payYear: number,
) {
  const { start, end } = getGregorianMonthRange(payMonth, payYear);
  const recordsByEmployeeDate = new Map(
    source.attendanceRecords.map((record) => [`${record.employeeId}:${String(record.attendanceDate)}`, record]),
  );
  const schedulesByEmployee = groupBy(source.scheduleAssignments, (assignment) => assignment.employeeId);
  const issues: IfmisReadinessIssue[] = [];
  const rows: IfmisAttendanceRow[] = [];

  for (const employee of source.employees) {
    const employeeName = englishName(employee);
    const assignments = schedulesByEmployee.get(employee.id) ?? [];
    const applicableDates: Array<{ date: string; window: ScheduleWindow }> = [];
    let absenteeism = 0;
    let late = 0;

    for (const date of datesInclusive(start, end)) {
      const resolution = resolveScheduleWindow(date, assignments);
      if (resolution.kind === 'missing-assignment') {
        issues.push(issue('MISSING_SCHEDULE', employee, date, `No effective work schedule for ${date}`));
        continue;
      }
      if (resolution.kind === 'off-day') continue;
      if (resolution.kind === 'invalid') {
        issues.push(issue('INVALID_SCHEDULE', employee, date, `The scheduled shift for ${date} has no valid active segments`));
        continue;
      }
      applicableDates.push({ date, window: resolution.window });
    }

    for (const { date, window } of applicableDates) {
      const record = recordsByEmployeeDate.get(`${employee.id}:${date}`);
      if (!record) {
        issues.push(issue('MISSING_RECORD', employee, date, `Attendance record is missing for ${date}`));
        continue;
      }
      if (record.status !== 'HR_APPROVED') {
        issues.push(issue('NOT_HR_APPROVED', employee, date, `Attendance record for ${date} is ${record.status}`));
        continue;
      }

      absenteeism += numberValue(record.absenceDays);
      if (record.checkInAt) {
        const lateMinutes = Math.max(0, Math.floor((new Date(record.checkInAt).getTime() - window.lateThreshold.getTime()) / 60_000));
        late += lateMinutes / window.scheduledMinutes;
      }
    }

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
      absenteeism: roundTwo(absenteeism),
      late: roundTwo(late),
      currentStatus: employee.employmentStatus,
      approved: 'YES',
      payMonth,
      payYear,
    });
  }

  const duplicateGroups = groupBy(rows, namePeriodKey);
  for (const duplicates of duplicateGroups.values()) {
    if (duplicates.length < 2) continue;
    for (const row of duplicates) {
      const employee = source.employees.find((candidate) => candidate.id === row.employeeId);
      issues.push(issue('DUPLICATE_NAME', employee, null, 'Another employee has the same English name in this payroll period'));
    }
  }

  return { rows, issues, ready: rows.length > 0 && issues.length === 0 };
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

  const dayName = DAY_NAMES[new Date(`${date}T00:00:00`).getDay()];
  const day = assignment.workSchedule?.days?.find((candidate: any) => candidate.dayOfWeek === dayName && candidate.isActive);
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

function issue(code: IfmisReadinessIssueCode, employee: any, date: string | null, message: string): IfmisReadinessIssue {
  return { code, employeeId: employee?.id ?? '', employeeName: englishName(employee), date, message };
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
