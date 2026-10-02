'use client';

import { useMemo } from 'react';
import { Network } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSupervisorReportDepartments } from '@/data/hooks/core.hooks';

import { ReportPage } from './report-page';

/**
 * Attendance for everyone in the departments the signed-in supervisor heads, including every
 * department below them in the organization structure. Approvals are unaffected by this scope.
 */
export function SupervisorReportPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const scopeQuery = useSupervisorReportDepartments();
  const scope = scopeQuery.data;

  const departmentOptions = useMemo(
    () => (scope?.departments ?? []).map((department) => ({ value: department.id, label: department.nameEn })),
    [scope],
  );

  if (scopeQuery.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (scopeQuery.isError || !scope) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {scopeQuery.error instanceof Error ? scopeQuery.error.message : common('error')}
      </div>
    );
  }

  if (!scope.unrestricted && scope.headedDepartmentIds.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title={t('supervisorReportNoHeadTitle')}
        description={t('supervisorReportNoHeadDescription')}
      />
    );
  }

  const headedNames = scope.departments
    .filter((department) => scope.headedDepartmentIds.includes(department.id))
    .map((department) => department.nameEn)
    .join(', ');
  const headerNote = (
    <p className="text-sm text-muted-foreground">
      {scope.unrestricted
        ? t('supervisorReportAllDepartments')
        : t('supervisorReportScope', { departments: headedNames })}
    </p>
  );

  return (
    <Tabs defaultValue="daily" className="w-full gap-4">
      <TabsList className="report-actions">
        <TabsTrigger value="daily">{t('supervisorReportDaily')}</TabsTrigger>
        <TabsTrigger value="summary">{t('supervisorReportSummary')}</TabsTrigger>
      </TabsList>
      <TabsContent value="daily">
        <ReportPage reportKey="supervisor-attendance" departmentOptions={departmentOptions} headerNote={headerNote} />
      </TabsContent>
      <TabsContent value="summary">
        <ReportPage
          reportKey="supervisor-attendance-summary"
          departmentOptions={departmentOptions}
          headerNote={headerNote}
        />
      </TabsContent>
    </Tabs>
  );
}
