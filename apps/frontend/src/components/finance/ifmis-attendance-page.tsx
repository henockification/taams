'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIfmisAttendancePreview, usePushIfmisAttendance } from '@/data/hooks/core.hooks';
import type { IfmisExportStatus } from '@/data/types/core.types';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { userHasPermission } from '@/config/app-navigation';

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

function previousMonth() {
  const value = new Date();
  value.setMonth(value.getMonth() - 1);
  return { payMonth: value.getMonth() + 1, payYear: value.getFullYear() };
}

export function IfmisAttendancePage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const initial = useMemo(previousMonth, []);
  const [payMonth, setPayMonth] = useState(initial.payMonth);
  const [payYear, setPayYear] = useState(initial.payYear);
  const preview = useIfmisAttendancePreview({ payMonth, payYear });
  const push = usePushIfmisAttendance();
  const session = useSession();
  const data = preview.data;
  const succeeded = data?.batches.some((batch) => batch.status === 'SUCCEEDED') ?? false;
  const canPush = userHasPermission(session.data?.user, 'ifmis-attendance:push');

  async function handlePush() {
    try {
      const result = await push.mutateAsync({ payMonth, payYear });
      notifications.show({
        title: common('success'),
        message: t('ifmisPushSucceeded', { count: result.batch.recordCount }),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('ifmisPushFailed'),
        color: 'red',
      });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{t('ifmisAttendanceTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('ifmisAttendanceDescription')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(payMonth)} onValueChange={(value) => setPayMonth(Number(value))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map((month) => <SelectItem key={month} value={String(month)}>{t(`month${month}`)}</SelectItem>)}</SelectContent>
          </Select>
          <Input
            className="w-28"
            type="number"
            min={2000}
            max={2200}
            value={payYear}
            onChange={(event) => setPayYear(Number(event.target.value))}
          />
          <Button variant="outline" onClick={() => preview.refetch()} disabled={preview.isFetching}>
            <RefreshCw className={preview.isFetching ? 'size-4 animate-spin' : 'size-4'} />
            {t('refreshPreview')}
          </Button>
        </div>
      </div>

      {preview.isError ? (
        <Alert variant="destructive"><AlertCircle className="size-4" /><AlertTitle>{common('error')}</AlertTitle><AlertDescription>{preview.error.message}</AlertDescription></Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label={t('employees')} value={data?.rows.length ?? 0} />
        <Summary label={t('readinessIssues')} value={data?.issues.length ?? 0} />
        <Summary label={t('exportStatus')} value={succeeded ? t('exported') : data?.ready ? t('ready') : t('notReady')} />
      </div>

      {data?.issues.length ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>{t('monthNotReady')}</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 max-h-48 list-disc space-y-1 overflow-y-auto pl-5">
              {data.issues.slice(0, 100).map((issue, index) => (
                <li key={`${issue.employeeId}-${issue.date}-${issue.code}-${index}`}>
                  {issue.employeeName}{issue.date ? ` · ${issue.date}` : ''}: {t(issueLabelKey(issue.code))}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : data?.ready ? (
        <Alert><CheckCircle2 className="size-4" /><AlertTitle>{t('monthReady')}</AlertTitle><AlertDescription>{t('monthReadyDescription')}</AlertDescription></Alert>
      ) : null}

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><CardTitle>{t('ifmisPreview')}</CardTitle><CardDescription>{t('ifmisPreviewDescription')}</CardDescription></div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button disabled={!canPush || !data?.ready || succeeded || push.isPending}>
                <Send className="size-4" />{push.isPending ? t('pushingToIfmis') : t('pushToIfmis')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('confirmIfmisPush')}</AlertDialogTitle>
                <AlertDialogDescription>{t('confirmIfmisPushDescription', { month: payMonth, year: payYear, count: data?.rows.length ?? 0 })}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>{common('cancel')}</AlertDialogCancel><AlertDialogAction onClick={handlePush}>{t('pushToIfmis')}</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardHeader>
        <CardContent>
          {preview.isLoading ? <p className="text-sm text-muted-foreground">{common('loading')}</p> : (
            <div className="overflow-x-auto rounded-md border">
              <Table className="min-w-[78rem]">
                <TableHeader><TableRow>
                  <TableHead>{t('employee')}</TableHead><TableHead>{t('amharicName')}</TableHead>
                  <TableHead>{t('absenteeismDays')}</TableHead><TableHead>{t('lateDays')}</TableHead>
                  <TableHead>{t('currentStatus')}</TableHead><TableHead>{t('approved')}</TableHead>
                  <TableHead>{t('payMonth')}</TableHead><TableHead>{t('payYear')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>{data?.rows.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell className="font-medium">{[row.firstName, row.fatherName, row.grandName].filter(Boolean).join(' ')}</TableCell>
                    <TableCell>{[row.firstNameAmharic, row.fatherNameAmharic, row.grandNameAmharic].filter(Boolean).join(' ') || '-'}</TableCell>
                    <TableCell>{row.absenteeism.toFixed(2)}</TableCell><TableCell>{row.late.toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline">{row.currentStatus}</Badge></TableCell><TableCell>{row.approved}</TableCell>
                    <TableCell>{row.payMonth}</TableCell><TableCell>{row.payYear}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t('exportHistory')}</CardTitle><CardDescription>{t('exportHistoryDescription')}</CardDescription></CardHeader>
        <CardContent>
          {!data?.batches.length ? <p className="text-sm text-muted-foreground">{t('noExportHistory')}</p> : (
            <div className="overflow-x-auto rounded-md border"><Table><TableHeader><TableRow>
              <TableHead>{t('status')}</TableHead><TableHead>{t('records')}</TableHead><TableHead>{t('startedAt')}</TableHead><TableHead>{t('completedAt')}</TableHead><TableHead>{t('details')}</TableHead>
            </TableRow></TableHeader><TableBody>{data.batches.map((batch) => (
              <TableRow key={batch.id}><TableCell><Badge variant={batchVariant(batch.status)}>{t(batch.status === 'SUCCEEDED' ? 'exportSucceeded' : batch.status === 'FAILED' ? 'exportFailed' : 'exportProcessing')}</Badge></TableCell>
                <TableCell>{batch.recordCount}</TableCell><TableCell>{formatDateTime(batch.startedAt)}</TableCell><TableCell>{formatDateTime(batch.completedAt)}</TableCell><TableCell>{batch.errorMessage ?? '-'}</TableCell></TableRow>
            ))}</TableBody></Table></div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string | number }) {
  return <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value}</p></CardContent></Card>;
}

function batchVariant(status: IfmisExportStatus): 'default' | 'destructive' | 'secondary' {
  if (status === 'SUCCEEDED') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}

function issueLabelKey(code: string) {
  const labels: Record<string, 'ifmisIssueMissingSchedule' | 'ifmisIssueInvalidSchedule' | 'ifmisIssueMissingRecord' | 'ifmisIssueNotApproved' | 'ifmisIssueDuplicateName'> = {
    MISSING_SCHEDULE: 'ifmisIssueMissingSchedule',
    INVALID_SCHEDULE: 'ifmisIssueInvalidSchedule',
    MISSING_RECORD: 'ifmisIssueMissingRecord',
    NOT_HR_APPROVED: 'ifmisIssueNotApproved',
    DUPLICATE_NAME: 'ifmisIssueDuplicateName',
  };
  return labels[code] ?? 'ifmisIssueMissingRecord';
}
