'use client';

import { useCallback, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { addisTodayInput } from '@/components/dashboard/dashboard-shared';
import { useTemporaryAssignmentSpans } from '@/data/hooks/core.hooks';
import type { TemporaryAssignmentSpan } from '@/data/types/core.types';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';
import { cn } from '@/lib/utils';

type DepartmentName = { nameEn: string; nameAm: string | null } | null | undefined;

/**
 * Looks up whether an employee was temporarily assigned to another department on a date
 * (YYYY-MM-DD, default today in Addis Ababa). The latest assignment covering the day wins,
 * the same rule the server uses for attendance.
 */
export function useTemporaryAssignmentLookup() {
  const { data } = useTemporaryAssignmentSpans();
  const byEmployee = useMemo(() => {
    const map = new Map<string, TemporaryAssignmentSpan[]>();
    for (const span of data?.temporaryAssignments ?? []) {
      const list = map.get(span.employeeId);
      if (list) list.push(span);
      else map.set(span.employeeId, [span]);
    }
    return map;
  }, [data]);

  return useCallback((employeeId: string | null | undefined, date?: string | null) => {
    if (!employeeId) return null;
    const day = (date || addisTodayInput()).slice(0, 10);
    return (byEmployee.get(employeeId) ?? [])
      .filter((span) => span.effectiveFrom <= day && (!span.effectiveTo || span.effectiveTo >= day))
      .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0] ?? null;
  }, [byEmployee]);
}

function localizedName(department: DepartmentName, locale: string) {
  if (!department) return null;
  return locale === 'am' && department.nameAm ? department.nameAm : department.nameEn;
}

/**
 * Plain-text department for places that cannot hold markup (select options, search text, exports):
 * "Target (temporarily from Home)" while an assignment applies, otherwise the given department.
 */
export function useEmployeeDepartmentLabel() {
  const t = useTranslations('core');
  const locale = useLocale();
  const lookup = useTemporaryAssignmentLookup();
  return useCallback((employeeId: string | null | undefined, department: string | null | undefined, date?: string | null) => {
    const span = lookup(employeeId, date);
    if (!span) return department ?? '';
    const target = localizedName(span.targetDepartment, locale) ?? department ?? '';
    const home = localizedName(span.sourceDepartment, locale) ?? department ?? '';
    return `${target} (${t('temporarilyFromDepartment', { department: home })})`;
  }, [locale, lookup, t]);
}

/**
 * An employee's department. While a temporary assignment applies on `date`, the home department is
 * struck through next to the department they are working in, so the assignment is obvious at a glance.
 * `department` is the name to show when there is no assignment (normally the home department).
 */
export function EmployeeDepartment({
  employeeId,
  department,
  date,
  showPeriod = false,
  className,
}: {
  employeeId: string | null | undefined;
  department: string | null | undefined;
  date?: string | null;
  /** Also show a "Temporarily assigned" badge with the assignment's dates. */
  showPeriod?: boolean;
  className?: string;
}) {
  const t = useTranslations('core');
  const locale = useLocale();
  const { formatDate } = useCalendarPreference();
  const lookup = useTemporaryAssignmentLookup();
  const span = lookup(employeeId, date);

  if (!span) return <span className={className}>{department || '-'}</span>;

  const home = localizedName(span.sourceDepartment, locale) ?? department ?? '-';
  const target = localizedName(span.targetDepartment, locale) ?? department ?? '-';
  const period = `${formatDate(span.effectiveFrom)} – ${span.effectiveTo ? formatDate(span.effectiveTo) : t('openEnded')}`;

  return (
    <span className={cn('inline-flex flex-col gap-1', className)} title={`${t('temporarilyAssigned')}: ${period}`}>
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground line-through decoration-muted-foreground/70" title={t('homeDepartment')}>{home}</span>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="font-medium text-foreground">{target}</span>
      </span>
      {showPeriod ? (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{t('temporarilyAssigned')}</Badge>
          <span className="whitespace-nowrap text-[11px] text-muted-foreground">{period}</span>
        </span>
      ) : null}
    </span>
  );
}
