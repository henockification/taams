import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ethiopianToGregorian,
  formatCalendarDate,
  formatEthiopianInput,
  gregorianToEthiopian,
  isCalendarSystem,
  parseEthiopianDate,
} from './calendar';

test('converts Ethiopian New Year without duplicating the last Pagume day', () => {
  const pagume = gregorianToEthiopian('2026-09-10');
  const newYear = gregorianToEthiopian('2026-09-11');

  assert.deepEqual(pagume && [pagume.year, pagume.month, pagume.day], [2018, 13, 5]);
  assert.deepEqual(newYear && [newYear.year, newYear.month, newYear.day], [2019, 1, 1]);
});

test('supports Pagume leap day and rejects it in a non-leap year', () => {
  assert.equal(ethiopianToGregorian(2015, 13, 6), '2023-09-11');
  assert.equal(ethiopianToGregorian(2018, 13, 6), null);
  assert.equal(parseEthiopianDate('2018-13-06'), null);
});

test('round trips Gregorian dates across months and years', () => {
  for (const gregorian of ['2023-09-11', '2023-09-12', '2024-02-29', '2026-09-10', '2026-09-11', '2030-01-01']) {
    const ethiopian = gregorianToEthiopian(gregorian);
    assert.ok(ethiopian, gregorian);
    assert.equal(ethiopianToGregorian(ethiopian.year, ethiopian.month, ethiopian.day), gregorian);
    assert.match(formatEthiopianInput(gregorian), /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('formats date-only values using the selected calendar without a timezone shift', () => {
  assert.match(formatCalendarDate('2026-09-11', 'en', 'ethiopic', { month: 'long' }), /Meskerem|2019/);
  assert.match(formatCalendarDate('2026-09-11', 'am', 'ethiopic', { month: 'long' }), /መስከረም|2019/);
});

test('validates persisted calendar values', () => {
  assert.equal(isCalendarSystem('gregory'), true);
  assert.equal(isCalendarSystem('ethiopic'), true);
  assert.equal(isCalendarSystem('julian'), false);
  assert.equal(isCalendarSystem(null), false);
});

