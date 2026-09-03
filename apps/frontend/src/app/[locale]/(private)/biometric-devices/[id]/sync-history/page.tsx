'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

import { getReadableSyncError } from '@/components/biometric/sync-history-error';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useBiometricDevice, useBiometricDeviceSyncHistory } from '@/data/hooks/core.hooks';
import { Link } from '@/i18n';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const pageSize = 20;

function statusVariant(status: string) {
  if (status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

export default function BiometricDeviceSyncHistoryPage() {
  const params = useParams();
  const deviceId = params.id as string;
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDateTime } = useCalendarPreference();
  const deviceQuery = useBiometricDevice(deviceId);
  const historyQuery = useBiometricDeviceSyncHistory(deviceId);
  const [page, setPage] = useState(1);
  const records = historyQuery.data?.attendanceSyncBatches ?? [];
  const pageCount = Math.max(1, Math.ceil(records.length / pageSize));
  const visibleRecords = useMemo(
    () => records.slice((page - 1) * pageSize, page * pageSize),
    [page, records],
  );

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const rangeStart = records.length ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = Math.min(page * pageSize, records.length);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <Button asChild variant="ghost" className="-ml-3">
        <Link href="/biometric-devices">
          <ArrowLeft className="size-4" />
          {t('backToBiometricDevices')}
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{t('syncHistory')}</CardTitle>
          <CardDescription>
            {deviceQuery.data?.biometricDevice.deviceName
              ? `${deviceQuery.data.biometricDevice.deviceName} — ${t('syncHistoryDescription')}`
              : t('syncHistoryDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {historyQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : records.length === 0 ? (
            <EmptyState icon={RefreshCw} title={t('noSyncHistory')} description={t('noSyncHistoryDescription')} />
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('syncStatus')}</TableHead>
                      <TableHead>{t('syncStartedAt')}</TableHead>
                      <TableHead>{t('syncCompletedAt')}</TableHead>
                      <TableHead className="text-right">{t('totalRecords')}</TableHead>
                      <TableHead className="text-right">{t('successfulRecords')}</TableHead>
                      <TableHead className="text-right">{t('failedRecords')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleRecords.map((batch) => (
                      <Fragment key={batch.id}>
                        <TableRow>
                          <TableCell><Badge variant={statusVariant(batch.syncStatus) as any}>{batch.syncStatus}</Badge></TableCell>
                          <TableCell className="whitespace-nowrap">{formatDateTime(batch.syncStartedAt)}</TableCell>
                          <TableCell className="whitespace-nowrap">{batch.syncCompletedAt ? formatDateTime(batch.syncCompletedAt) : '-'}</TableCell>
                          <TableCell className="text-right">{batch.totalRecords}</TableCell>
                          <TableCell className="text-right">{batch.successfulRecords}</TableCell>
                          <TableCell className="text-right">{batch.failedRecords}</TableCell>
                        </TableRow>
                        {batch.errorMessage ? (
                          <TableRow className="bg-destructive/5 hover:bg-destructive/5">
                            <TableCell colSpan={6} className="text-sm text-destructive">
                              <span className="font-medium">{t('errorMessage')}:</span>{' '}
                              {getReadableSyncError(batch.errorMessage, t('unknownDeviceError'))}
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('syncHistoryCount', { from: rangeStart, to: rangeEnd, total: records.length })}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                    {common('previous')}
                  </Button>
                  <Button variant="outline" size="sm" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>
                    {common('next')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
