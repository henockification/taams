'use client';

import { useState } from 'react';
import { Fingerprint, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

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
import { bioTypeLabel, canManageEnrollment, canViewEnrollment } from '@/components/biometric/enrollment-labels';
import { useDeprovisionEmployeeEnrollment, useEmployeeBiometricEnrollment, useProvisionEmployeeEnrollment } from '@/data/hooks/core.hooks';
import type { EmployeeDeviceEnrollmentStatus } from '@/data/types/core.types';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

// A pending removal targets either every non-master device (`deviceIds` omitted) or one device.
type RemovalTarget = { deviceIds?: string[]; deviceName: string | null };

function statusVariant(status: EmployeeDeviceEnrollmentStatus) {
  if (status === 'IN_SYNC') return 'default';
  if (status === 'FAILED') return 'destructive';
  if (status === 'ABSENT') return 'secondary';
  return 'outline';
}

export function EmployeeBiometricEnrollmentCard({ employeeId }: { employeeId: string }) {
  const t = useTranslations('biometricEnrollment');
  const common = useTranslations('common');
  const { formatDateTime } = useCalendarPreference();
  const session = useSession();
  const canView = canViewEnrollment(session.data?.user);
  // Writing to devices needs a system administrator role or biometric-enrollment:push.
  const canManage = canManageEnrollment(session.data?.user);
  const { data, isLoading } = useEmployeeBiometricEnrollment(employeeId, canView);
  const provision = useProvisionEmployeeEnrollment();
  const deprovision = useDeprovisionEmployeeEnrollment();
  const [removalTarget, setRemovalTarget] = useState<RemovalTarget | null>(null);
  const [busyDeviceId, setBusyDeviceId] = useState('');

  if (!canView) return null;

  const enrollment = data?.enrollment;
  const isBusy = provision.isPending || deprovision.isPending;

  const showError = (error: unknown) => {
    notifications.show({
      title: common('error'),
      message: error instanceof Error ? error.message : t('actionFailed'),
      color: 'red',
    });
  };

  const runProvision = async (deviceIds?: string[]) => {
    setBusyDeviceId(deviceIds?.[0] ?? '');

    try {
      const response = await provision.mutateAsync({ employeeId, deviceIds });
      notifications.show({ title: common('success'), message: t('provisionQueued', { count: response.devices }), color: 'green' });
    } catch (error) {
      showError(error);
    } finally {
      setBusyDeviceId('');
    }
  };

  const runDeprovision = async () => {
    if (!removalTarget) return;
    setBusyDeviceId(removalTarget.deviceIds?.[0] ?? '');

    try {
      const response = await deprovision.mutateAsync({ employeeId, deviceIds: removalTarget.deviceIds });
      setRemovalTarget(null);
      notifications.show({ title: common('success'), message: t('deprovisionQueued', { count: response.devices }), color: 'green' });
    } catch (error) {
      showError(error);
    } finally {
      setBusyDeviceId('');
    }
  };

  return (
    <Card className="rounded-lg">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{t('employeeCardTitle')}</CardTitle>
          <CardDescription>{t('employeeCardDescription')}</CardDescription>
        </div>
        {canManage && enrollment ? (
          <div className="flex flex-wrap gap-2">
            {/* Provisioning copies the master's data, so it needs a master enrollment; removal does not. */}
            {enrollment.enrolled ? (
              <Button type="button" variant="outline" disabled={isBusy} onClick={() => runProvision()}>
                <Plus className="size-4" />
                {t('provisionAll')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" disabled={isBusy} onClick={() => setRemovalTarget({ deviceName: null })}>
              <Trash2 className="size-4" />
              {t('removeAll')}
            </Button>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{common('loading')}</p>
        ) : !enrollment ? (
          <p className="text-sm text-muted-foreground">{t('enrollmentUnavailable')}</p>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-3">
              <Info
                label={t('enrollmentStatus')}
                value={
                  <Badge variant={enrollment.enrolled ? 'default' : 'secondary'}>{enrollment.enrolled ? t('enrolled') : t('notEnrolledOnMaster')}</Badge>
                }
              />
              <Info
                label={t('templates')}
                value={
                  enrollment.templatesByType.length > 0
                    ? enrollment.templatesByType.map((row) => `${bioTypeLabel(row.bioType, t)}: ${row.count}`).join(' · ')
                    : '-'
                }
              />
              <Info label={t('capturedAt')} value={enrollment.capturedAt ? formatDateTime(enrollment.capturedAt) : '-'} />
            </div>
            {!enrollment.pin ? <p className="text-xs text-muted-foreground">{t('noBiometricIdHint')}</p> : null}
            {enrollment.devices.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noDevices')}</p>
            ) : (
              <div className="space-y-2">
                {enrollment.devices.map((device) => (
                  <div key={device.deviceId} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Fingerprint className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{device.deviceName}</span>
                      {device.isEnrollmentMaster ? <Badge>{t('master')}</Badge> : null}
                      <Badge variant={statusVariant(device.status)}>{t(`deviceStatus${device.status}`)}</Badge>
                      {device.excluded ? <Badge variant="outline">{t('excluded')}</Badge> : null}
                    </div>
                    {canManage && !device.isEnrollmentMaster ? (
                      <div className="flex shrink-0 gap-2">
                        {enrollment.enrolled ? (
                          <Button type="button" size="sm" variant="outline" disabled={isBusy && busyDeviceId === device.deviceId} onClick={() => runProvision([device.deviceId])}>
                            {t('provision')}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={isBusy && busyDeviceId === device.deviceId}
                          onClick={() => setRemovalTarget({ deviceIds: [device.deviceId], deviceName: device.deviceName })}
                        >
                          {t('remove')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>

      <AlertDialog open={Boolean(removalTarget)} onOpenChange={(open) => !open && !deprovision.isPending && setRemovalTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('removeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {removalTarget?.deviceName ? t('removeFromDeviceConfirmDescription', { device: removalTarget.deviceName }) : t('removeAllConfirmDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deprovision.isPending}>{common('cancel')}</AlertDialogCancel>
            <Button type="button" variant="destructive" disabled={deprovision.isPending} onClick={runDeprovision}>
              {t('remove')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="font-medium">{value}</div>
    </div>
  );
}
