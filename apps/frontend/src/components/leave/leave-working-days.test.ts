import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampLeaveEndDate,
  holidayIsoDates,
  leaveWorkingDates,
  maxEndDateForAllowedDays,
  parseAllowedDays,
} from './leave-working-days';

const weekdays = new Set(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY']);

test('counts only scheduled working days and skips holidays', () => {
  const holidays = holidayIsoDates([
    { isActive: true, startDate: '2026-09-11', endDate: '2026-09-11' },
    { isActive: false, startDate: '2026-09-10', endDate: '2026-09-10' },
  ]);

  assert.deepEqual(
    leaveWorkingDates('2026-09-07', '2026-09-13', weekdays, holidays),
    ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10'],
  );
});

test('caps the end date at the last allowed working day', () => {
  const holidays = holidayIsoDates([
    { isActive: true, startDate: '2026-09-11', endDate: '2026-09-11' },
  ]);

  assert.equal(
    maxEndDateForAllowedDays('2026-09-07', 4, weekdays, holidays),
    '2026-09-10',
  );
  assert.equal(
    clampLeaveEndDate('2026-09-07', '2026-09-30', 4, weekdays, holidays),
    '2026-09-10',
  );
  assert.equal(
    clampLeaveEndDate('2026-09-10', '2026-09-07', 4, weekdays, holidays),
    '2026-09-10',
  );
});

test('treats blank allowed days as unlimited', () => {
  assert.equal(parseAllowedDays(null), null);
  assert.equal(parseAllowedDays('10'), 10);
  assert.equal(
    clampLeaveEndDate('2026-09-07', '2026-09-30', null, weekdays, new Set()),
    '2026-09-30',
  );
});
