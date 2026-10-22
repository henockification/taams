import { useCallback } from 'react';
import { useLocale } from 'next-intl';

export type NamedEmployee = {
  firstNameEn?: string | null;
  middleNameEn?: string | null;
  lastNameEn?: string | null;
  firstNameAm?: string | null;
  middleNameAm?: string | null;
  lastNameAm?: string | null;
  /** Amharic full name from the ISMIS import, used until the Amharic name fields are filled. */
  sourceFullNameAm?: string | null;
} | null | undefined;

/** Full name in the given locale; Amharic falls back to English when no Amharic name is on file. */
export function formatEmployeeName(employee: NamedEmployee, locale: string) {
  if (!employee) return '';
  const english = [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
  if (locale !== 'am') return english;
  const amharic = [employee.firstNameAm, employee.middleNameAm, employee.lastNameAm].filter(Boolean).join(' ');
  return amharic || employee.sourceFullNameAm?.trim() || english;
}

/** A name the API already formatted in both languages (e.g. a department head). */
export function localizedFullName(person: { fullName: string; fullNameAm?: string | null }, locale: string) {
  return locale === 'am' && person.fullNameAm ? person.fullNameAm : person.fullName;
}

/** `formatEmployeeName` bound to the current UI language. */
export function useEmployeeName() {
  const locale = useLocale();
  return useCallback((employee: NamedEmployee) => formatEmployeeName(employee, locale), [locale]);
}
