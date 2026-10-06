'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

import {
  annualLeaveDatesInRange,
  toLeaveCalendar,
  type AnnualDateSelection,
} from '@/components/leave/leave-working-days';
import { useFetchLeaveWorkingCalendar } from '@/data/hooks/core.hooks';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

/**
 * Adds annual leave dates after checking them against the employee's server-side
 * leave calendar, so weekends, schedule off days, and holidays are skipped and the
 * user is told why.
 */
export function useAnnualLeaveDateAdder(
  employeeId: string | null | undefined,
  selectedDates: AnnualDateSelection[],
  onAdd: (dates: AnnualDateSelection[]) => void,
) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const fetchCalendar = useFetchLeaveWorkingCalendar();
  const [isChecking, setIsChecking] = useState(false);

  const loadCalendar = async (startDate: string, endDate: string) => {
    if (!employeeId || !startDate || !endDate) return null;
    if (startDate > endDate) {
      notifications.show({ title: common('error'), message: t('annualLeaveInvalidRange'), color: 'red' });
      return null;
    }
    setIsChecking(true);
    try {
      const response = await fetchCalendar(employeeId, startDate, endDate);
      return toLeaveCalendar(response.days);
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
      return null;
    } finally {
      setIsChecking(false);
    }
  };

  const addRange = async (startDate: string, endDate: string) => {
    const calendar = await loadCalendar(startDate, endDate);
    if (!calendar) return;

    const { dates, skipped } = annualLeaveDatesInRange(startDate, endDate, calendar);
    if (skipped.noSchedule.length > 0) {
      notifications.show({ title: common('error'), message: t('annualLeaveNoScheduleForDates', { count: skipped.noSchedule.length }), color: 'red' });
    }
    if (dates.length === 0) {
      if (skipped.noSchedule.length === 0) {
        notifications.show({ title: common('error'), message: t('annualLeaveNoWorkingDaysInRange'), color: 'red' });
      }
      return;
    }

    const alreadySelected = new Set(selectedDates.map((item) => item.date));
    const newDates = dates.filter((item) => !alreadySelected.has(item.date));
    onAdd(newDates);
    const skippedMessage = skipped.offDays.length || skipped.holidays.length
      ? ` ${t('annualLeaveDatesSkipped', { offDays: skipped.offDays.length, holidays: skipped.holidays.length })}`
      : '';
    notifications.show({
      title: common('success'),
      message: newDates.length > 0
        ? `${t('annualLeaveDatesAdded', { count: newDates.length })}${skippedMessage}`
        : t('annualLeaveDatesAlreadyAdded'),
      color: 'green',
    });
  };

  const addDate = async (date: string) => {
    const calendar = await loadCalendar(date, date);
    const day = calendar?.get(date);
    if (!day) return;

    const label = formatDate(date);
    if (day.status === 'NO_SCHEDULE') {
      notifications.show({ title: common('error'), message: t('annualLeaveNoScheduleForDates', { count: 1 }), color: 'red' });
    } else if (day.status === 'OFF_DAY') {
      notifications.show({ title: common('error'), message: t('annualLeaveDateIsOffDay', { date: label }), color: 'red' });
    } else if (day.status === 'HOLIDAY') {
      notifications.show({ title: common('error'), message: t('annualLeaveDateIsHoliday', { date: label, name: day.holidayName ?? '' }), color: 'red' });
    } else if (day.status === 'HALF_DAY_HOLIDAY') {
      onAdd([{ date, dayValue: '0.50' }]);
      notifications.show({ title: common('success'), message: t('annualLeaveDateHalfHoliday', { date: label, name: day.holidayName ?? '' }), color: 'yellow' });
    } else {
      onAdd([{ date, dayValue: '1.00' }]);
    }
  };

  return { addRange, addDate, isChecking };
}
