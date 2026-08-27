'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { Clock, ShieldCheck, UserRoundCog } from 'lucide-react';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCreateSupervisorDelegation,
  useEmployees,
  useRevokeSupervisorDelegation,
  useSupervisorDelegations,
} from '@/data/hooks/core.hooks';
import type { Employee, SupervisorDelegation } from '@/data/types/core.types';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';

type DelegationFormState = {
  delegateEmployeeId: string;
  startsAt: string;
  endsAt: string;
};

const initialForm = (): DelegationFormState => {
  const now = new Date();
  const start = new Date(now.getTime() + 5 * 60 * 1000);
  const end = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  return {
    delegateEmployeeId: '',
    startsAt: toDateTimeLocal(start),
    endsAt: toDateTimeLocal(end),
  };
};

export function SupervisorDelegationsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const session = useSession();
  const employees = useEmployees();
  const delegations = useSupervisorDelegations();
  const createDelegation = useCreateSupervisorDelegation();
  const revokeDelegation = useRevokeSupervisorDelegation();
  const [form, setForm] = useState<DelegationFormState>(() => initialForm());
  const [createOpen, setCreateOpen] = useState(false);

  const supervisorDelegations = delegations.data?.supervisorDelegations ?? [];
  const currentUserId = session.data?.user?.id as string | undefined;
  const delegateOptions = useMemo(() => {
    return (employees.data?.employees ?? [])
      .filter((employee) => employee.isActive && employee.userId && employee.userId !== currentUserId)
      .sort((a, b) => employeeName(a).localeCompare(employeeName(b)));
  }, [employees.data?.employees, currentUserId]);
  const activeDelegation = supervisorDelegations.find(isCurrentOrFutureDelegation);
  const now = Date.now();

  const submitDelegation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.delegateEmployeeId) {
      notifications.show({ title: common('error'), message: 'Please select a delegate.', color: 'red' });
      return;
    }

    try {
      await createDelegation.mutateAsync({
        delegateEmployeeId: form.delegateEmployeeId,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      });
      await session.refetch();
      setForm(initialForm());
      setCreateOpen(false);
      notifications.show({ title: common('success'), message: 'Supervisor delegation saved.', color: 'green' });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : 'Failed to save supervisor delegation.',
        color: 'red',
      });
    }
  };

  const revoke = async (delegationId: string) => {
    try {
      await revokeDelegation.mutateAsync(delegationId);
      await session.refetch();
      notifications.show({ title: common('success'), message: 'Supervisor delegation revoked.', color: 'green' });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : 'Failed to revoke supervisor delegation.',
        color: 'red',
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <UserRoundCog className="h-5 w-5 text-primary" />
                <CardTitle>{t('supervisorDelegation')}</CardTitle>
              </div>
              <CardDescription>{t('supervisorDelegationDescription')}</CardDescription>
            </div>
            <Button type="button" onClick={() => setCreateOpen(true)}>
              Delegate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeDelegation ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    <p className="font-medium">Current delegation</p>
                    <Badge variant={new Date(activeDelegation.startsAt).getTime() > now ? 'secondary' : 'default'}>
                      {new Date(activeDelegation.startsAt).getTime() > now ? 'Scheduled' : 'Active'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {employeeName(activeDelegation.delegateEmployee)} can act for you from{' '}
                    {formatDateTime(activeDelegation.startsAt)} until {formatDateTime(activeDelegation.endsAt)}.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => revoke(activeDelegation.id)}
                  disabled={revokeDelegation.isPending}
                >
                  Revoke now
                </Button>
              </div>
            </div>
          ) : (
            <EmptyState
              icon={Clock}
              title="No active delegation"
              description="Create a time-bound delegation when another employee should act on supervisor workflows for you."
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delegation history</CardTitle>
          <CardDescription>Past, revoked, active, and scheduled delegations are kept for audit review.</CardDescription>
        </CardHeader>
        <CardContent>
          {supervisorDelegations.length === 0 ? (
            <EmptyState
              icon={UserRoundCog}
              title="No delegation history"
              description="Delegations you create or receive will appear here."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Delegate</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supervisorDelegations.map((delegation) => {
                    const canRevoke = delegation.supervisorUserId === currentUserId && isCurrentOrFutureDelegation(delegation);
                    return (
                      <TableRow key={delegation.id}>
                        <TableCell>{employeeName(delegation.supervisorEmployee)}</TableCell>
                        <TableCell>{employeeName(delegation.delegateEmployee)}</TableCell>
                        <TableCell>
                          {formatDateTime(delegation.startsAt)} — {formatDateTime(delegation.endsAt)}
                        </TableCell>
                        <TableCell>
                          <DelegationStatusBadge delegation={delegation} />
                        </TableCell>
                        <TableCell className="text-right">
                          {canRevoke ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => revoke(delegation.id)}
                              disabled={revokeDelegation.isPending}
                            >
                              Revoke
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={(open) => {
        setCreateOpen(open);
        if (!open) setForm(initialForm());
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create delegation</DialogTitle>
            <DialogDescription>
              Creating a new current or future delegation automatically revokes your previous current/future delegation.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitDelegation}>
            <div className="space-y-2">
              <Label>Delegate employee</Label>
              <Select
                value={form.delegateEmployeeId}
                onValueChange={(value) => setForm((current) => ({ ...current, delegateEmployeeId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an active employee with a user account" />
                </SelectTrigger>
                <SelectContent>
                  {delegateOptions.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employeeName(employee)} · {employee.employeeCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Starts at</Label>
                <Input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Ends at</Label>
                <Input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={createDelegation.isPending}>
                {createDelegation.isPending ? common('loading') : 'Save delegation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DelegationStatusBadge({ delegation }: { delegation: SupervisorDelegation }) {
  const currentTime = Date.now();
  if (delegation.revokedAt) return <Badge variant="destructive">Revoked</Badge>;
  if (new Date(delegation.endsAt).getTime() <= currentTime) return <Badge variant="secondary">Expired</Badge>;
  if (new Date(delegation.startsAt).getTime() > currentTime) return <Badge variant="outline">Scheduled</Badge>;
  return <Badge>Active</Badge>;
}

function isCurrentOrFutureDelegation(delegation: SupervisorDelegation) {
  return !delegation.revokedAt && new Date(delegation.endsAt).getTime() > Date.now();
}

function employeeName(employee?: Employee | null) {
  if (!employee) return '—';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function toDateTimeLocal(value: Date) {
  const offsetMs = value.getTimezoneOffset() * 60 * 1000;
  return new Date(value.getTime() - offsetMs).toISOString().slice(0, 16);
}
