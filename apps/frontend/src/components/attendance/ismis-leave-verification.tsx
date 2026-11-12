'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCompleteIsmisLeave, useIsmisLeaveImport, useLatestIsmisLeaveImport, useRejectIsmisLeave } from '@/data/hooks/core.hooks';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

/**
 * The permanent-employee ISMIS leave check as a one-line banner with its import / confirm
 * dialog. `range` is the period the confirmation covers (HR's records, or the payroll month).
 */
export function IsmisLeaveVerification({ range }: { range: { dateFrom: string; dateTo: string } }) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const leaveImport = useIsmisLeaveImport();
  const completeLeave = useCompleteIsmisLeave();
  const rejectLeave = useRejectIsmisLeave();
  const latestLeave = useLatestIsmisLeaveImport();
  const [open, setOpen] = useState(false);
  const [leaveFile, setLeaveFile] = useState<File | null>(null);
  const batch = latestLeave.data?.batch ?? null;

  // These run through mutateAsync so the result message shows even though the buttons
  // that started them disappear once the import status changes.
  async function handleImport() {
    if (!leaveFile) return;
    try {
      const imported = await leaveImport.mutateAsync(leaveFile);
      notifications.show({
        title: imported.unmatchedCount > 0 ? common('error') : common('success'),
        message: imported.unmatchedCount > 0
          ? t('ismisLeaveImportedUnmatched', { count: imported.unmatchedCount, ids: (imported.unmatchedEmployeeIds ?? []).slice(0, 5).join(', ') })
          : t('ismisLeaveImported', { employees: imported.matchedCount, days: imported.dayCount }),
        color: imported.unmatchedCount > 0 ? 'red' : 'green',
      });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  async function handleCheck(batchId: string) {
    try {
      const result = await completeLeave.mutateAsync({ batchId, ...range });
      notifications.show({ title: common('success'), message: t('ismisLeaveCheckCompleted', { count: result.recalculatedRecords }), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  async function handleDiscard(batchId: string) {
    try {
      await rejectLeave.mutateAsync(batchId);
      notifications.show({ title: common('success'), message: t('ismisLeaveImportDiscarded'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  const pending = batch?.status === 'PENDING';
  const unmatched = pending && batch.unmatchedCount > 0;
  const tone = unmatched
    ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
    : pending
      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200'
      : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200';
  const Icon = unmatched || pending ? AlertTriangle : Info;
  const message = unmatched
    ? t('ismisLeaveBannerUnmatched', { count: batch.unmatchedCount })
    : pending
      ? t('ismisLeaveBannerPending')
      : t('ismisLeaveBannerReminder');

  return (
    <>
      <div role="status" className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border px-3 py-1.5 text-xs ${tone}`}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          {message}
          {batch?.status === 'COMPLETED' && batch.completedAt ? (
            <span className="opacity-75"> · {t('ismisLeaveLastChecked', { date: formatDate(batch.completedAt.slice(0, 10)) })}</span>
          ) : null}
        </span>
        <Button type="button" size="sm" variant="outline" className="h-7 bg-background text-xs" onClick={() => setOpen(true)}>
          <FileSpreadsheet className="size-3.5" />
          {t('verifyIsmisLeave')}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('ismisLeaveVerification')}</DialogTitle>
            <DialogDescription>{t('ismisLeaveVerificationDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            {batch ? (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                {t('ismisLeaveLatestImport', {
                  file: batch.sourceFileName,
                  status: t(`ismisStatus${batch.status}`),
                  matched: batch.matchedCount,
                  unmatched: batch.unmatchedCount,
                })}
              </p>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="ismis-leave-file">{t('ismisLeaveFile')}</Label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input id="ismis-leave-file" type="file" accept=".xlsx,.xls" onChange={(event) => setLeaveFile(event.target.files?.[0] ?? null)} />
                <Button type="button" disabled={!leaveFile || leaveImport.isPending} onClick={handleImport}>
                  <FileSpreadsheet className="size-4" />
                  {t('importIsmisLeave')}
                </Button>
              </div>
            </div>
            {pending ? (
              <div className="flex flex-col gap-2 border-t border-border pt-4">
                <p className="text-xs text-muted-foreground">
                  {t('ismisLeaveCheckCovers', { from: formatDate(range.dateFrom), to: formatDate(range.dateTo) })}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    disabled={batch.unmatchedCount > 0 || completeLeave.isPending}
                    onClick={() => handleCheck(batch.id)}
                  >
                    <CheckCircle2 className="size-4" />
                    {t('confirmIsmisLeaveChecked')}
                  </Button>
                  <Button type="button" variant="ghost" disabled={rejectLeave.isPending} onClick={() => handleDiscard(batch.id)}>
                    {t('discardIsmisImport')}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>{common('close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
