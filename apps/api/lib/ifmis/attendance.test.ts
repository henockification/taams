import assert from 'node:assert/strict';
import test from 'node:test';
import { buildIfmisAttendancePreview, getGregorianMonthRange } from './attendance';

test('Gregorian month range includes leap day', () => {
  assert.deepEqual(getGregorianMonthRange(2, 2028), { start: '2028-02-01', end: '2028-02-29' });
});

test('builds a ready bilingual row and calculates schedule-relative late days', () => {
  const employee = makeEmployee('employee-1');
  const records = weekdayDates(8, 2026).map((date) => ({
    employeeId: employee.id,
    attendanceDate: date,
    status: 'HR_APPROVED',
    absenceDays: date === '2026-08-04' ? '0.50' : '0.00',
    checkInAt: date === '2026-08-03' ? `${date}T09:03:00` : `${date}T08:15:00`,
  }));
  const preview = buildIfmisAttendancePreview({
    employees: [employee],
    attendanceRecords: records,
    scheduleAssignments: [makeSchedule(employee.id)],
  }, 8, 2026);

  assert.equal(preview.ready, true);
  assert.equal(preview.issues.length, 0);
  assert.equal(preview.rows[0].absenteeism, 0.5);
  assert.equal(preview.rows[0].late, 0.1);
  assert.equal(preview.rows[0].firstNameAmharic, 'ሀና');
  assert.equal(preview.rows[0].nationalId, '0045678901');
  assert.equal(preview.rows[0].ifmisNo, null);
  assert.equal(preview.rows[0].approved, 'YES');
});

test('blocks missing and non-HR-approved scheduled records', () => {
  const employee = makeEmployee('employee-1');
  const dates = weekdayDates(8, 2026);
  const records = dates.slice(1).map((date, index) => ({
    employeeId: employee.id,
    attendanceDate: date,
    status: index === 0 ? 'SUPERVISOR_APPROVED' : 'HR_APPROVED',
    absenceDays: '0.00',
    checkInAt: `${date}T08:00:00`,
  }));
  const preview = buildIfmisAttendancePreview({
    employees: [employee], attendanceRecords: records, scheduleAssignments: [makeSchedule(employee.id)],
  }, 8, 2026);
  assert.equal(preview.ready, false);
  assert.equal(preview.issues.filter((issue) => issue.code === 'MISSING_RECORD').length, 1);
  assert.equal(preview.issues.filter((issue) => issue.code === 'NOT_HR_APPROVED').length, 1);
});

test('blocks missing schedules and duplicate temporary name identities', () => {
  const first = makeEmployee('employee-1');
  const second = makeEmployee('employee-2');
  const preview = buildIfmisAttendancePreview({
    employees: [first, second], attendanceRecords: [], scheduleAssignments: [],
  }, 8, 2026);
  assert.equal(preview.ready, false);
  assert.ok(preview.issues.some((issue) => issue.code === 'MISSING_SCHEDULE'));
  assert.equal(preview.issues.filter((issue) => issue.code === 'DUPLICATE_NAME').length, 2);
});

function makeEmployee(id: string) {
  return {
    id,
    firstNameEn: 'Hana', middleNameEn: 'Bekele', lastNameEn: 'Abebe',
    firstNameAm: 'ሀና', middleNameAm: 'በቀለ', lastNameAm: 'አበበ',
    employmentStatus: 'ACTIVE',
    nationalId: '0045678901',
  };
}

function makeSchedule(employeeId: string) {
  return {
    employeeId, effectiveFrom: '2026-01-01', effectiveTo: null,
    workSchedule: {
      days: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'].map((dayOfWeek) => ({
        dayOfWeek, isActive: true, isOffDay: false,
        shift: {
          gracePeriodMinutes: 15, lateAfterMinutes: 0,
          segments: [
            { startTime: '08:00:00', endTime: '12:00:00', sortOrder: 1, isActive: true },
            { startTime: '13:00:00', endTime: '17:00:00', sortOrder: 2, isActive: true },
          ],
        },
      })),
    },
  };
}

function weekdayDates(month: number, year: number) {
  const { start, end } = getGregorianMonthRange(month, year);
  const result: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) result.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return result;
}
