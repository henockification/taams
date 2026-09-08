'use client';

import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  params?: Record<string, string>;
  enabled?: boolean;
  title?: string;
  description?: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function AuditTimeline({
  resourceType,
  resourceId,
  employeeId,
  params: suppliedParams,
  enabled = true,
  title,
  description,
  emptyTitle,
  emptyDescription,
}: AuditTimelineProps) {
  const t = useTranslations('audit');
  const { formatDateTime } = useCalendarPreference();
  const session = useSession();
  const canView = userHasPermission(session.data?.user, 'reports-audit:read');
  const params = suppliedParams ?? {
    ...(resourceType ? { resourceType } : {}),
    ...(resourceId ? { resourceId } : {}),
    ...(employeeId ? { employeeId } : {}),
  };
  const query = useAuditEvents(params, canView && enabled && Boolean(suppliedParams || resourceId || employeeId));

  if (!canView) return null;

  const events = query.data?.auditEvents ?? [];

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle>{title ?? t('title')}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : events.length === 0 ? (
          <EmptyState icon={History} title={emptyTitle ?? t('empty')} description={emptyDescription ?? t('emptyHint')} />
        ) : (
          <Timeline defaultValue={events.length} className="px-2">
            {events.map((event, index) => (
              <TimelineItem key={event.id} step={index + 1}>
                <TimelineSeparator />
                <TimelineIndicator />
                <TimelineHeader>
                  <TimelineDate>{formatDateTime(event.occurredAt)}</TimelineDate>
                  <TimelineTitle>
                    {getActionLabel(t, event.action, event.actionLabel)}
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

function getActionLabel(t: ReturnType<typeof useTranslations>, action: string, fallback?: string) {
  try {
    return t(`actions.${action}` as never);
  } catch {
    return fallback || action;
  }
}
