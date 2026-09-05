import {
  CalendarDate,
  EthiopicCalendar,
  GregorianCalendar,
  parseDate,
  toCalendar,
} from '@internationalized/date';

export type CalendarSystem = 'gregory' | 'ethiopic';

export const CALENDAR_STORAGE_KEY = 'taams-calendar-system';

const ethiopicCalendar = new EthiopicCalendar();
const gregorianCalendar = new GregorianCalendar();
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const dateTimeFormatterCache = new Map<string, Intl.DateTimeFormat>();

export function isCalendarSystem(value: unknown): value is CalendarSystem {
  return value === 'gregory' || value === 'ethiopic';
}

export function gregorianToEthiopian(value: string): CalendarDate | null {
  try {
    if (!DATE_ONLY_PATTERN.test(value)) return null;
    // Intl handles the exact Pagume/New Year boundary correctly. Some versions of
    // @internationalized/date constrain the library conversion's transient Pagume
    // day 6 before rolling it into Meskerem 1, producing a duplicate date.
    const [year, month, day] = value.split('-').map(Number);
    parseDate(value); // Strictly validate the Gregorian input first.
    const parts = new Intl.DateTimeFormat('en-ET-u-ca-ethiopic-nu-latn', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      timeZone: 'UTC',
    }).formatToParts(new Date(Date.UTC(year, month - 1, day, 12)));
    const numericPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
    const ethiopianYear = numericPart('year');
    const ethiopianMonth = numericPart('month');
    const ethiopianDay = numericPart('day');
    if (![ethiopianYear, ethiopianMonth, ethiopianDay].every(Number.isInteger)) return null;
    return new CalendarDate(ethiopicCalendar, ethiopianYear, ethiopianMonth, ethiopianDay);
  } catch {
    return null;
  }
}

export function ethiopianToGregorian(year: number, month: number, day: number): string | null {
  try {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (month < 1 || month > 13 || day < 1) return null;

    const value = new CalendarDate(ethiopicCalendar, year, month, day);
    if (value.year !== year || value.month !== month || value.day !== day) return null;
    if (day > ethiopicCalendar.getDaysInMonth(value)) return null;

    return toCalendar(value, gregorianCalendar).toString();
  } catch {
    return null;
  }
}

export function parseEthiopianDate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return ethiopianToGregorian(year, month, day) ? { year, month, day } : null;
}

export function formatEthiopianInput(value: string): string {
  const converted = gregorianToEthiopian(value);
  if (!converted) return '';
  return `${String(converted.year).padStart(4, '0')}-${String(converted.month).padStart(2, '0')}-${String(converted.day).padStart(2, '0')}`;
}

export function calendarLocale(locale: string, calendar: CalendarSystem): string {
  const language = locale.toLowerCase().startsWith('am') ? 'am' : 'en';
  return `${language}-ET-u-ca-${calendar}-nu-latn`;
}

function dateForFormatting(value: Date | string | null | undefined): { date: Date; dateOnly: boolean } | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : { date: value, dateOnly: false };

  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return { date: new Date(Date.UTC(year, month - 1, day, 12)), dateOnly: true };
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : { date, dateOnly: false };
}

function formatWithoutUnwantedEra(formatter: Intl.DateTimeFormat, date: Date): string {
  const parts = formatter.formatToParts(date);
  return parts
    .filter((part) => part.type !== 'era')
    .map((part) => part.value)
    .join('')
    .trim();
}

function getCachedFormatter(
  locale: string,
  calendar: CalendarSystem,
  kind: 'date' | 'date-time',
  dateOnly: boolean,
  options: Intl.DateTimeFormatOptions,
) {
  const key = JSON.stringify([locale, calendar, kind, dateOnly, options]);
  const cached = dateTimeFormatterCache.get(key);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat(calendarLocale(locale, calendar), kind === 'date'
    ? {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(dateOnly ? { timeZone: 'UTC' } : {}),
        ...options,
      }
    : {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        ...options,
      });
  dateTimeFormatterCache.set(key, formatter);
  return formatter;
}

export function formatCalendarDate(
  value: Date | string | null | undefined,
  locale: string,
  calendar: CalendarSystem,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const parsed = dateForFormatting(value);
  if (!parsed) return '-';
  const formatter = getCachedFormatter(locale, calendar, 'date', parsed.dateOnly, options);
  return formatWithoutUnwantedEra(formatter, parsed.date);
}

export function formatCalendarDateTime(
  value: Date | string | null | undefined,
  locale: string,
  calendar: CalendarSystem,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const parsed = dateForFormatting(value);
  if (!parsed) return '-';
  const formatter = getCachedFormatter(locale, calendar, 'date-time', parsed.dateOnly, options);
  return formatWithoutUnwantedEra(formatter, parsed.date);
}

export function getEthiopicCalendar() {
  return ethiopicCalendar;
}
