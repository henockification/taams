import { AsyncLocalStorage } from 'async_hooks';

export type NameLocale = 'en' | 'am';

type NamedEmployee = {
  firstNameEn?: string | null;
  middleNameEn?: string | null;
  lastNameEn?: string | null;
  firstNameAm?: string | null;
  middleNameAm?: string | null;
  lastNameAm?: string | null;
} | null | undefined;

const nameLocaleStorage = new AsyncLocalStorage<NameLocale>();

export function parseNameLocale(value: string | null | undefined): NameLocale {
  return value === 'am' ? 'am' : 'en';
}

/** Runs `fn` with employee names shown in `locale` (see `employeeDisplayName`). */
export function withNameLocale<T>(locale: NameLocale, fn: () => T): T {
  return nameLocaleStorage.run(locale, fn);
}

/**
 * Full name in the requested language, falling back to English when the employee has no
 * Amharic name on file. Defaults to the locale set by `withNameLocale`, else English.
 */
export function employeeDisplayName(employee: NamedEmployee, locale: NameLocale = nameLocaleStorage.getStore() ?? 'en') {
  if (!employee) return '';
  const english = [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
  if (locale !== 'am') return english;
  const amharic = [employee.firstNameAm, employee.middleNameAm, employee.lastNameAm].filter(Boolean).join(' ');
  return amharic || english;
}
