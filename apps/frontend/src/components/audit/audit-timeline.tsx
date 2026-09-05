'use client';

import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Timeline,
  TimelineContent,
  TimelineDate,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from '@/components/ui/timeline';
import { userHasPermission } from '@/config/app-navigation';
import { useAuditEvents } from '@/data/hooks/core.hooks';
import { useSession } from '@/lib/auth-client';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type AuditTimelineProps = {
  resourceType?: string;
  resourceId?: string;
  employeeId?: string;
};

export function AuditTimeline({ resourceType, resourceId, employeeId }: AuditTimelineProps) {
  const t = useTranslations('audit');
  const { formatDateTime } = useCalendarPreference();
  const session = useSession();
  const canView = userHasPermission(session.data?.user, 'reports-audit:read');
  const params = {
    ...(resourceType ? { resourceType } : {}),
    ...(resourceId ? { resourceId } : {}),
    ...(employeeId ? { employeeId } : {}),
  };
  const query = useAuditEvents(params, canView && Boolean(resourceId || employeeId));

  if (!canView) return null;

  const events = query.data?.auditEvents ?? [];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : events.length === 0 ? (
          <EmptyState icon={History} title={t('empty')} description={t('emptyHint')} />
        ) : (
          <Timeline defaultValue={events.length} className="px-2">
            {events.map((event, index) => (
              <TimelineItem key={event.id} step={index + 1}>
                <TimelineSeparator />
                <TimelineIndicator />
                <TimelineHeader>
                  <TimelineDate>{formatDateTime(event.occurredAt)}</TimelineDate>
                  <TimelineTitle>
                    {t(`actions.${event.action}` as never)}
                  </TimelineTitle>
                </TimelineHeader>
                <TimelineContent>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>{event.actorType === 'SYSTEM' ? t('system') : event.actorName || event.actorEmail}</span>
                    <Badge variant={event.outcome === 'SUCCESS' ? 'secondary' : 'destructive'}>{event.outcome}</Badge>
                    {event.delegated ? <Badge variant="outline">{t('delegated')}</Badge> : null}
                  </div>
                  {event.resourceLabel ? (
                    <p className="mt-1">{event.resourceLabel}</p>
                  ) : null}
                  {event.changesSummary ? (
                    <p className="mt-1">
                      {t('changes')}: {event.changesSummary}
                    </p>
                  ) : null}
                </TimelineContent>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </CardContent>
    </Card>
  );
}
