'use client';

import { FormEvent, useState } from 'react';
import { AlertTriangle, ChevronDown, CloudDownload, Eye, ListRestart, OctagonX, RefreshCw, RotateCcw, ScanFace, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { bioTypeLabel, canManageEnrollment, FACE_BIO_TYPE, PALM_BIO_TYPE } from '@/components/biometric/enrollment-labels';
import {
  useApplyEnrollmentSync,
  useBiometricEnrollmentOverview,
  useBiometricEnrollmentSyncRuns,
  useCancelPendingEnrollmentCommands,
  useImportEnrollmentUsb,
  usePreviewEnrollmentSync,
  useRefreshEnrollmentDeviceRoster,
  useRefreshEnrollmentFromMaster,
  useRetryFailedEnrollmentCommands,
} from '@/data/hooks/core.hooks';
import type { EnrollmentOverviewDevice, EnrollmentSyncPreview } from '@/data/types/core.types';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

// Sync is previewed first; `deviceId: null` means every enrollment-sync device.
type SyncScope = { deviceId: string | null; deviceName: string | null };

export default function BiometricEnrollmentPage() {
  const t = useTranslations('biometricEnrollment');
  const common = useTranslations('common');
  const { formatDateTime } = useCalendarPreference();
  const session = useSession();
  // Anything that writes to devices needs a system administrator role or biometric-enrollment:push.
  const canManage = canManageEnrollment(session.data?.user);

  const overviewQuery = useBiometricEnrollmentOverview();
  const overview = overviewQuery.data?.overview;
  const devices = overview?.devices ?? [];
  // Run progress is polled alongside the overview while devices still have queued commands.
  const syncRunsQuery = useBiometricEnrollmentSyncRuns(devices.some((device) => device.pendingCommands > 0));
  const syncRuns = syncRunsQuery.data?.syncRuns ?? [];

  const importUsb = useImportEnrollmentUsb();
  const refreshFromMaster = useRefreshEnrollmentFromMaster();
  const previewSync = usePreviewEnrollmentSync();
  const applySync = useApplyEnrollmentSync();
  const refreshRoster = useRefreshEnrollmentDeviceRoster();
  const retryFailed = useRetryFailedEnrollmentCommands();
  const cancelPending = useCancelPendingEnrollmentCommands();

  const [importOpen, setImportOpen] = useState(false);
  const [userFile, setUserFile] = useState<File | null>(null);
  const [biodataFile, setBiodataFile] = useState<File | null>(null);
  const [syncScope, setSyncScope] = useState<SyncScope | null>(null);
  const [allowRemovals, setAllowRemovals] = useState(false);
  const [preview, setPreview] = useState<EnrollmentSyncPreview[] | null>(null);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [cancelDevice, setCancelDevice] = useState<EnrollmentOverviewDevice | null>(null);
  const [busyDeviceId, setBusyDeviceId] = useState('');
  const [unmatchedOpen, setUnmatchedOpen] = useState(false);

  const usersForType = (bioType: number) => overview?.templatesByType.find((row) => row.bioType === bioType)?.users ?? 0;
  const deviceName = (deviceId: string) => devices.find((device) => device.id === deviceId)?.deviceName ?? deviceId;

  const showError = (error: unknown) => {
    notifications.show({
      title: common('error'),
      message: error instanceof Error ? error.message : t('actionFailed'),
      color: 'red',
    });
  };

  const showSuccess = (message: string) => {
    notifications.show({ title: common('success'), message, color: 'green' });
  };

  const submitImport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userFile || !biodataFile) return;

    try {
      const { result } = await importUsb.mutateAsync({ userFile, biodataFile });
      setImportOpen(false);
      setUserFile(null);
      setBiodataFile(null);
      showSuccess(
        t('importSucceeded', {
          users: result.users,
          templates: result.templates,
          linkedUsers: result.linkedUsers,
          unmatched: result.unmatchedPins.length,
        }),
      );
    } catch (error) {
      showError(error);
    }
  };

  const runRefreshFromMaster = async () => {
    try {
      await refreshFromMaster.mutateAsync();
      showSuccess(t('refreshFromMasterQueued'));
    } catch (error) {
      showError(error);
    }
  };

  const loadPreview = async (scope: SyncScope, includeRemovals: boolean) => {
    try {
      const response = await previewSync.mutateAsync({ deviceId: scope.deviceId, allowRemovals: includeRemovals });
      setPreview(response.devices);
    } catch (error) {
      showError(error);
    }
  };

  const openPreview = (scope: SyncScope) => {
    setSyncScope(scope);
    setAllowRemovals(false);
    setPreview(null);
    loadPreview(scope, false);
  };

  const toggleRemovals = (checked: boolean) => {
    setAllowRemovals(checked);
    if (syncScope) loadPreview(syncScope, checked);
  };

  const runApplySync = async () => {
    if (!syncScope) return;

    try {
      await applySync.mutateAsync({ deviceId: syncScope.deviceId, allowRemovals });
      setConfirmApplyOpen(false);
      setSyncScope(null);
      setPreview(null);
      showSuccess(t('syncQueued'));
    } catch (error) {
      showError(error);
    }
  };

  const runDeviceAction = async (device: EnrollmentOverviewDevice, action: 'roster' | 'retry' | 'cancel') => {
    setBusyDeviceId(device.id);

    try {
      if (action === 'roster') {
        await refreshRoster.mutateAsync(device.id);
        showSuccess(t('rosterRefreshQueued', { device: device.deviceName }));
      } else if (action === 'retry') {
        const response = await retryFailed.mutateAsync(device.id);
        showSuccess(t('retriedCommands', { count: response.retried }));
      } else {
        const response = await cancelPending.mutateAsync(device.id);
        setCancelDevice(null);
        showSuccess(t('cancelledCommands', { count: response.cancelled }));
      }
    } catch (error) {
      showError(error);
    } finally {
      setBusyDeviceId('');
    }
  };

  const previewHasChanges = (preview ?? []).some((row) => row.add + row.update + row.remove > 0);
  const previewRemovals = (preview ?? []).reduce((total, row) => total + row.remove, 0);

  return (
    <div className="flex w-full flex-col gap-6">
      {overview && !overview.commandsEnabled ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>{t('commandsDisabledTitle')}</AlertTitle>
          <AlertDescription>{t('commandsDisabledDescription')}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label={t('usersCaptured')} value={overview?.users ?? 0} />
          <SummaryTile label={t('linkedToEmployees')} value={overview?.linkedUsers ?? 0} />
          <SummaryTile label={t('faceUsers')} value={usersForType(FACE_BIO_TYPE)} />
          <SummaryTile label={t('palmUsers')} value={usersForType(PALM_BIO_TYPE)} />
        </div>
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" />
              {t('importUsb')}
            </Button>
            <Button variant="outline" onClick={runRefreshFromMaster} disabled={refreshFromMaster.isPending}>
              <CloudDownload className="size-4" />
              {t('refreshFromMaster')}
            </Button>
            <Button onClick={() => openPreview({ deviceId: null, deviceName: null })}>
              <Eye className="size-4" />
              {t('previewSync')}
            </Button>
          </div>
        ) : null}
      </div>

      {overview && overview.templatesByType.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {overview.templatesByType
            .map((row) => t('templateTypeSummary', { type: bioTypeLabel(row.bioType, t), templates: row.templates, users: row.users }))
            .join(' · ')}
        </p>
      ) : null}

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{t('devicesTitle')}</CardTitle>
          <CardDescription>{t('devicesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {overviewQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : devices.length === 0 ? (
            <EmptyState icon={ScanFace} title={t('noDevices')} description={t('noDevicesDescription')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('device')}</TableHead>
                  <TableHead>{t('role')}</TableHead>
                  <TableHead>{t('enrollmentSync')}</TableHead>
                  <TableHead>{t('lastPoll')}</TableHead>
                  <TableHead className="text-right">{t('usersOnDevice')}</TableHead>
                  <TableHead className="text-right">{t('pending')}</TableHead>
                  <TableHead className="text-right">{t('failed')}</TableHead>
                  {canManage ? <TableHead className="text-right">{t('actions')}</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.map((device) => (
                  <TableRow key={device.id}>
                    <TableCell>
                      <p className="font-medium">{device.deviceName}</p>
                      <p className="text-xs text-muted-foreground">{[device.serialNumber, device.ipAddress].filter(Boolean).join(' · ') || '-'}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={device.isEnrollmentMaster ? 'default' : 'outline'}>{device.isEnrollmentMaster ? t('master') : t('target')}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={device.enrollmentSyncEnabled ? 'default' : 'secondary'}>{device.enrollmentSyncEnabled ? t('enabled') : t('disabled')}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{device.lastCommandPollAt ? formatDateTime(device.lastCommandPollAt) : t('never')}</TableCell>
                    <TableCell className="text-right">{device.rosterSize}</TableCell>
                    <TableCell className="text-right">{device.pendingCommands}</TableCell>
                    <TableCell className={device.failedCommands > 0 ? 'text-right font-medium text-destructive' : 'text-right'}>
                      {device.failedCommands}
                      {device.failureReasons?.map((reason) => (
                        <p key={`${reason.kind}:${reason.returnCode}`} className="text-xs font-normal text-muted-foreground">
                          {reason.kind} · {reason.returnCode === null ? t('noReply') : `Return=${reason.returnCode}`} · {reason.count}
                        </p>
                      ))}
                    </TableCell>
                    {canManage ? (
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          {!device.isEnrollmentMaster ? (
                            <Button size="sm" variant="outline" onClick={() => openPreview({ deviceId: device.id, deviceName: device.deviceName })}>
                              <RefreshCw className="size-4" />
                              {t('syncDevice')}
                            </Button>
                          ) : null}
                          <Button size="sm" variant="outline" disabled={busyDeviceId === device.id} onClick={() => runDeviceAction(device, 'roster')}>
                            <ListRestart className="size-4" />
                            {t('refreshRoster')}
                          </Button>
                          {device.failedCommands > 0 ? (
                            <Button size="sm" variant="outline" disabled={busyDeviceId === device.id} onClick={() => runDeviceAction(device, 'retry')}>
                              <RotateCcw className="size-4" />
                              {t('retryFailed')}
                            </Button>
                          ) : null}
                          {device.pendingCommands > 0 ? (
                            <Button size="sm" variant="destructive" disabled={busyDeviceId === device.id} onClick={() => setCancelDevice(device)}>
                              <OctagonX className="size-4" />
                              {t('cancelPending')}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{t('syncRunsTitle')}</CardTitle>
          <CardDescription>{t('syncRunsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {syncRunsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : syncRuns.length === 0 ? (
            <EmptyState icon={RefreshCw} title={t('noSyncRuns')} description={t('noSyncRunsDescription')} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('createdAt')}</TableHead>
                  <TableHead>{t('scope')}</TableHead>
                  <TableHead className="text-right">{t('added')}</TableHead>
                  <TableHead className="text-right">{t('updated')}</TableHead>
                  <TableHead className="text-right">{t('removed')}</TableHead>
                  <TableHead>{t('progress')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-xs">{formatDateTime(run.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline">{t(`scope${run.scope}`)}</Badge>
                        {run.allowRemovals ? <Badge variant="destructive">{t('removalsAllowed')}</Badge> : null}
                      </div>
                      {run.deviceId ? <p className="mt-1 text-xs text-muted-foreground">{deviceName(run.deviceId)}</p> : null}
                    </TableCell>
                    <TableCell className="text-right">{run.usersAdded}</TableCell>
                    <TableCell className="text-right">{run.usersUpdated}</TableCell>
                    <TableCell className="text-right">{run.usersRemoved}</TableCell>
                    <TableCell>
                      {run.devices.length === 0 ? (
                        <span className="text-xs text-muted-foreground">-</span>
                      ) : (
                        <div className="space-y-1">
                          {run.devices.map((progress) => {
                            // Cancelled commands no longer count towards completion.
                            const total = progress.PENDING + progress.SENT + progress.SUCCEEDED + progress.FAILED;
                            return (
                              <p key={progress.deviceId} className="text-xs">
                                <span className="font-medium">{deviceName(progress.deviceId)}</span>
                                {': '}
                                {t('progressSummary', { succeeded: progress.SUCCEEDED, total })}
                                {progress.FAILED > 0 ? <span className="text-destructive"> · {t('failedCount', { count: progress.FAILED })}</span> : null}
                                {progress.CANCELLED > 0 ? <span className="text-muted-foreground"> · {t('cancelledCount', { count: progress.CANCELLED })}</span> : null}
                              </p>
                            );
                          })}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-lg">
        <Collapsible open={unmatchedOpen} onOpenChange={setUnmatchedOpen}>
          <CardHeader>
            <CollapsibleTrigger asChild>
              <button type="button" className="flex w-full items-start justify-between gap-3 text-left">
                <div>
                  <CardTitle>{t('unmatchedTitle', { count: overview?.unmatchedUsers.length ?? 0 })}</CardTitle>
                  <CardDescription>{t('unmatchedDescription')}</CardDescription>
                </div>
                <ChevronDown className={`size-4 shrink-0 transition-transform ${unmatchedOpen ? 'rotate-180' : ''}`} />
              </button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              {(overview?.unmatchedUsers.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground">{t('noUnmatched')}</p>
              ) : (
                <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-4">
                  {overview?.unmatchedUsers.map((user) => (
                    <div key={user.pin} className="rounded-md border border-border px-3 py-2 text-sm">
                      <p className="font-medium">{user.pin}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.name || '-'}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      <Dialog open={importOpen} onOpenChange={(open) => !importUsb.isPending && setImportOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('importUsb')}</DialogTitle>
            <DialogDescription>{t('importUsbDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitImport}>
            <div className="space-y-2">
              <Label htmlFor="enrollment-user-file">{t('userFile')}</Label>
              <Input id="enrollment-user-file" type="file" accept=".dat" onChange={(event) => setUserFile(event.target.files?.[0] ?? null)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="enrollment-biodata-file">{t('biodataFile')}</Label>
              <Input id="enrollment-biodata-file" type="file" accept=".dat" onChange={(event) => setBiodataFile(event.target.files?.[0] ?? null)} />
            </div>
            {importUsb.isPending ? <p className="text-xs text-muted-foreground">{t('uploading')}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={importUsb.isPending} onClick={() => setImportOpen(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={!userFile || !biodataFile || importUsb.isPending}>
                {importUsb.isPending ? t('uploading') : common('import')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(syncScope)}
        onOpenChange={(open) => {
          if (!open && !applySync.isPending) {
            setSyncScope(null);
            setPreview(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{syncScope?.deviceName ? t('previewSyncForDevice', { device: syncScope.deviceName }) : t('previewSync')}</DialogTitle>
            <DialogDescription>{t('previewSyncDescription')}</DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-3 rounded-md border border-border p-3">
            <Checkbox id="enrollment-allow-removals" checked={allowRemovals} disabled={previewSync.isPending} onCheckedChange={(checked) => toggleRemovals(checked === true)} />
            <div className="space-y-1">
              <Label htmlFor="enrollment-allow-removals">{t('includeRemovals')}</Label>
              <p className="text-xs text-muted-foreground">{t('includeRemovalsHelp')}</p>
            </div>
          </div>
          {previewSync.isPending || !preview ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : preview.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('noSyncTargets')}</p>
          ) : (
            <div className="max-h-[50vh] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('device')}</TableHead>
                    <TableHead className="text-right">{t('usersOnDevice')}</TableHead>
                    <TableHead className="text-right">{t('toAdd')}</TableHead>
                    <TableHead className="text-right">{t('toUpdate')}</TableHead>
                    <TableHead className="text-right">{t('toRemove')}</TableHead>
                    <TableHead className="text-right">{t('heldRemovals')}</TableHead>
                    <TableHead className="text-right">{t('unknownOnDevice')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row) => (
                    <TableRow key={row.deviceId}>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{row.deviceName}</span>
                          {row.isEnrollmentMaster ? <Badge>{t('master')}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{row.rosterSize}</TableCell>
                      <TableCell className="text-right">{row.add}</TableCell>
                      <TableCell className="text-right">{row.update}</TableCell>
                      <TableCell className={row.remove > 0 ? 'text-right font-medium text-destructive' : 'text-right'}>{row.remove}</TableCell>
                      <TableCell className="text-right">{row.heldRemovals}</TableCell>
                      <TableCell className="text-right">{row.unknownOnDevice}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSyncScope(null);
                setPreview(null);
              }}
            >
              {common('cancel')}
            </Button>
            <Button type="button" disabled={!preview || previewSync.isPending || !previewHasChanges} onClick={() => setConfirmApplyOpen(true)}>
              {t('applySync')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmApplyOpen} onOpenChange={(open) => !applySync.isPending && setConfirmApplyOpen(open)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('applySyncConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('applySyncConfirmDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          {allowRemovals && previewRemovals > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle />
              <AlertDescription>{t('applySyncRemovalWarning', { count: previewRemovals })}</AlertDescription>
            </Alert>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applySync.isPending}>{common('cancel')}</AlertDialogCancel>
            {/* A plain button keeps the dialog open while saving and if the server refuses. */}
            <Button type="button" variant={allowRemovals && previewRemovals > 0 ? 'destructive' : 'default'} disabled={applySync.isPending} onClick={runApplySync}>
              {applySync.isPending ? t('applying') : t('applySync')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(cancelDevice)} onOpenChange={(open) => !open && !cancelPending.isPending && setCancelDevice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cancelPendingConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('cancelPendingConfirmDescription', { device: cancelDevice?.deviceName ?? '', count: cancelDevice?.pendingCommands ?? 0 })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelPending.isPending}>{common('cancel')}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={cancelPending.isPending} onClick={() => cancelDevice && runDeviceAction(cancelDevice, 'cancel')}>
              {t('cancelPending')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
