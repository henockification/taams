'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Fingerprint, Pencil, PlugZap, Plus, RefreshCw, Router } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useBiometricDeviceSyncHistory,
  useBiometricDevices,
  useCreateBiometricDevice,
  useDepartments,
  useSyncBiometricDevice,
  useTestBiometricDeviceConnection,
  useUpdateBiometricDevice,
} from '@/data/hooks/core.hooks';
import type {
  BiometricDevice,
  BiometricDeviceType,
  ConnectionType,
  DeviceHealthStatus,
  DeviceIntegrationMode,
} from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

const deviceTypes: BiometricDeviceType[] = ['BIOMETRIC', 'RFID', 'FACE_RECOGNITION', 'MOBILE', 'WEB'];
const connectionTypes: ConnectionType[] = ['TCP_IP', 'USB', 'WIFI', 'API'];
const integrationModes: DeviceIntegrationMode[] = ['PUSH_ADMS', 'TCP_PULL', 'HYBRID', 'MANUAL_ONLY', 'DISABLED'];
const noneValue = '__none';

const modeFieldVisibility = {
  PUSH_ADMS: {
    ipAddress: false,
    port: false,
    communicationKey: false,
    protocol: true,
    pushEnabled: true,
    pullEnabled: false,
    pushSecret: true,
    fallbackToPull: false,
    syncIntervalMinutes: false,
    autoSyncEnabled: false,
    lastPushAt: true,
    lastPullAt: false,
    lastSeenAt: true,
  },
  TCP_PULL: {
    ipAddress: true,
    port: true,
    communicationKey: true,
    protocol: true,
    pushEnabled: false,
    pullEnabled: true,
    pushSecret: false,
    fallbackToPull: false,
    syncIntervalMinutes: true,
    autoSyncEnabled: true,
    lastPushAt: false,
    lastPullAt: true,
    lastSeenAt: true,
  },
  HYBRID: {
    ipAddress: true,
    port: true,
    communicationKey: true,
    protocol: true,
    pushEnabled: true,
    pullEnabled: true,
    pushSecret: true,
    fallbackToPull: true,
    syncIntervalMinutes: true,
    autoSyncEnabled: true,
    lastPushAt: true,
    lastPullAt: true,
    lastSeenAt: true,
  },
  MANUAL_ONLY: {
    ipAddress: false,
    port: false,
    communicationKey: false,
    protocol: false,
    pushEnabled: false,
    pullEnabled: false,
    pushSecret: false,
    fallbackToPull: false,
    syncIntervalMinutes: false,
    autoSyncEnabled: false,
    lastPushAt: false,
    lastPullAt: false,
    lastSeenAt: false,
  },
  DISABLED: {
    ipAddress: false,
    port: false,
    communicationKey: false,
    protocol: false,
    pushEnabled: false,
    pullEnabled: false,
    pushSecret: false,
    fallbackToPull: false,
    syncIntervalMinutes: false,
    autoSyncEnabled: false,
    lastPushAt: false,
    lastPullAt: false,
    lastSeenAt: false,
  },
} satisfies Record<DeviceIntegrationMode, Record<string, boolean>>;

function getModeDefaults(mode: DeviceIntegrationMode) {
  return {
    preferredMode: mode === 'HYBRID' ? 'PUSH_ADMS' : mode,
    pushEnabled: mode === 'PUSH_ADMS' || mode === 'HYBRID',
    pullEnabled: mode === 'TCP_PULL' || mode === 'HYBRID',
    fallbackToPull: mode === 'HYBRID',
    autoSyncEnabled: mode === 'TCP_PULL' || mode === 'HYBRID',
  };
}

const initialForm = {
  deviceName: '',
  deviceCode: '',
  ipAddress: '',
  port: '4370',
  locationName: '',
  departmentId: '',
  deviceType: 'BIOMETRIC' as BiometricDeviceType,
  connectionType: 'TCP_IP' as ConnectionType,
  vendor: 'ZKTECO',
  protocol: 'TCP_IP',
  integrationMode: 'HYBRID' as DeviceIntegrationMode,
  preferredMode: 'PUSH_ADMS' as DeviceIntegrationMode,
  pushEnabled: true,
  pullEnabled: true,
  pushSecret: '',
  communicationKey: '',
  serialNumber: '',
  model: '',
  manufacturer: '',
  syncIntervalMinutes: '5',
  autoSyncEnabled: true,
  healthStatus: 'UNKNOWN' as DeviceHealthStatus,
  fallbackToPull: true,
  isActive: true,
};

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString();
}

function statusVariant(status: string) {
  if (status === 'COMPLETED') return 'default';
  if (status === 'FAILED') return 'destructive';
  return 'secondary';
}

export default function BiometricDevicesPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { data: devicesResponse, isLoading } = useBiometricDevices();
  const { data: departmentsResponse } = useDepartments();
  const createDevice = useCreateBiometricDevice();
  const updateDevice = useUpdateBiometricDevice();
  const syncDevice = useSyncBiometricDevice();
  const testDeviceConnection = useTestBiometricDeviceConnection();

  const devices = devicesResponse?.biometricDevices ?? [];
  const departments = departmentsResponse?.departments ?? [];
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<BiometricDevice | null>(null);
  const [testingDeviceId, setTestingDeviceId] = useState('');
  const [form, setForm] = useState(initialForm);
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  const syncHistory = useBiometricDeviceSyncHistory(selectedDevice?.id ?? '');
  const activeCount = useMemo(() => devices.filter((device) => device.isActive).length, [devices]);
  const visibleFields = modeFieldVisibility[form.integrationMode];

  const openCreateDevice = () => {
    setEditingDevice(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEditDevice = (device: BiometricDevice) => {
    setEditingDevice(device);
    setForm({
      deviceName: device.deviceName,
      deviceCode: device.deviceCode,
      ipAddress: device.ipAddress ?? '',
      port: device.port ? String(device.port) : '',
      locationName: device.locationName ?? '',
      departmentId: device.departmentId ?? '',
      deviceType: device.deviceType,
      connectionType: device.connectionType,
      vendor: device.vendor,
      protocol: device.protocol,
      integrationMode: device.integrationMode,
      preferredMode: device.preferredMode,
      pushEnabled: device.pushEnabled,
      pullEnabled: device.pullEnabled,
      pushSecret: device.pushSecret ?? '',
      communicationKey: device.communicationKey ?? '',
      serialNumber: device.serialNumber ?? '',
      model: device.model ?? '',
      manufacturer: device.manufacturer ?? '',
      syncIntervalMinutes: String(device.syncIntervalMinutes),
      autoSyncEnabled: device.autoSyncEnabled,
      healthStatus: device.healthStatus,
      fallbackToPull: device.fallbackToPull,
      isActive: device.isActive,
    });
    setDialogOpen(true);
  };

  const saveDevice = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const fieldVisibility = modeFieldVisibility[form.integrationMode];
      const payload = {
        deviceName: form.deviceName.trim(),
        deviceCode: form.deviceCode.trim(),
        ipAddress: fieldVisibility.ipAddress ? form.ipAddress.trim() || null : null,
        port: fieldVisibility.port && form.port ? Number(form.port) : null,
        locationName: form.locationName.trim() || null,
        departmentId: form.departmentId || null,
        deviceType: form.deviceType,
        connectionType: form.connectionType,
        vendor: form.vendor.trim() || 'ZKTECO',
        protocol: fieldVisibility.protocol ? form.protocol.trim() || 'TCP_IP' : 'TCP_IP',
        integrationMode: form.integrationMode,
        preferredMode: form.preferredMode,
        pushEnabled: fieldVisibility.pushEnabled ? form.pushEnabled : false,
        pullEnabled: fieldVisibility.pullEnabled ? form.pullEnabled : false,
        pushSecret: fieldVisibility.pushSecret ? form.pushSecret.trim() || null : null,
        communicationKey: fieldVisibility.communicationKey ? form.communicationKey.trim() || null : null,
        serialNumber: form.serialNumber.trim() || null,
        model: form.model.trim() || null,
        manufacturer: form.manufacturer.trim() || null,
        syncIntervalMinutes: fieldVisibility.syncIntervalMinutes && form.syncIntervalMinutes ? Number(form.syncIntervalMinutes) : 5,
        autoSyncEnabled: fieldVisibility.autoSyncEnabled ? form.autoSyncEnabled : false,
        healthStatus: editingDevice?.healthStatus ?? form.healthStatus,
        fallbackToPull: fieldVisibility.fallbackToPull ? form.fallbackToPull : false,
        isActive: form.isActive,
      };

      const response = editingDevice
        ? await updateDevice.mutateAsync({ biometricDeviceId: editingDevice.id, ...payload })
        : await createDevice.mutateAsync(payload);

      setSelectedDeviceId(response.biometricDevice.id);
      setDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: editingDevice ? t('biometricDeviceUpdated') : t('biometricDeviceCreated'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  const runSync = async (device: BiometricDevice) => {
    try {
      await syncDevice.mutateAsync({
        biometricDeviceId: device.id,
        syncStatus: 'COMPLETED',
        syncCompletedAt: new Date().toISOString(),
      });
      setSelectedDeviceId(device.id);
      notifications.show({
        title: common('success'),
        message: t('biometricDeviceSynced'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  const runConnectionTest = async (device: BiometricDevice) => {
    setTestingDeviceId(device.id);

    try {
      const response = await testDeviceConnection.mutateAsync(device.id);
      setSelectedDeviceId(device.id);

      notifications.show({
        title: response.connectionTest.success ? t('connectionTestSucceeded') : t('connectionTestFailed'),
        message: response.connectionTest.success
          ? t('connectionTestSucceededMessage', { latencyMs: response.connectionTest.latencyMs })
          : response.connectionTest.message,
        color: response.connectionTest.success ? 'green' : 'red',
      });
    } catch (error) {
      notifications.show({
        title: t('connectionTestFailed'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    } finally {
      setTestingDeviceId('');
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{t('biometricDevices')}</p>
              <p className="text-2xl font-semibold">{devices.length}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{t('active')}</p>
              <p className="text-2xl font-semibold">{activeCount}</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">{t('inactive')}</p>
              <p className="text-2xl font-semibold">{devices.length - activeCount}</p>
            </div>
          </div>
          <Button onClick={openCreateDevice}>
            <Plus className="size-4" />
            {t('addBiometricDevice')}
          </Button>
        </div>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{t('deviceInventory')}</CardTitle>
            <CardDescription>{t('deviceInventoryDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{common('loading')}</p>
            ) : devices.length === 0 ? (
              <EmptyState
                icon={Fingerprint}
                title={t('noBiometricDevices')}
                description={t('noBiometricDevicesDescription')}
              />
            ) : (
              devices.map((device) => {
                const isSelected = selectedDevice?.id === device.id;
                return (
                  <div
                    key={device.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedDeviceId(device.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedDeviceId(device.id);
                      }
                    }}
                    data-active={isSelected}
                    className="flex w-full cursor-pointer flex-col gap-3 rounded-md border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[active=true]:border-primary data-[active=true]:bg-primary/5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{device.deviceName}</p>
                        <Badge variant={device.isActive ? 'default' : 'secondary'}>
                          {device.isActive ? t('active') : t('inactive')}
                        </Badge>
                        <Badge variant={device.healthStatus === 'ERROR' ? 'destructive' : 'outline'}>
                          {device.healthStatus}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {device.deviceCode} · {device.deviceType} · {device.integrationMode}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[device.ipAddress, device.port, device.locationName, device.department?.nameEn].filter(Boolean).join(' · ') || t('noDescription')}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={testingDeviceId === device.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          runConnectionTest(device);
                        }}
                      >
                        <PlugZap className="size-4" />
                        {testingDeviceId === device.id ? t('testingConnection') : t('testConnection')}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={(event) => { event.stopPropagation(); runSync(device); }}>
                        <RefreshCw className="size-4" />
                        {t('sync')}
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); openEditDevice(device); }}>
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit rounded-lg">
        <CardHeader>
          <CardTitle>{t('syncHistory')}</CardTitle>
          <CardDescription>
            {selectedDevice ? selectedDevice.deviceName : t('selectDeviceForHistory')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!selectedDevice ? (
            <EmptyState icon={Router} title={t('noBiometricDevices')} description={t('selectDeviceForHistory')} />
          ) : syncHistory.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : (syncHistory.data?.attendanceSyncBatches ?? []).length === 0 ? (
            <EmptyState icon={RefreshCw} title={t('noSyncHistory')} description={t('noSyncHistoryDescription')} />
          ) : (
            syncHistory.data?.attendanceSyncBatches.map((batch) => (
              <div key={batch.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={statusVariant(batch.syncStatus) as any}>{batch.syncStatus}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTime(batch.syncStartedAt)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                  <Info label={t('totalRecords')} value={batch.totalRecords} />
                  <Info label={t('successfulRecords')} value={batch.successfulRecords} />
                  <Info label={t('failedRecords')} value={batch.failedRecords} />
                </div>
                {batch.errorMessage ? (
                  <p className="mt-2 text-xs text-destructive">{batch.errorMessage}</p>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader>
            <div className="px-6 pt-6">
              <DialogTitle>{editingDevice ? t('editBiometricDevice') : t('addBiometricDevice')}</DialogTitle>
              <DialogDescription>{t('biometricDeviceFormDescription')}</DialogDescription>
            </div>
          </DialogHeader>
          <form className="flex min-h-0 flex-1 flex-col" onSubmit={saveDevice}>
            <Tabs defaultValue="basic" className="min-h-0 flex-1 gap-0">
              <div className="border-b border-border px-6 pt-4">
                <TabsList className="grid w-full grid-cols-2 sm:w-[420px]">
                  <TabsTrigger value="basic">{t('basicInfo')}</TabsTrigger>
                  <TabsTrigger value="integration">{t('integrationAndSync')}</TabsTrigger>
                </TabsList>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <TabsContent value="basic" className="m-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('deviceName')} id="device-name">
                      <Input id="device-name" value={form.deviceName} onChange={(event) => setForm((current) => ({ ...current, deviceName: event.target.value }))} required />
                    </Field>
                    <Field label={t('deviceCode')} id="device-code">
                      <Input id="device-code" value={form.deviceCode} onChange={(event) => setForm((current) => ({ ...current, deviceCode: event.target.value }))} required />
                    </Field>
                    <Field label={t('deviceType')} id="device-type">
                      <Select value={form.deviceType} onValueChange={(value) => setForm((current) => ({ ...current, deviceType: value as BiometricDeviceType }))}>
                        <SelectTrigger id="device-type"><SelectValue /></SelectTrigger>
                        <SelectContent>{deviceTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('connectionType')} id="connection-type">
                      <Select value={form.connectionType} onValueChange={(value) => setForm((current) => ({ ...current, connectionType: value as ConnectionType }))}>
                        <SelectTrigger id="connection-type"><SelectValue /></SelectTrigger>
                        <SelectContent>{connectionTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('department')} id="device-department">
                      <Select value={form.departmentId || noneValue} onValueChange={(value) => setForm((current) => ({ ...current, departmentId: value === noneValue ? '' : value }))}>
                        <SelectTrigger id="device-department"><SelectValue placeholder={t('selectDepartment')} /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={noneValue}>{t('noDescription')}</SelectItem>
                          {departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.nameEn}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('locationName')} id="device-location">
                      <Input id="device-location" value={form.locationName} onChange={(event) => setForm((current) => ({ ...current, locationName: event.target.value }))} />
                    </Field>
                    <Field label={t('serialNumber')} id="device-serial">
                      <Input id="device-serial" value={form.serialNumber} onChange={(event) => setForm((current) => ({ ...current, serialNumber: event.target.value }))} />
                    </Field>
                    <Field label={t('model')} id="device-model">
                      <Input id="device-model" value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))} />
                    </Field>
                    <Field label={t('manufacturer')} id="device-manufacturer">
                      <Input id="device-manufacturer" value={form.manufacturer} onChange={(event) => setForm((current) => ({ ...current, manufacturer: event.target.value }))} />
                    </Field>
                    <ToggleRow label={t('active')} checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
                  </div>
                </TabsContent>
                <TabsContent value="integration" className="m-0">
                  <div className="mb-4 rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-sm font-medium">{t('integrationAndSync')}</p>
                    <p className="text-xs text-muted-foreground">{t('integrationAndSyncDescription')}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('vendor')} id="device-vendor">
                      <Input id="device-vendor" value={form.vendor} onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))} />
                    </Field>
                    <Field label={t('integrationMode')} id="integration-mode">
                      <Select value={form.integrationMode} onValueChange={(value) => {
                        const integrationMode = value as DeviceIntegrationMode;
                        setForm((current) => ({
                          ...current,
                          integrationMode,
                          ...getModeDefaults(integrationMode),
                        }));
                      }}>
                        <SelectTrigger id="integration-mode"><SelectValue /></SelectTrigger>
                        <SelectContent>{integrationModes.map((mode) => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                    {visibleFields.ipAddress ? (
                      <Field label={t('ipAddress')} id="device-ip">
                        <Input id="device-ip" value={form.ipAddress} onChange={(event) => setForm((current) => ({ ...current, ipAddress: event.target.value }))} />
                      </Field>
                    ) : null}
                    {visibleFields.port ? (
                      <Field label={t('port')} id="device-port">
                        <Input id="device-port" type="number" min={1} value={form.port} onChange={(event) => setForm((current) => ({ ...current, port: event.target.value }))} />
                      </Field>
                    ) : null}
                    {visibleFields.protocol ? (
                      <Field label={t('protocol')} id="device-protocol">
                        <Input id="device-protocol" value={form.protocol} onChange={(event) => setForm((current) => ({ ...current, protocol: event.target.value }))} />
                      </Field>
                    ) : null}
                    {visibleFields.communicationKey ? (
                      <Field label={t('communicationKey')} id="communication-key">
                        <Input id="communication-key" value={form.communicationKey} onChange={(event) => setForm((current) => ({ ...current, communicationKey: event.target.value }))} />
                      </Field>
                    ) : null}
                    {visibleFields.pushSecret ? (
                      <Field label={t('pushSecret')} id="push-secret">
                        <Input id="push-secret" value={form.pushSecret} onChange={(event) => setForm((current) => ({ ...current, pushSecret: event.target.value }))} />
                      </Field>
                    ) : null}
                    {visibleFields.syncIntervalMinutes ? (
                      <Field label={t('syncIntervalMinutes')} id="sync-interval">
                        <Input id="sync-interval" type="number" min={1} value={form.syncIntervalMinutes} onChange={(event) => setForm((current) => ({ ...current, syncIntervalMinutes: event.target.value }))} />
                      </Field>
                    ) : null}
                    {visibleFields.pushEnabled ? (
                      <ToggleRow label={t('pushEnabled')} checked={form.pushEnabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, pushEnabled: checked }))} />
                    ) : null}
                    {visibleFields.pullEnabled ? (
                      <ToggleRow label={t('pullEnabled')} checked={form.pullEnabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, pullEnabled: checked }))} />
                    ) : null}
                    {visibleFields.autoSyncEnabled ? (
                      <ToggleRow label={t('autoSyncEnabled')} checked={form.autoSyncEnabled} onCheckedChange={(checked) => setForm((current) => ({ ...current, autoSyncEnabled: checked }))} />
                    ) : null}
                    {visibleFields.fallbackToPull ? (
                      <ToggleRow label={t('fallbackToPull')} checked={form.fallbackToPull} onCheckedChange={(checked) => setForm((current) => ({ ...current, fallbackToPull: checked }))} />
                    ) : null}
                    {visibleFields.lastPushAt ? (
                      <ReadOnlyField label={t('lastPushAt')} value={formatDateTime(editingDevice?.lastPushAt ?? null)} />
                    ) : null}
                    {visibleFields.lastPullAt ? (
                      <ReadOnlyField label={t('lastPullAt')} value={formatDateTime(editingDevice?.lastPullAt ?? null)} />
                    ) : null}
                    {visibleFields.lastSeenAt ? (
                      <ReadOnlyField label={t('lastSeenAt')} value={formatDateTime(editingDevice?.lastSeenAt ?? null)} />
                    ) : null}
                    <ReadOnlyField label={t('healthStatus')} value={editingDevice?.healthStatus ?? form.healthStatus} />
                    <ReadOnlyField label={t('lastErrorMessage')} value={editingDevice?.lastErrorMessage ?? null} />
                  </div>
                </TabsContent>
              </div>
            </Tabs>
            <DialogFooter className="border-t border-border bg-background px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={createDevice.isPending || updateDevice.isPending || !form.deviceName.trim() || !form.deviceCode.trim()}>
                {createDevice.isPending || updateDevice.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? '-'}</p>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="min-h-10 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {value || '-'}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
