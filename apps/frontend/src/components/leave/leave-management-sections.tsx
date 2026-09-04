'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarPlus, Edit, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { CalendarDateField } from '@/components/calendar/calendar-date-field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateLeaveFiscalYear,
  useCreateLeaveType,
  useEmployees,
  useLeaveBalances,
  useLeaveFiscalYears,
  useLeaveTypes,
  useSetActiveLeaveFiscalYear,
  useTransferLeaveBalance,
  useUpdateLeaveFiscalYear,
  useUpdateLeaveType,
  useUpsertLeaveBalance,
  useEmployeesPaginated,
} from '@/data/hooks/core.hooks';
import { useUsers } from '@/data/hooks/users.hooks';
import type { Employee, LeaveBalance, LeaveFiscalYear, LeaveType } from '@/data/types/core.types';
import type { User } from '@/data/types/api';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const noneValue = '__none';
const initialFiscalYearForm = {
  name: '',
  startsAt: '',
  endsAt: '',
  isActive: false,
};
const initialLeaveTypeForm = {
  code: '',
  nameEn: '',
  nameAm: '',
  description: '',
  deductsAnnualBalance: false,
  requiresBalance: false,
  allowedDays: '',
  isActive: true,
};
const initialBalanceForm = {
  employeeId: '',
  fiscalYearId: '',
  opening: '',
};
const initialTransferForm = {
  employeeId: '',
  fromFiscalYearId: '',
  toFiscalYearId: '',
  days: '',
  approvedBy: '',
  note: '',
};

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function userName(user?: User | null) {
  if (!user) return '';
  return user.name || user.email;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function FiscalYearsSection() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const fiscalYearsQuery = useLeaveFiscalYears();
  const createFiscalYear = useCreateLeaveFiscalYear();
  const updateFiscalYear = useUpdateLeaveFiscalYear();
  const setActiveFiscalYear = useSetActiveLeaveFiscalYear();
  const fiscalYears = fiscalYearsQuery.data?.leaveFiscalYears ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFiscalYear, setEditingFiscalYear] = useState<LeaveFiscalYear | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [fiscalYearForm, setFiscalYearForm] = useState(initialFiscalYearForm);

  const filteredFiscalYears = useMemo(() => {
    const query = normalize(search);
    return fiscalYears.filter((fiscalYear) => {
      const matchesSearch = !query || normalize(`${fiscalYear.name} ${fiscalYear.startsAt} ${fiscalYear.endsAt}`).includes(query);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && fiscalYear.isActive)
        || (statusFilter === 'inactive' && !fiscalYear.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [fiscalYears, search, statusFilter]);

  const openFiscalYearDialog = (fiscalYear?: LeaveFiscalYear) => {
    setEditingFiscalYear(fiscalYear ?? null);
    setFiscalYearForm(fiscalYear ? {
      name: fiscalYear.name,
      startsAt: fiscalYear.startsAt.slice(0, 10),
      endsAt: fiscalYear.endsAt.slice(0, 10),
      isActive: fiscalYear.isActive,
    } : initialFiscalYearForm);
    setDialogOpen(true);
  };

  const saveFiscalYear = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editingFiscalYear) {
        await updateFiscalYear.mutateAsync({ fiscalYearId: editingFiscalYear.id, ...fiscalYearForm });
        notifications.show({ title: common('success'), message: t('updated'), color: 'green' });
      } else {
        await createFiscalYear.mutateAsync(fiscalYearForm);
        notifications.show({ title: common('success'), message: t('created'), color: 'green' });
      }
      setDialogOpen(false);
      setFiscalYearForm(initialFiscalYearForm);
      setEditingFiscalYear(null);
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchFiscalYears')} className="w-full md:max-w-sm" />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
              <SelectItem value="active">{t('active')}</SelectItem>
              <SelectItem value="inactive">{t('inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openFiscalYearDialog()} className="w-full lg:w-auto">
          <Plus className="size-4" />
          {t('addFiscalYear')}
        </Button>
      </div>
      <Card className="rounded-lg">
        <CardContent>
          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('name')}</TableHead>
                  <TableHead>{t('startsAt')}</TableHead>
                  <TableHead>{t('endsAt')}</TableHead>
                  <TableHead className="text-right">{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFiscalYears.map((fiscalYear) => (
                  <TableRow key={fiscalYear.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{fiscalYear.name}</span>
                        {fiscalYear.isActive ? <Badge>{t('active')}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{formatDate(fiscalYear.startsAt)}</TableCell>
                    <TableCell>{formatDate(fiscalYear.endsAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" size="sm" variant="outline" onClick={() => openFiscalYearDialog(fiscalYear)}>
                          <Edit className="size-4" />
                          {common('edit')}
                        </Button>
                        <Button type="button" size="sm" variant="outline" disabled={fiscalYear.isActive || setActiveFiscalYear.isPending} onClick={() => setActiveFiscalYear.mutate(fiscalYear.id)}>
                          {t('setActive')}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFiscalYear ? t('editFiscalYear') : t('addFiscalYear')}</DialogTitle>
            <DialogDescription>{t('fiscalYearsDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveFiscalYear}>
            <Field label={t('fiscalYearName')} id="fy-name">
              <Input id="fy-name" value={fiscalYearForm.name} onChange={(event) => setFiscalYearForm((current) => ({ ...current, name: event.target.value }))} required />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('startsAt')} id="fy-start">
                <CalendarDateField id="fy-start" value={fiscalYearForm.startsAt} onChange={(startsAt) => setFiscalYearForm((current) => ({ ...current, startsAt }))} required />
              </Field>
              <Field label={t('endsAt')} id="fy-end">
                <CalendarDateField id="fy-end" value={fiscalYearForm.endsAt} onChange={(endsAt) => setFiscalYearForm((current) => ({ ...current, endsAt }))} required />
              </Field>
            </div>
            <div className="flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2">
              <Checkbox
                id="fy-active"
                checked={fiscalYearForm.isActive}
                onCheckedChange={(checked) => setFiscalYearForm((current) => ({ ...current, isActive: checked === true }))}
              />
              <Label htmlFor="fy-active" className="text-sm">{t('activeFiscalYear')}</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={createFiscalYear.isPending || updateFiscalYear.isPending}>
                {createFiscalYear.isPending || updateFiscalYear.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function LeaveTypesSection() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const leaveTypesQuery = useLeaveTypes();
  const createLeaveType = useCreateLeaveType();
  const updateLeaveType = useUpdateLeaveType();
  const leaveTypes = leaveTypesQuery.data?.leaveTypes ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [leaveTypeForm, setLeaveTypeForm] = useState(initialLeaveTypeForm);

  const filteredLeaveTypes = useMemo(() => {
    const query = normalize(search);
    return leaveTypes.filter((type) => {
      const matchesSearch = !query || normalize(`${type.code} ${type.nameEn} ${type.nameAm ?? ''}`).includes(query);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && type.isActive)
        || (statusFilter === 'inactive' && !type.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [leaveTypes, search, statusFilter]);

  const openLeaveTypeDialog = (leaveType?: LeaveType) => {
    setEditingLeaveType(leaveType ?? null);
    setLeaveTypeForm(leaveType ? {
      code: leaveType.code,
      nameEn: leaveType.nameEn,
      nameAm: leaveType.nameAm ?? '',
      description: leaveType.description ?? '',
      deductsAnnualBalance: leaveType.deductsAnnualBalance,
      requiresBalance: leaveType.requiresBalance,
      allowedDays: leaveType.allowedDays ?? '',
      isActive: leaveType.isActive,
    } : initialLeaveTypeForm);
    setDialogOpen(true);
  };

  const saveLeaveType = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const payload = {
        code: leaveTypeForm.code.trim().toUpperCase(),
        nameEn: leaveTypeForm.nameEn.trim(),
        nameAm: leaveTypeForm.nameAm.trim() || null,
        description: leaveTypeForm.description.trim() || null,
        deductsAnnualBalance: leaveTypeForm.deductsAnnualBalance,
        requiresBalance: leaveTypeForm.requiresBalance,
        allowedDays: leaveTypeForm.allowedDays.trim() || null,
        isActive: leaveTypeForm.isActive,
      };
      if (editingLeaveType) {
        await updateLeaveType.mutateAsync({ leaveTypeId: editingLeaveType.id, ...payload });
        notifications.show({ title: common('success'), message: t('updated'), color: 'green' });
      } else {
        await createLeaveType.mutateAsync(payload);
        notifications.show({ title: common('success'), message: t('created'), color: 'green' });
      }
      setDialogOpen(false);
      setEditingLeaveType(null);
      setLeaveTypeForm(initialLeaveTypeForm);
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchLeaveTypes')} className="w-full md:max-w-sm" />
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
              <SelectItem value="active">{t('active')}</SelectItem>
              <SelectItem value="inactive">{t('inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openLeaveTypeDialog()} className="w-full lg:w-auto">
          <Plus className="size-4" />
          {t('addLeaveType')}
        </Button>
      </div>
      <Card className="rounded-lg">
        <CardContent>
          <div className="overflow-hidden rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('code')}</TableHead>
                  <TableHead>{t('name')}</TableHead>
                    <TableHead>{t('allowedDays')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                {filteredLeaveTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell><Badge variant="secondary">{type.code}</Badge></TableCell>
                    <TableCell>{type.nameEn}</TableCell>
                    <TableCell>{type.allowedDays ?? '-'}</TableCell>
                    <TableCell>{type.isActive ? t('active') : t('inactive')}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => openLeaveTypeDialog(type)}>
                        <Edit className="size-4" />
                        {common('edit')}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLeaveType ? t('editLeaveType') : t('addLeaveType')}</DialogTitle>
            <DialogDescription>{t('leaveTypesDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveLeaveType}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('leaveTypeCode')} id="leave-type-code">
                <Input id="leave-type-code" value={leaveTypeForm.code} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, code: event.target.value }))} required />
              </Field>
              <Field label={t('nameEn')} id="leave-type-name">
                <Input id="leave-type-name" value={leaveTypeForm.nameEn} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, nameEn: event.target.value }))} required />
              </Field>
              <Field label={t('nameAm')} id="leave-type-name-am">
                <Input id="leave-type-name-am" value={leaveTypeForm.nameAm} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, nameAm: event.target.value }))} />
              </Field>
              <Field label={t('allowedDays')} id="leave-type-allowed-days">
                <Input
                  id="leave-type-allowed-days"
                  type="number"
                  min="0"
                  step="0.01"
                  value={leaveTypeForm.allowedDays}
                  onChange={(event) => setLeaveTypeForm((current) => ({ ...current, allowedDays: event.target.value }))}
                  placeholder={t('allowedDaysPlaceholder')}
                />
              </Field>
              <div className="grid gap-2">
                <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  <Checkbox
                    id="leave-type-active"
                    checked={leaveTypeForm.isActive}
                    onCheckedChange={(checked) => setLeaveTypeForm((current) => ({ ...current, isActive: checked === true }))}
                  />
                  <Label htmlFor="leave-type-active" className="text-sm">{t('active')}</Label>
                </div>
              </div>
            </div>
            <Field label={t('description')} id="leave-type-description">
              <Textarea id="leave-type-description" value={leaveTypeForm.description} onChange={(event) => setLeaveTypeForm((current) => ({ ...current, description: event.target.value }))} />
            </Field>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <Checkbox
                  id="deducts-annual"
                  checked={leaveTypeForm.deductsAnnualBalance}
                  onCheckedChange={(checked) => setLeaveTypeForm((current) => ({ ...current, deductsAnnualBalance: checked === true }))}
                />
                <Label htmlFor="deducts-annual" className="text-sm">{t('deductsAnnualBalance')}</Label>
              </div>
              <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                <Checkbox
                  id="requires-balance"
                  checked={leaveTypeForm.requiresBalance}
                  onCheckedChange={(checked) => setLeaveTypeForm((current) => ({ ...current, requiresBalance: checked === true }))}
                />
                <Label htmlFor="requires-balance" className="text-sm">{t('requiresBalance')}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={createLeaveType.isPending || updateLeaveType.isPending}>
                {createLeaveType.isPending || updateLeaveType.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function LeaveBalancesSection() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const fiscalYearsQuery = useLeaveFiscalYears();
  const saveBalance = useUpsertLeaveBalance();
  const fiscalYears = fiscalYearsQuery.data?.leaveFiscalYears ?? [];
  const activeFiscalYear = fiscalYears.find((fiscalYear) => fiscalYear.isActive);
  const [selectedFiscalYearId, setSelectedFiscalYearId] = useState('');
  const [balanceSearch, setBalanceSearch] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState<'all' | Employee['employmentType']>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);
  const [balanceForm, setBalanceForm] = useState(initialBalanceForm);
  const balancesQuery = useLeaveBalances(selectedFiscalYearId || undefined, { view: 'management' });
  const employeesQuery = useEmployeesPaginated(page, pageSize, balanceSearch);

  useEffect(() => {
    if (!selectedFiscalYearId && activeFiscalYear?.id) {
      setSelectedFiscalYearId(activeFiscalYear.id);
    }
  }, [activeFiscalYear?.id, selectedFiscalYearId]);

  useEffect(() => {
    setPage(1);
  }, [balanceSearch, pageSize, selectedFiscalYearId]);

  const leaveBalances = balancesQuery.data?.leaveBalances ?? [];
  const balanceByEmployee = useMemo(() => new Map(leaveBalances.map((balance) => [balance.employeeId, balance])), [leaveBalances]);
  const employeePageRows = employeesQuery.data?.employees ?? [];
  const employeePagination = employeesQuery.data?.pagination;
  const totalEmployees = employeePagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalEmployees / pageSize));
  const startIndex = totalEmployees === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalEmployees);

  const openBalanceDialog = (employee?: Employee, balance?: LeaveBalance | null) => {
    setEditingBalance(balance ?? null);
    setBalanceForm({
      employeeId: employee?.id ?? '',
      fiscalYearId: selectedFiscalYearId || (activeFiscalYear?.id ?? ''),
      opening: balance?.opening ?? '',
    });
    setDialogOpen(true);
  };

  const saveBalanceForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await saveBalance.mutateAsync({
        employeeId: balanceForm.employeeId,
        fiscalYearId: balanceForm.fiscalYearId,
        opening: balanceForm.opening,
      });
      setDialogOpen(false);
      setEditingBalance(null);
      setBalanceForm(initialBalanceForm);
      notifications.show({ title: common('success'), message: t('balanceCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select value={selectedFiscalYearId || noneValue} onValueChange={(value) => setSelectedFiscalYearId(value === noneValue ? '' : value)}>
            <SelectTrigger className="w-full md:w-64"><SelectValue placeholder={t('selectFiscalYear')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={noneValue}>{t('selectFiscalYear')}</SelectItem>
              {fiscalYears.map((fiscalYear) => (
                <SelectItem key={fiscalYear.id} value={fiscalYear.id}>{fiscalYear.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={balanceSearch} onChange={(event) => setBalanceSearch(event.target.value)} placeholder={t('searchEmployees')} className="w-full md:max-w-sm" />
          <Select value={employmentTypeFilter} onValueChange={(value) => setEmploymentTypeFilter(value as typeof employmentTypeFilter)}>
            <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allEmploymentTypes')}</SelectItem>
              <SelectItem value="PERMANENT">PERMANENT</SelectItem>
              <SelectItem value="CONTRACT">CONTRACT</SelectItem>
              <SelectItem value="TEMPORARY">TEMPORARY</SelectItem>
              <SelectItem value="DAILY">DAILY</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => openBalanceDialog()} className="w-full lg:w-auto">
          <Plus className="size-4" />
          {t('addLeaveBalance')}
        </Button>
      </div>
      <Card className="rounded-lg">
        <CardContent className="space-y-4">
          {!selectedFiscalYearId ? (
            <EmptyState icon={CalendarPlus} title={t('selectFiscalYear')} description={t('initialBalancesDescription')} />
          ) : employeesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : employeePageRows.filter((employee) => employmentTypeFilter === 'all' || employee.employmentType === employmentTypeFilter).length === 0 ? (
            <EmptyState icon={CalendarPlus} title={t('noEmployees')} description={t('noEmployeesDescription')} />
          ) : (
            <>
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('employee')}</TableHead>
                      <TableHead>{t('employmentType')}</TableHead>
                      <TableHead>{t('openingBalance')}</TableHead>
                      <TableHead>{t('transferredIn')}</TableHead>
                      <TableHead>{t('usedBalance')}</TableHead>
                      <TableHead>{t('reservedBalance')}</TableHead>
                      <TableHead>{t('availableBalance')}</TableHead>
                      <TableHead className="text-right">{t('actions')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeePageRows
                      .filter((employee) => employmentTypeFilter === 'all' || employee.employmentType === employmentTypeFilter)
                      .map((employee) => {
                      const balance = balanceByEmployee.get(employee.id);
                      return (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <div className="min-w-0">
                              <p className="truncate font-medium">{employeeName(employee)}</p>
                              <p className="truncate text-xs text-muted-foreground">{employee.employeeCode}</p>
                            </div>
                          </TableCell>
                          <TableCell>{employee.employmentType}</TableCell>
                          <TableCell>{balance?.opening ?? '-'}</TableCell>
                          <TableCell>{balance?.transferredIn ?? '0'}</TableCell>
                          <TableCell>{balance?.used ?? '0'}</TableCell>
                          <TableCell>{balance?.reserved ?? '0'}</TableCell>
                          <TableCell>{balance?.available ?? '-'}</TableCell>
                          <TableCell className="text-right">
                            <Button type="button" size="sm" variant="outline" onClick={() => openBalanceDialog(employee, balance)}>
                              <Edit className="size-4" />
                              {balance ? common('edit') : common('create')}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {totalEmployees === 0 ? t('noEmployees') : `Showing ${startIndex}-${endIndex} of ${totalEmployees}`}
                </p>
                <div className="flex items-center gap-2">
                  <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[25, 50, 100].map((size) => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                    {common('previous')}
                  </Button>
                  <span className="min-w-20 text-center text-sm text-muted-foreground">
                    {page} / {totalPages}
                  </span>
                  <Button type="button" variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                    {common('next')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBalance ? t('editLeaveBalance') : t('addLeaveBalance')}</DialogTitle>
            <DialogDescription>{t('initialBalancesDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveBalanceForm}>
            <Field label={t('employee')} id="balance-employee">
              <Select value={balanceForm.employeeId || noneValue} onValueChange={(value) => setBalanceForm((current) => ({ ...current, employeeId: value === noneValue ? '' : value }))}>
                <SelectTrigger id="balance-employee"><SelectValue placeholder={t('selectEmployee')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('selectEmployee')}</SelectItem>
                  {employeePageRows.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>{employeeName(employee)} · {employee.employeeCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('selectFiscalYear')} id="balance-fiscal-year">
              <Select value={balanceForm.fiscalYearId || noneValue} onValueChange={(value) => setBalanceForm((current) => ({ ...current, fiscalYearId: value === noneValue ? '' : value }))}>
                <SelectTrigger id="balance-fiscal-year"><SelectValue placeholder={t('selectFiscalYear')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('selectFiscalYear')}</SelectItem>
                  {fiscalYears.map((fiscalYear) => (
                    <SelectItem key={fiscalYear.id} value={fiscalYear.id}>{fiscalYear.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('openingBalance')} id="balance-opening">
              <Input id="balance-opening" type="number" min="0" step="0.5" value={balanceForm.opening} onChange={(event) => setBalanceForm((current) => ({ ...current, opening: event.target.value }))} required />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={saveBalance.isPending || !balanceForm.employeeId || !balanceForm.fiscalYearId || !balanceForm.opening}>
                {saveBalance.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function CarryForwardSection() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const fiscalYearsQuery = useLeaveFiscalYears();
  const employeesQuery = useEmployees();
  const usersQuery = useUsers({}, { pageSize: 100 });
  const transferBalance = useTransferLeaveBalance();
  const fiscalYears = fiscalYearsQuery.data?.leaveFiscalYears ?? [];
  const employees = employeesQuery.data?.employees ?? [];
  const users = usersQuery.data?.users ?? [];
  const activeFiscalYear = fiscalYears.find((fiscalYear) => fiscalYear.isActive);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sourceFiscalYearId, setSourceFiscalYearId] = useState('');
  const [transferForm, setTransferForm] = useState(initialTransferForm);
  const balancesQuery = useLeaveBalances(sourceFiscalYearId || undefined, { view: 'management' });
  const sourceBalances = balancesQuery.data?.leaveBalances ?? [];

  const filteredSourceBalances = useMemo(() => {
    const query = normalize(search);
    return sourceBalances.filter((balance) => {
      const employee = balance.employee;
      return !query || normalize(`${employeeName(employee)} ${employee?.employeeCode ?? ''} ${employee?.sourceDepartmentName ?? ''}`).includes(query);
    });
  }, [search, sourceBalances]);

  useEffect(() => {
    if (!transferForm.toFiscalYearId && activeFiscalYear?.id) {
      setTransferForm((current) => ({ ...current, toFiscalYearId: activeFiscalYear.id }));
    }
  }, [activeFiscalYear?.id, transferForm.toFiscalYearId]);

  const openTransferDialog = (balance?: LeaveBalance) => {
    setTransferForm({
      ...initialTransferForm,
      employeeId: balance?.employeeId ?? '',
      fromFiscalYearId: balance?.fiscalYearId ?? sourceFiscalYearId,
      toFiscalYearId: activeFiscalYear?.id ?? '',
    });
    setDialogOpen(true);
  };

  const saveTransfer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await transferBalance.mutateAsync({
        employeeId: transferForm.employeeId,
        fromFiscalYearId: transferForm.fromFiscalYearId,
        toFiscalYearId: transferForm.toFiscalYearId,
        days: transferForm.days,
        approvedBy: transferForm.approvedBy || null,
        note: transferForm.note.trim() || null,
      });
      setDialogOpen(false);
      setTransferForm({ ...initialTransferForm, toFiscalYearId: activeFiscalYear?.id ?? '' });
      notifications.show({ title: common('success'), message: t('balanceTransferred'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select value={sourceFiscalYearId || noneValue} onValueChange={(value) => setSourceFiscalYearId(value === noneValue ? '' : value)}>
            <SelectTrigger className="w-full md:w-64"><SelectValue placeholder={t('fromFiscalYear')} /></SelectTrigger>
            <SelectContent>
              <SelectItem value={noneValue}>{t('fromFiscalYear')}</SelectItem>
              {fiscalYears.map((fiscalYear) => (
                <SelectItem key={fiscalYear.id} value={fiscalYear.id}>{fiscalYear.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchEmployees')} className="w-full md:max-w-sm" />
        </div>
        <Button onClick={() => openTransferDialog()} className="w-full lg:w-auto">
          <ArrowRightLeft className="size-4" />
          {t('transferBalance')}
        </Button>
      </div>
      <Card className="rounded-lg">
        <CardContent className="space-y-4">
          {!sourceFiscalYearId ? (
            <EmptyState icon={ArrowRightLeft} title={t('fromFiscalYear')} description={t('leaveTransferDescription')} />
          ) : filteredSourceBalances.length === 0 ? (
            <EmptyState icon={ArrowRightLeft} title={t('noLeaveBalances')} description={t('noLeaveBalancesDescription')} />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('fromFiscalYear')}</TableHead>
                    <TableHead>{t('openingBalance')}</TableHead>
                    <TableHead>{t('usedBalance')}</TableHead>
                    <TableHead>{t('reservedBalance')}</TableHead>
                    <TableHead>{t('availableBalance')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSourceBalances.map((balance) => (
                    <TableRow key={balance.id}>
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{employeeName(balance.employee)}</p>
                          <p className="truncate text-xs text-muted-foreground">{balance.employee?.employeeCode ?? '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>{balance.fiscalYear?.name ?? '-'}</TableCell>
                      <TableCell>{balance.opening}</TableCell>
                      <TableCell>{balance.used}</TableCell>
                      <TableCell>{balance.reserved}</TableCell>
                      <TableCell>{balance.available}</TableCell>
                      <TableCell className="text-right">
                        <Button type="button" size="sm" variant="outline" onClick={() => openTransferDialog(balance)}>
                          <ArrowRightLeft className="size-4" />
                          {t('transferBalance')}
                        </Button>
                      </TableCell>
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
            <DialogTitle>{t('transferBalance')}</DialogTitle>
            <DialogDescription>{t('leaveTransferDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveTransfer}>
            <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('employee')} id="transfer-employee">
              <Select value={transferForm.employeeId || noneValue} onValueChange={(value) => setTransferForm((current) => ({ ...current, employeeId: value === noneValue ? '' : value }))}>
                <SelectTrigger id="transfer-employee"><SelectValue placeholder={t('selectEmployee')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('selectEmployee')}</SelectItem>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>{employeeName(employee)} · {employee.employeeCode}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('fromFiscalYear')} id="transfer-from">
              <Select value={transferForm.fromFiscalYearId || noneValue} onValueChange={(value) => setTransferForm((current) => ({ ...current, fromFiscalYearId: value === noneValue ? '' : value }))}>
                <SelectTrigger id="transfer-from"><SelectValue placeholder={t('selectFiscalYear')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('selectFiscalYear')}</SelectItem>
                  {fiscalYears.map((fiscalYear) => (
                    <SelectItem key={fiscalYear.id} value={fiscalYear.id}>{fiscalYear.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('toFiscalYear')} id="transfer-to">
              <Select value={transferForm.toFiscalYearId || noneValue} onValueChange={(value) => setTransferForm((current) => ({ ...current, toFiscalYearId: value === noneValue ? '' : value }))}>
                <SelectTrigger id="transfer-to"><SelectValue placeholder={t('selectFiscalYear')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('selectFiscalYear')}</SelectItem>
                  {fiscalYears.map((fiscalYear) => (
                    <SelectItem key={fiscalYear.id} value={fiscalYear.id}>{fiscalYear.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('days')} id="transfer-days">
              <Input id="transfer-days" type="number" min="0.5" step="0.5" value={transferForm.days} onChange={(event) => setTransferForm((current) => ({ ...current, days: event.target.value }))} required />
            </Field>
            <Field label={t('selectReviewer')} id="transfer-approved-by">
              <Select value={transferForm.approvedBy || noneValue} onValueChange={(value) => setTransferForm((current) => ({ ...current, approvedBy: value === noneValue ? '' : value }))}>
                <SelectTrigger id="transfer-approved-by"><SelectValue placeholder={t('selectReviewer')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('selectReviewer')}</SelectItem>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{userName(user)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('note')} id="transfer-note">
              <Input id="transfer-note" value={transferForm.note} onChange={(event) => setTransferForm((current) => ({ ...current, note: event.target.value }))} />
            </Field>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={transferBalance.isPending || !transferForm.employeeId || !transferForm.fromFiscalYearId || !transferForm.toFiscalYearId || !transferForm.days}>
                {transferBalance.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
