'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Fingerprint, RefreshCw, Search, ServerCog } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useApplyBiometricProvisioningPreview,
  useBiometricProvisioningJobs,
  useCreateBiometricProvisioningPreview,
  useEmployees,
  useRetryBiometricProvisioningJob,
} from '@/data/hooks/core.hooks';
import type { BiometricDevice, BiometricProvisioningJob, BiometricProvisioningMode } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

type Props = { devices: BiometricDevice[] };

const modes: Array<{
  value: BiometricProvisioningMode;
  label: string;
  help: string;
}> = [
  {
    value: 'FULL_SYNC',
    label: 'Full synchronization',
    help: 'Compare every active enrolled employee. Extra target users are not removed.',
  },
  {
    value: 'EMPLOYEE_UPSERT',
    label: 'New employee or re-enrollment',
    help: 'Create or replace fingerprints for selected active employees.',
  },
  {
    value: 'EMPLOYEE_REMOVE',
    label: 'Employee departure',
    help: 'Remove only selected inactive employees after confirmation.',
  },
];

export function EmployeeSyncPanel({ devices }: Props) {
  const employeesQuery = useEmployees();
  const jobsQuery = useBiometricProvisioningJobs();
  const createPreview = useCreateBiometricProvisioningPreview();
  const applyPreview = useApplyBiometricProvisioningPreview();
  const retryJob = useRetryBiometricProvisioningJob();
  const [mode, setMode] = useState<BiometricProvisioningMode>('FULL_SYNC');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [selectedTargetIds, setSelectedTargetIds] = useState<string[]>([]);
  const [confirmJob, setConfirmJob] = useState<BiometricProvisioningJob | null>(null);

  const source = devices.find((device) => device.provisioningRole === 'ENROLLMENT_SOURCE' && device.isActive);
  const targets = devices.filter((device) => device.provisioningRole === 'TARGET' && device.isActive && device.provisioningEnabled);
  const effectiveTargetIds = selectedTargetIds.length ? selectedTargetIds : targets.map((target) => target.id);
  const employees = employeesQuery.data?.employees ?? [];
  const selectableEmployees = useMemo(() => {
    const term = employeeSearch.trim().toLowerCase();
    return employees
      .filter((employee) => {
        const eligible =
          mode === 'EMPLOYEE_REMOVE'
            ? !employee.isActive || employee.employmentStatus !== 'ACTIVE'
            : employee.isActive && employee.employmentStatus === 'ACTIVE';
        const haystack =
          `${employee.employeeCode} ${employee.firstNameEn} ${employee.middleNameEn ?? ''} ${employee.lastNameEn} ${employee.biometricId ?? ''}`.toLowerCase();
        return eligible && employee.biometricId && (!term || haystack.includes(term));
      })
      .slice(0, 100);
  }, [employeeSearch, employees, mode]);
  const jobs = jobsQuery.data?.biometricProvisioningJobs ?? [];

  const toggleEmployee = (employeeId: string) =>
    setSelectedEmployeeIds((current) => (current.includes(employeeId) ? current.filter((id) => id !== employeeId) : [...current, employeeId]));
  const toggleTarget = (deviceId: string) =>
    setSelectedTargetIds((current) => {
      const active = current.length ? current : targets.map((target) => target.id);
      return active.includes(deviceId) ? active.filter((id) => id !== deviceId) : [...active, deviceId];
    });

  const preview = async () => {
    try {
      await createPreview.mutateAsync({
        mode,
        employeeIds: mode === 'FULL_SYNC' ? undefined : selectedEmployeeIds,
        targetDeviceIds: effectiveTargetIds,
      });
      notifications.show({
        title: 'Preview queued',
        message: 'The worker will read the source and selected targets without writing.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Preview failed',
        message: error instanceof Error ? error.message : 'Unable to queue preview',
        color: 'red',
      });
    }
  };

  const apply = async () => {
    if (!confirmJob) return;
    try {
      await applyPreview.mutateAsync(confirmJob.id);
      setConfirmJob(null);
      notifications.show({
        title: 'Synchronization queued',
        message: 'TAMS will revalidate the devices before writing.',
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Apply failed',
        message: error instanceof Error ? error.message : 'Unable to apply preview',
        color: 'red',
      });
    }
  };

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ServerCog className="size-5" />
          Employee Sync
        </CardTitle>
        <CardDescription>Enroll once on the source G3 Pro, then preview and provision selected targets over the facility LAN.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 md:grid-cols-2">
          <DeviceSummary title="Enrollment source" device={source} source />
          <div className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">Registered targets</p>
              <Badge variant="outline">{targets.length}</Badge>
            </div>
            <div className="max-h-52 space-y-2 overflow-y-auto">
              {targets.map((target) => {
                const selected = effectiveTargetIds.includes(target.id);
                return (
                  <label key={target.id} className="flex cursor-pointer items-start gap-3 rounded border border-border p-2">
                    <Checkbox checked={selected} onCheckedChange={() => toggleTarget(target.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        {target.deviceName}
                        <HealthBadge status={target.healthStatus} />
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {target.ipAddress}:{target.port ?? 4370} · {target.firmwareVersion ?? 'firmware unknown'} ·{' '}
                        {target.lastProvisioningStatus ?? 'not provisioned'}
                      </span>
                    </span>
                  </label>
                );
              })}
              {!targets.length ? <p className="text-sm text-muted-foreground">No active provisioning targets are registered.</p> : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-md border border-border p-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Operation</Label>
            <Select
              value={mode}
              onValueChange={(value) => {
                setMode(value as BiometricProvisioningMode);
                setSelectedEmployeeIds([]);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {modes.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{modes.find((item) => item.value === mode)?.help}</p>
          </div>
          {mode !== 'FULL_SYNC' ? (
            <div className="space-y-2">
              <Label htmlFor="provisioning-employee-search">Employees ({selectedEmployeeIds.length} selected)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  id="provisioning-employee-search"
                  className="pl-9"
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder="Search name, employee code, or biometric ID"
                />
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded border border-border p-2">
                {selectableEmployees.map((employee) => (
                  <label key={employee.id} className="flex cursor-pointer items-center gap-2 rounded p-2 text-sm hover:bg-accent">
                    <Checkbox checked={selectedEmployeeIds.includes(employee.id)} onCheckedChange={() => toggleEmployee(employee.id)} />
                    <span>
                      {employee.firstNameEn} {employee.middleNameEn} {employee.lastNameEn}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{employee.biometricId}</span>
                  </label>
                ))}
                {!selectableEmployees.length ? <p className="p-2 text-sm text-muted-foreground">No eligible employees match the search.</p> : null}
              </div>
            </div>
          ) : (
            <div className="rounded bg-muted/40 p-3 text-sm text-muted-foreground">
              The preview includes active TAMS employees with biometric IDs. It never removes unmatched users.
            </div>
          )}
          <div className="md:col-span-2 flex justify-end">
            <Button
              disabled={
                !source?.provisioningEnabled || !effectiveTargetIds.length || (mode !== 'FULL_SYNC' && !selectedEmployeeIds.length) || createPreview.isPending
              }
              onClick={preview}
            >
              <Fingerprint className="size-4" />
              {createPreview.isPending ? 'Queueing…' : 'Preview synchronization'}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-medium">Provisioning history</p>
            <Button variant="ghost" size="sm" onClick={() => jobsQuery.refetch()}>
              <RefreshCw className="size-4" />
              Refresh
            </Button>
          </div>
          {jobs.slice(0, 10).map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onApply={() => setConfirmJob(job)}
              onRetry={async () => {
                try {
                  await retryJob.mutateAsync(job.id);
                } catch (error) {
                  notifications.show({
                    title: 'Retry failed',
                    message: error instanceof Error ? error.message : 'Unable to retry',
                    color: 'red',
                  });
                }
              }}
            />
          ))}
          {!jobs.length ? <p className="rounded border border-dashed border-border p-4 text-sm text-muted-foreground">No provisioning jobs yet.</p> : null}
        </div>
      </CardContent>

      <Dialog open={Boolean(confirmJob)} onOpenChange={(open) => !open && setConfirmJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm biometric provisioning</DialogTitle>
            <DialogDescription>This applies the completed preview after reading and validating every device again.</DialogDescription>
          </DialogHeader>
          {confirmJob?.mode === 'EMPLOYEE_REMOVE' ? (
            <div className="flex gap-3 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <AlertTriangle className="size-5 shrink-0 text-destructive" />
              <p>This removes only the confirmed employee records from the enrollment source and selected targets. Historical attendance remains unchanged.</p>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmJob(null)}>
              Cancel
            </Button>
            <Button variant={confirmJob?.mode === 'EMPLOYEE_REMOVE' ? 'destructive' : 'default'} onClick={apply} disabled={applyPreview.isPending}>
              Confirm and apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function DeviceSummary({ title, device, source }: { title: string; device?: BiometricDevice; source?: boolean }) {
  return (
    <div className="rounded-md border border-border p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-medium">{title}</p>
        {source ? <Badge>Source</Badge> : null}
      </div>
      {device ? (
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {device.deviceName}
            <HealthBadge status={device.healthStatus} />
          </p>
          <p className="text-xs text-muted-foreground">
            {device.ipAddress}:{device.port ?? 4370} · {device.serialNumber ?? 'serial unknown'}
          </p>
          <p className="text-xs text-muted-foreground">
            {device.model ?? 'G3 Pro'} · {device.firmwareVersion ?? 'firmware unknown'} · key{' '}
            {device.communicationKeyConfigured ? 'configured' : 'not configured'}
          </p>
        </div>
      ) : (
        <p className="text-sm text-destructive">Configure exactly one active enrollment source.</p>
      )}
    </div>
  );
}

function HealthBadge({ status }: { status: string }) {
  return <Badge variant={status === 'ERROR' || status === 'OFFLINE' ? 'destructive' : status === 'ONLINE' ? 'default' : 'secondary'}>{status}</Badge>;
}

function JobRow({ job, onApply, onRetry }: { job: BiometricProvisioningJob; onApply: () => void; onRetry: () => void }) {
  const results = job.deviceResults ?? [];
  const conflicts = results.reduce((total, result) => total + result.uidConflicts, 0);
  const missing = results.reduce((total, result) => total + result.missingTemplates, 0);
  const failed = results.filter((result) => result.status === 'FAILED').length;
  const canApply = job.isPreview && ['PREVIEW_READY', 'WAITING_CONFIRMATION'].includes(job.status) && conflicts === 0 && missing === 0;
  const canRetry = !job.isPreview && ['PARTIAL', 'FAILED'].includes(job.status) && failed > 0;
  return (
    <div className="rounded-md border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={job.status === 'FAILED' ? 'destructive' : job.status === 'COMPLETED' || job.status === 'PREVIEW_READY' ? 'default' : 'secondary'}>
          {job.status}
        </Badge>
        <span className="text-sm font-medium">{job.mode.replace(/_/g, ' ')}</span>
        <span className="text-xs text-muted-foreground">
          {job.isPreview ? 'Preview' : 'Apply'} · {new Date(job.createdAt).toLocaleString()}
        </span>
        <div className="ml-auto flex gap-2">
          {canApply ? (
            <Button size="sm" onClick={onApply}>
              <CheckCircle2 className="size-4" />
              Apply
            </Button>
          ) : null}
          {canRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry {failed} failed
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-5">
        <span>{results.length} devices</span>
        <span>{results.reduce((n, r) => n + r.addedUsers, 0)} missing</span>
        <span>{results.reduce((n, r) => n + r.updatedUsers, 0)} updates</span>
        <span className={conflicts ? 'text-destructive' : ''}>{conflicts} UID conflicts</span>
        <span className={missing ? 'text-destructive' : ''}>{missing} missing templates</span>
      </div>
      {results.some((result) => result.errorMessage) ? (
        <div className="mt-2 space-y-1">
          {results
            .filter((result) => result.errorMessage)
            .map((result) => (
              <p key={result.id} className="text-xs text-destructive">
                {result.device?.deviceName}: {result.errorMessage}
              </p>
            ))}
        </div>
      ) : null}
    </div>
  );
}
