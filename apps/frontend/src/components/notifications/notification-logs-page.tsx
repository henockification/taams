'use client';

import { useState } from 'react';
import { BellRing, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useNotificationLogs } from '@/data/hooks/core.hooks';
import type { NotificationChannel, NotificationStatus } from '@/data/types/core.types';

type ChannelFilter = 'all' | NotificationChannel;
type StatusFilter = 'all' | NotificationStatus;

export default function NotificationLogsPage() {
  const t = useTranslations('core');
  const [channel, setChannel] = useState<ChannelFilter>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [eventType, setEventType] = useState('');
  const [recipient, setRecipient] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const notificationLogsQuery = useNotificationLogs({
    channel: channel === 'all' ? '' : channel,
    status: status === 'all' ? '' : status,
    eventType: eventType.trim(),
    recipient: recipient.trim(),
    dateFrom,
    dateTo,
    limit: 200,
  });
  const logs = notificationLogsQuery.data?.notificationLogs ?? [];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_160px_160px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('notificationRecipientSearch')}
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
          />
        </div>
        <Input
          placeholder={t('notificationEventType')}
          value={eventType}
          onChange={(event) => setEventType(event.target.value)}
        />
        <Select value={channel} onValueChange={(value) => setChannel(value as ChannelFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allChannels')}</SelectItem>
            <SelectItem value="EMAIL">{t('email')}</SelectItem>
            <SelectItem value="SMS">{t('sms')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStatuses')}</SelectItem>
            <SelectItem value="PENDING">{t('pending')}</SelectItem>
            <SelectItem value="SENT">{t('sent')}</SelectItem>
            <SelectItem value="FAILED">{t('failed')}</SelectItem>
            <SelectItem value="SKIPPED">{t('skipped')}</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} aria-label={t('dateFrom')} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} aria-label={t('dateTo')} />
        </div>
      </div>

      <div className="overflow-hidden rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('createdAt')}</TableHead>
              <TableHead>{t('notificationEventType')}</TableHead>
              <TableHead>{t('channel')}</TableHead>
              <TableHead>{t('status')}</TableHead>
              <TableHead>{t('recipient')}</TableHead>
              <TableHead>{t('destination')}</TableHead>
              <TableHead>{t('attempts')}</TableHead>
              <TableHead>{t('message')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {notificationLogsQuery.isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">{t('loading')}</TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState icon={BellRing} title={t('noNotificationLogs')} description={t('noNotificationLogsDescription')} />
                </TableCell>
              </TableRow>
            ) : logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(log.createdAt)}</TableCell>
                <TableCell className="max-w-56 truncate font-medium">{formatEventType(log.eventType)}</TableCell>
                <TableCell><Badge variant="outline">{log.channel}</Badge></TableCell>
                <TableCell><StatusBadge status={log.status} /></TableCell>
                <TableCell className="max-w-44 truncate">{log.recipientName ?? log.recipientUser?.name ?? '-'}</TableCell>
                <TableCell className="max-w-52 truncate text-xs text-muted-foreground">{log.destination ?? '-'}</TableCell>
                <TableCell>{log.attempts}</TableCell>
                <TableCell className="max-w-80">
                  <div className="line-clamp-2 text-sm">{log.errorMessage ?? log.message}</div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: NotificationStatus }) {
  const variant = status === 'SENT' ? 'default' : status === 'FAILED' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

function formatEventType(value: string) {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
