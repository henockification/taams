/**
 * Ethiopian (Ge'ez) calendar conversions by Julian Day Number. Ethiopian months 1–12 have 30
 * days; month 13 (Pagume) has 5, or 6 when the Ethiopian year is divisible-by-4-minus-one
 * (year % 4 === 3).
 */
const ETHIOPIAN_EPOCH_JDN = 1_724_221; // Meskerem 1, year 1 (Amete Mihret)

function ethiopianToJdn(year: number, month: number, day: number) {
  return ETHIOPIAN_EPOCH_JDN + 365 * (year - 1) + Math.floor(year / 4) + 30 * (month - 1) + day - 1;
}

function jdnToGregorian(jdn: number) {
  // Fliegel–Van Flandern.
  const l = jdn + 68_569;
  const n = Math.floor((4 * l) / 146_097);
  const l2 = l - Math.floor((146_097 * n + 3) / 4);
  const i = Math.floor((4_000 * (l2 + 1)) / 1_461_001);
  const l3 = l2 - Math.floor((1_461 * i) / 4) + 31;
  const j = Math.floor((80 * l3) / 2_447);
  const day = l3 - Math.floor((2_447 * j) / 80);
  const l4 = Math.floor(j / 11);
  const month = j + 2 - 12 * l4;
  const year = 100 * (n - 49) + i + l4;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function pagumeDays(year: number) {
  return year % 4 === 3 ? 6 : 5;
}

/** Gregorian YYYY-MM-DD of an Ethiopian date. */
export function ethiopianToGregorian(year: number, month: number, day: number) {
  const maxDay = month === 13 ? pagumeDays(year) : 30;
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 13 || day < 1 || day > maxDay) {
    throw new Error('Invalid Ethiopian date');
  }
  return jdnToGregorian(ethiopianToJdn(year, month, day));
}
