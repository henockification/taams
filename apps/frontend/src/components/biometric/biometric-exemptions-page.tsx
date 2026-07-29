'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useBiometricExemptions,
  useCreateBiometricExemption,
  useDeleteBiometricExemption,
  useEmployees,
  usePositions,
  useUpdateBiometricExemption,
} from '@/data/hooks/core.hooks';
import type {
  BiometricExemption,
  BiometricExemptionTargetType,
  Employee,
} from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

type FormState = {
  targetType: BiometricExemptionTargetType;
  targetId: string;
  reason: string;
  isActive: boolean;
};

const initialForm: FormState = {
  targetType: 'EMPLOYEE',
  targetId: '',
  reason: '',
  isActive: true,
};

function fullName(employee: Pick<Employee, 'firstNameEn' | 'middleNameEn' | 'lastNameEn'>) {
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function targetLabel(targetType: BiometricExemptionTargetType) {
  return targetType === 'EMPLOYEE' ? 'employee' : 'position';
}

export default function BiometricExemptionsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { data: exemptionsResponse, isLoading } = useBiometricExemptions();
  const { data: employeesResponse } = useEmployees();
  const { data: positionsResponse } = usePositions();
  const createExemption = useCreateBiometricExemption();
  const updateExemption = useUpdateBiometricExemption();
  const deleteExemption = useDeleteBiometricExemption();

  const exemptions = exemptionsResponse?.biometricExemptions ?? [];
  const employees = employeesResponse?.employees ?? [];
  const positions = positionsResponse?.positions ?? [];
  const [search, setSearch] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState<'all' | BiometricExemptionTargetType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingExemption, setEditingExemption] = useState<BiometricExemption | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);

  const filteredEmployees = useMemo(() => employees.filter((employee) => {
    return true;
  }), [employees]);

  const filteredPositions = useMemo(() => positions.filter((position) => {
    return true;
  }), [positions]);

  const filteredExemptions = useMemo(() => {
    return exemptions.filter((exemption) => {
      const matchesTargetType = targetTypeFilter === 'all' || exemption.targetType === targetTypeFilter;
      const matchesStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? exemption.isActive
          : !exemption.isActive;
      const haystack = [
        exemption.reason,
        exemption.employee?.employeeCode,
        exemption.employee ? fullName(exemption.employee) : null,
        exemption.position?.nameEn,
        exemption.position?.code,
      ].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = search.trim() ? haystack.includes(search.trim().toLowerCase()) : true;

      return matchesTargetType && matchesStatus && matchesSearch;
    });
  }, [exemptions, search, statusFilter, targetTypeFilter]);

  const openCreateDialog = () => {
    setEditingExemption(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEditDialog = (exemption: BiometricExemption) => {
    setEditingExemption(exemption);
    setForm({
      targetType: exemption.targetType,
      targetId: exemption.targetType === 'EMPLOYEE' ? exemption.employeeId ?? '' : exemption.positionId ?? '',
      reason: exemption.reason,
      isActive: exemption.isActive,
    });
    setDialogOpen(true);
  };

  const saveExemption = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = {
        targetType: form.targetType,
        targetId: form.targetId,
        reason: form.reason.trim(),
        isActive: form.isActive,
      };

      if (editingExemption) {
        await updateExemption.mutateAsync({ biometricExemptionId: editingExemption.id, ...payload });
      } else {
        await createExemption.mutateAsync(payload);
      }

      setDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: editingExemption ? t('biometricExemptionUpdated') : t('biometricExemptionCreated'),
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

  const removeExemption = async (exemption: BiometricExemption) => {
    if (!window.confirm(t('confirmRemoveBiometricExemption'))) {
      return;
    }

    try {
      await deleteExemption.mutateAsync(exemption.id);
      notifications.show({
        title: common('success'),
        message: t('biometricExemptionRemoved'),
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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchBiometricExemptions')}
            className="w-full md:max-w-sm"
          />
          <Select value={targetTypeFilter} onValueChange={(value) => setTargetTypeFilter(value as 'all' | BiometricExemptionTargetType)}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder={t('targetType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('all')}</SelectItem>
              <SelectItem value="EMPLOYEE">{t('employee')}</SelectItem>
              <SelectItem value="POSITION">{t('position')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder={t('status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
              <SelectItem value="active">{t('active')}</SelectItem>
              <SelectItem value="inactive">{t('inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreateDialog} className="w-full lg:w-auto">
          <Plus className="size-4" />
          {t('addBiometricExemption')}
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{common('loading')}</p>
      ) : filteredExemptions.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={t('noBiometricExemptions')}
          description={t('noBiometricExemptionsDescription')}
          className="min-h-72"
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('target')}</TableHead>
                <TableHead>{t('reason')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('updatedAt')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExemptions.map((exemption) => {
                const targetTitle = exemption.targetType === 'EMPLOYEE'
                  ? fullName(exemption.employee ?? {
                      firstNameEn: '',
                      middleNameEn: null,
                      lastNameEn: '',
                    })
                  : exemption.position?.nameEn ?? '-';
                const targetSubtitle = exemption.targetType === 'EMPLOYEE'
                  ? exemption.employee?.employeeCode ?? exemption.employeeId ?? '-'
                  : exemption.position?.code ?? exemption.positionId ?? '-';
                return (
                  <TableRow key={exemption.id}>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{targetTitle}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {targetSubtitle}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[24rem]">
                      <p className="truncate">{exemption.reason}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={exemption.isActive ? 'default' : 'secondary'}>
                        {exemption.isActive ? t('active') : t('inactive')}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {new Date(exemption.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(exemption)}>
                          <Pencil className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => removeExemption(exemption)}>
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingExemption ? t('editBiometricExemption') : t('addBiometricExemption')}
            </DialogTitle>
            <DialogDescription>{t('biometricExemptionsDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={saveExemption}>
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('targetType')}</Label>
                <Select
                  value={form.targetType}
                  onValueChange={(value) => setForm((current) => ({
                    ...current,
                    targetType: value as BiometricExemptionTargetType,
                    targetId: '',
                  }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EMPLOYEE">{t('employee')}</SelectItem>
                    <SelectItem value="POSITION">{t('position')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t(targetLabel(form.targetType))}</Label>
                <TargetCombobox
                  targetType={form.targetType}
                  value={form.targetId}
                  onValueChange={(value) => setForm((current) => ({ ...current, targetId: value }))}
                  employees={filteredEmployees}
                  positions={filteredPositions}
                  placeholder={t('selectTarget')}
                  searchPlaceholder={t('searchTargets')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('reason')}</Label>
              <Textarea
                value={form.reason}
                onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                placeholder={t('biometricExemptionReasonPlaceholder')}
                required
                className="min-h-24"
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <div className="space-y-1">
                <Label>{t('active')}</Label>
                <p className="text-xs text-muted-foreground">{t('biometricExemptionActiveDescription')}</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={!form.targetId || !form.reason.trim() || createExemption.isPending || updateExemption.isPending}>
                {createExemption.isPending || updateExemption.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TargetCombobox({
  targetType,
  value,
  onValueChange,
  employees,
  positions,
  placeholder,
  searchPlaceholder,
}: {
  targetType: BiometricExemptionTargetType;
  value: string;
  onValueChange: (value: string) => void;
  employees: Employee[];
  positions: { id: string; nameEn: string; code: string | null }[];
  placeholder: string;
  searchPlaceholder: string;
}) {
  const [open, setOpen] = useState(false);

  const options = targetType === 'EMPLOYEE'
    ? employees.map((employee) => ({
        value: employee.id,
        label: fullName(employee),
        description: employee.employeeCode,
      }))
    : positions.map((position) => ({
        value: position.id,
        label: position.nameEn,
        description: position.code ?? undefined,
      }));

  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedOption
              ? `${selectedOption.label}${selectedOption.description ? ` · ${selectedOption.description}` : ''}`
              : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0"
        style={{ width: 'var(--radix-popover-trigger-width)' }}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{placeholder}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.description ?? ''}`}
                  onSelect={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check className={`size-4 ${value === option.value ? 'opacity-100' : 'opacity-0'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
