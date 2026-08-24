'use client';

import { FormEvent, useMemo, useState } from 'react';
import { CalendarCheck, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
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
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateLeaveRequest,
  useDashboardSummary,
  useLeaveBalances,
  useLeaveFiscalYears,
  useLeaveRequests,
  useLeaveTypes,
} from '@/data/hooks/core.hooks';
import type { Employee, LeaveRequest } from '@/data/types/core.types';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';

const noneValue = '__none';

type LeaveRequestsPageProps = {
  kind: 'annual' | 'other';
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function statusVariant(status: LeaveRequest['status']) {
  if (status === 'APPROVED') return 'default';
  if (status === 'REJECTED') return 'destructive';
  return 'secondary';
}

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

export function LeaveRequestsPage({ kind }: LeaveRequestsPageProps) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const session = useSession();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    leaveTypeId: '',
    fiscalYearId: '',
    startDate: today(),
    endDate: today(),
    reason: '',
  });

  const requestsQuery = useLeaveRequests(kind);
  const dashboardQuery = useDashboardSummary(session.data?.user?.id);
  const fiscalYearsQuery = useLeaveFiscalYears();
  const leaveTypesQuery = useLeaveTypes();
  const createRequest = useCreateLeaveRequest(kind);

  const fiscalYears = fiscalYearsQuery.data?.leaveFiscalYears ?? [];
  const leaveTypes = leaveTypesQuery.data?.leaveTypes ?? [];
  const currentEmployee = dashboardQuery.data?.dashboard.employee ?? null;
  const selectedYearBalancesQuery = useLeaveBalances(form.fiscalYearId, { enabled: Boolean(form.fiscalYearId && currentEmployee?.id) });
  const requests = requestsQuery.data?.leaveRequests ?? [];
  const activeFiscalYear = fiscalYears.find((fiscalYear) => fiscalYear.isActive);
  const annualType = leaveTypes.find((type) => type.code.toUpperCase() === 'ANNUAL');
  const selectableTypes = kind === 'annual'
    ? leaveTypes.filter((type) => type.code.toUpperCase() === 'ANNUAL')
    : leaveTypes.filter((type) => type.code.toUpperCase() !== 'ANNUAL');

  const selectedYearBalance = useMemo(() => {
    if (!currentEmployee?.id) return null;
    return (selectedYearBalancesQuery.data?.leaveBalances ?? []).find((balance) => balance.employeeId === currentEmployee.id) ?? null;
  }, [currentEmployee?.id, selectedYearBalancesQuery.data?.leaveBalances]);
  const selectedLeaveTypeId = kind === 'annual' ? annualType?.id ?? form.leaveTypeId : form.leaveTypeId;
  const selectedLeaveType = leaveTypes.find((type) => type.id === selectedLeaveTypeId);
  const requiresFiscalYearBalance = selectedLeaveType?.code.trim().toUpperCase() === 'ANNUAL';

  const openDialog = () => {
    setForm({
      leaveTypeId: kind === 'annual' ? annualType?.id ?? '' : selectableTypes[0]?.id ?? '',
      fiscalYearId: activeFiscalYear?.id ?? '',
      startDate: today(),
      endDate: today(),
      reason: '',
    });
    setDialogOpen(true);
  };

  const saveRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!currentEmployee?.id) {
      notifications.show({ title: common('error'), message: t('currentEmployeeRequired'), color: 'red' });
      return;
    }

    try {
      await createRequest.mutateAsync({
        employeeId: currentEmployee.id,
        leaveTypeId: kind === 'annual' ? annualType?.id ?? form.leaveTypeId : form.leaveTypeId,
        fiscalYearId: form.fiscalYearId || null,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim(),
        requestedBy: session.data?.user?.id ?? null,
      });

      setDialogOpen(false);
      notifications.show({ title: common('success'), message: t('leaveRequestCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const isLoading = session.isPending || (session.data?.user?.id ? dashboardQuery.isLoading : false);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="max-w-3xl text-sm text-muted-foreground">
            {t('leaveRequestSelfServiceDescription')}
          </p>
        </div>
        <Button onClick={openDialog} disabled={isLoading || !currentEmployee}>
          <Plus className="size-4" />
          {t('requestLeave')}
        </Button>
      </div>

      <Card className="rounded-lg">
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : !currentEmployee ? (
            <EmptyState
              icon={CalendarCheck}
              title={t('employeeProfileRequired')}
              description={t('currentEmployeeRequired')}
            />
          ) : requests.length === 0 ? (
            <EmptyState icon={CalendarCheck} title={t('noLeaveRequests')} description={t('noLeaveRequestsDescription')} />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('leaveType')}</TableHead>
                    <TableHead>{t('startDate')}</TableHead>
                    <TableHead>{t('endDate')}</TableHead>
                    <TableHead>{t('requestedDays')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{employeeName(request.employee) || t('unknown')}</p>
                          <p className="truncate text-xs text-muted-foreground">{request.employee?.employeeCode ?? '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{request.leaveType?.nameEn ?? '-'}</TableCell>
                      <TableCell>{formatDate(request.startDate)}</TableCell>
                      <TableCell>{formatDate(request.endDate)}</TableCell>
                      <TableCell>{request.requestedDays}</TableCell>
                      <TableCell><Badge variant={statusVariant(request.status) as any}>{request.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('requestLeave')}</DialogTitle>
            <DialogDescription>{t('leaveRequestFormDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveRequest}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('leaveType')} id="leave-type">
                <Select
                  value={(kind === 'annual' ? annualType?.id : form.leaveTypeId) || noneValue}
                  onValueChange={(value) => setForm((current) => ({ ...current, leaveTypeId: value === noneValue ? '' : value }))}
                  disabled={kind === 'annual'}
                >
                  <SelectTrigger id="leave-type"><SelectValue placeholder={t('selectLeaveType')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noneValue}>{t('selectLeaveType')}</SelectItem>
                    {selectableTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>{type.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('selectFiscalYear')} id="leave-fiscal-year">
                <Select value={form.fiscalYearId || noneValue} onValueChange={(value) => setForm((current) => ({ ...current, fiscalYearId: value === noneValue ? '' : value }))}>
                  <SelectTrigger id="leave-fiscal-year"><SelectValue placeholder={t('selectFiscalYear')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noneValue}>{t('selectFiscalYear')}</SelectItem>
                    {fiscalYears.map((fiscalYear) => (
                      <SelectItem key={fiscalYear.id} value={fiscalYear.id}>{fiscalYear.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {requiresFiscalYearBalance ? (
                  <BalancePreview
                    isLoading={selectedYearBalancesQuery.isLoading}
                    balance={selectedYearBalance}
                    emptyLabel={form.fiscalYearId ? t('leaveBalanceNotFound') : t('selectFiscalYearToViewBalance')}
                    loadingLabel={common('loading')}
                    openingLabel={t('openingBalance')}
                    usedLabel={t('usedBalance')}
                    availableLabel={t('availableBalance')}
                  />
                ) : null}
              </Field>
              <Field label={t('startDate')} id="leave-start">
                <Input id="leave-start" type="date" value={form.startDate} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} required />
              </Field>
              <Field label={t('endDate')} id="leave-end">
                <Input id="leave-end" type="date" value={form.endDate} onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))} required />
              </Field>
            </div>
            <Field label={t('reason')} id="leave-reason">
              <Textarea id="leave-reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button
                type="submit"
                disabled={
                  createRequest.isPending
                  || !currentEmployee?.id
                  || !selectedLeaveTypeId
                  || (requiresFiscalYearBalance && (!form.fiscalYearId || !selectedYearBalance))
                  || !form.startDate
                  || !form.endDate
                  || !form.reason.trim()
                }
              >
                {createRequest.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BalancePreview({
  isLoading,
  balance,
  emptyLabel,
  loadingLabel,
  openingLabel,
  usedLabel,
  availableLabel,
}: {
  isLoading: boolean;
  balance: { opening: string; used: string; available: string; fiscalYear?: { name?: string | null } | null } | null;
  emptyLabel: string;
  loadingLabel: string;
  openingLabel: string;
  usedLabel: string;
  availableLabel: string;
}) {
  if (isLoading) {
    return <p className="text-xs text-muted-foreground">{loadingLabel}</p>;
  }

  if (!balance) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-muted/30 p-2 text-xs">
      <BalanceMetric label={openingLabel} value={balance.opening} />
      <BalanceMetric label={usedLabel} value={balance.used} />
      <BalanceMetric label={availableLabel} value={balance.available} strong />
    </div>
  );
}

function BalanceMetric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className={strong ? 'font-semibold text-foreground' : 'font-medium text-foreground'}>{value}</p>
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
