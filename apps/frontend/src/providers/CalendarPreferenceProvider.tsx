'use client';

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';

import {
  CALENDAR_STORAGE_KEY,
  type CalendarSystem,
  formatCalendarDate,
  formatCalendarDateTime,
  isCalendarSystem,
} from '@/lib/calendar';

type CalendarPreferenceContextValue = {
  calendar: CalendarSystem;
  setCalendar: (calendar: CalendarSystem) => void;
  formatDate: (value: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
  formatDateTime: (value: Date | string | null | undefined, options?: Intl.DateTimeFormatOptions) => string;
};

const CalendarPreferenceContext = createContext<CalendarPreferenceContextValue | null>(null);

export function CalendarPreferenceProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const [calendar, setCalendarState] = useState<CalendarSystem>('gregory');

  useEffect(() => {
    const stored = window.localStorage.getItem(CALENDAR_STORAGE_KEY);
    if (isCalendarSystem(stored)) setCalendarState(stored);
  }, []);

  const setCalendar = useCallback((next: CalendarSystem) => {
    setCalendarState(next);
    window.localStorage.setItem(CALENDAR_STORAGE_KEY, next);
  }, []);

  const value = useMemo<CalendarPreferenceContextValue>(() => ({
    calendar,
    setCalendar,
    formatDate: (date, options) => formatCalendarDate(date, locale, calendar, options),
    formatDateTime: (date, options) => formatCalendarDateTime(date, locale, calendar, options),
  }), [calendar, locale, setCalendar]);

  return <CalendarPreferenceContext.Provider value={value}>{children}</CalendarPreferenceContext.Provider>;
}

export function useCalendarPreference() {
  const context = useContext(CalendarPreferenceContext);
  if (!context) throw new Error('useCalendarPreference must be used within CalendarPreferenceProvider');
  return context;
}

