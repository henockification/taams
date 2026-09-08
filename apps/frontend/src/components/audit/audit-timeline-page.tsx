'use client';

import { useMemo, useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { AuditTimeline } from '@/components/audit/audit-timeline';
import { CalendarDateField } from '@/components/calendar/calendar-date-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const RESOURCE_TYPES = [
  'employee',
  'leave_request',
  'attendance_daily_record',
  'manual_punch_request',
  'overtime_request',
  'supervisor_delegation',
  'user',
  'role',
  'permission',
  'biometric_device',
  'attendance_punch',
  'work_schedule',
  'shift',
  'holiday',
];

type TimelineFilters = {
  dateFrom: string;
  dateTo: string;
  actorSearch: string;
  resourceType: string;
  outcome: string;
  delegatedOnly: string;
};

const initialFilters: TimelineFilters = {
  dateFrom: '',
  dateTo: '',
  actorSearch: '',
  resourceType: 'all',
  outcome: 'all',
  delegatedOnly: 'all',
};

export function AuditTimelinePage() {
  const t = useTranslations('audit');
  const common = useTranslations('common');
  const [filters, setFilters] = useState<TimelineFilters>(initialFilters);
  const params = useMemo(() => {
    const query: Record<string, string> = { limit: '250' };

    if (filters.dateFrom) query.dateFrom = filters.dateFrom;
    if (filters.dateTo) query.dateTo = filters.dateTo;
    if (filters.actorSearch.trim()) query.actorSearch = filters.actorSearch.trim();
    if (filters.resourceType !== 'all') query.resourceType = filters.resourceType;
    if (filters.outcome !== 'all') query.outcome = filters.outcome;
    if (filters.delegatedOnly === 'delegated') query.delegatedOnly = 'true';

    return query;
  }, [filters]);

  const patchFilters = (patch: Partial<TimelineFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">{t('securityEyebrow')}</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <History className="size-6" />
              {t('timelineTitle')}
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('timelineDescription')}</p>
          </div>
        </div>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{t('filters')}</CardTitle>
          <CardDescription>{t('filtersDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="space-y-2 xl:col-span-2">
            <Label>{t('actorSearch')}</Label>
            <Input
              value={filters.actorSearch}
              onChange={(event) => patchFilters({ actorSearch: event.target.value })}
              placeholder={t('actorSearchPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('dateFrom')}</Label>
            <CalendarDateField value={filters.dateFrom} onChange={(dateFrom) => patchFilters({ dateFrom })} />
          </div>
          <div className="space-y-2">
            <Label>{t('dateTo')}</Label>
            <CalendarDateField value={filters.dateTo} onChange={(dateTo) => patchFilters({ dateTo })} />
          </div>
          <div className="space-y-2">
            <Label>{t('resourceType')}</Label>
            <Select value={filters.resourceType} onValueChange={(resourceType) => patchFilters({ resourceType })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allResources')}</SelectItem>
                {RESOURCE_TYPES.map((resourceType) => (
                  <SelectItem key={resourceType} value={resourceType}>
                    {resourceType.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('outcome')}</Label>
            <Select value={filters.outcome} onValueChange={(outcome) => patchFilters({ outcome })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allOutcomes')}</SelectItem>
                <SelectItem value="SUCCESS">SUCCESS</SelectItem>
                <SelectItem value="DENIED">DENIED</SelectItem>
                <SelectItem value="FAILED">FAILED</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('delegation')}</Label>
            <Select value={filters.delegatedOnly} onValueChange={(delegatedOnly) => patchFilters({ delegatedOnly })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allActions')}</SelectItem>
                <SelectItem value="delegated">{t('delegatedOnly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" className="w-full" onClick={() => setFilters(initialFilters)}>
              <RotateCcw className="size-4" />
              {common('reset')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <AuditTimeline
        params={params}
        title={t('recentActivity')}
        description={t('recentActivityDescription')}
        emptyTitle={t('timelineEmpty')}
        emptyDescription={t('timelineEmptyHint')}
      />
    </div>
  );
}
