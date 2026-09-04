'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarClock, Check, ChevronsUpDown, Pencil, Plus, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useCreateTemporaryDepartmentAssignment,
  useDeactivateTemporaryDepartmentAssignment,
  useDepartments,
  useEmployees,
  useTemporaryDepartmentAssignments,
  useUpdateTemporaryDepartmentAssignment,
} from '@/data/hooks/core.hooks';
import type { Employee, TemporaryDepartmentAssignment } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type AssignmentFilter = 'active' | 'history' | 'all';

type FormState = {
  employeeId: string;
  targetDepartmentId: string;
  effectiveFrom: string;
  effectiveTo: string;
  reason: string;
};

const emptyForm = (): FormState => ({
  employeeId: '',
  targetDepartmentId: '',
  effectiveFrom: today(),
  effectiveTo: today(),
  reason: '',
});

export function TemporaryDepartmentAssignmentsPage() {
  const { formatDate } = useCalendarPreference();
  const t = useTranslations('core');
  const common = useTranslations('common');
  const assignmentsQuery = useTemporaryDepartmentAssignments();
  const employeesQuery = useEmployees();
  const departmentsQuery = useDepartments();
  const createAssignment = useCreateTemporaryDepartmentAssignment();
  const updateAssignment = useUpdateTemporaryDepartmentAssignment();
  const deactivateAssignment = useDeactivateTemporaryDepartmentAssignment();
  const [filter, setFilter] = useState<AssignmentFilter>('active');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TemporaryDepartmentAssignment | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());

  const employees = employeesQuery.data?.employees ?? [];
  const departments = departmentsQuery.data?.departments ?? [];
  const assignments = assignmentsQuery.data?.temporaryDepartmentAssignments ?? [];
  const filteredAssignments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const matchesStatus =
        filter === 'all' ||
        (filter === 'active' && isCurrentOrFutureAssignment(assignment)) ||
        (filter === 'history' && !isCurrentOrFutureAssignment(assignment));
      const haystack = [
        employeeName(assignment.employee),
        assignment.employee?.employeeCode,
        assignment.sourceDepartment?.nameEn,
        assignment.targetDepartment?.nameEn,
        assignment.reason,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch));
    });
  }, [assignments, filter, search]);

  function openCreateDialog() {
    setEditingAssignment(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEditDialog(assignment: TemporaryDepartmentAssignment) {
    setEditingAssignment(assignment);
    setForm({
      employeeId: assignment.employeeId,
      targetDepartmentId: assignment.targetDepartmentId,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo,
      reason: assignment.reason,
    });
    setDialogOpen(true);
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.employeeId || !form.targetDepartmentId || !form.effectiveFrom || !form.effectiveTo || !form.reason.trim()) {
      notifications.show({
        title: common('error'),
        message: t('temporaryAssignmentRequiredFields'),
        color: 'red',
      });
      return;
    }

    try {
      if (editingAssignment) {
        await updateAssignment.mutateAsync({
          temporaryDepartmentAssignmentId: editingAssignment.id,
          targetDepartmentId: form.targetDepartmentId,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo,
          reason: form.reason.trim(),
        });
      } else {
        await createAssignment.mutateAsync({
          employeeId: form.employeeId,
          targetDepartmentId: form.targetDepartmentId,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo,
          reason: form.reason.trim(),
        });
      }
      setDialogOpen(false);
      setEditingAssignment(null);
      setForm(emptyForm());
      notifications.show({
        title: common('success'),
        message: t('temporaryAssignmentSaved'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  }

  async function deactivate(id: string) {
    try {
      await deactivateAssignment.mutateAsync(id);
      notifications.show({
        title: common('success'),
        message: t('temporaryAssignmentDeactivated'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchTemporaryAssignments')}
            className="w-full md:max-w-xs"
          />
          <Select value={filter} onValueChange={(value) => setFilter(value as AssignmentFilter)}>
            <SelectTrigger className="w-full md:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">{t('active')}</SelectItem>
              <SelectItem value="history">{t('history')}</SelectItem>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="button" onClick={openCreateDialog} className="w-full lg:w-auto">
          <Plus className="size-4" />
          {t('addTemporaryAssignment')}
        </Button>
      </div>

      <Card className="rounded-lg">
        <CardContent>
          {assignmentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : filteredAssignments.length === 0 ? (
            <EmptyState icon={ArrowRightLeft} title={t('noTemporaryAssignments')} description={t('noTemporaryAssignmentsDescription')} />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table className="min-w-[72rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('homeDepartment')}</TableHead>
                    <TableHead>{t('temporaryDepartment')}</TableHead>
                    <TableHead>{t('period')}</TableHead>
                    <TableHead>{t('reason')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((assignment) => {
                    const currentOrFuture = isCurrentOrFutureAssignment(assignment);
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell className="min-w-56">
                          <p className="truncate font-medium">{employeeName(assignment.employee) || t('unknown')}</p>
                          <p className="truncate text-xs text-muted-foreground">{assignment.employee?.employeeCode ?? '-'}</p>
                        </TableCell>
                        <TableCell>{assignment.sourceDepartment?.nameEn ?? '-'}</TableCell>
                        <TableCell>{assignment.targetDepartment?.nameEn ?? '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(assignment.effectiveFrom)} - {formatDate(assignment.effectiveTo)}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">{assignment.reason}</TableCell>
                        <TableCell>
                          <Badge variant={assignment.isActive && currentOrFuture ? 'default' : 'secondary'}>
                            {assignment.isActive && currentOrFuture ? t('active') : t('inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {assignment.isActive ? (
                              <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(assignment)}>
                                <Pencil className="size-4" />
                                {common('edit')}
                              </Button>
                            ) : null}
                            {assignment.isActive && currentOrFuture ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() => deactivate(assignment.id)}
                                disabled={deactivateAssignment.isPending}
                              >
                                <XCircle className="size-4" />
                                {t('deactivate')}
                              </Button>
                            ) : null}
                          </div>
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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingAssignment(null);
            setForm(emptyForm());
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAssignment ? t('editTemporaryAssignment') : t('addTemporaryAssignment')}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitAssignment}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <Label htmlFor="temporary-assignment-employee">{t('employee')}</Label>
                <SearchableSelect
                  id="temporary-assignment-employee"
                  value={form.employeeId || undefined}
                  onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}
                  disabled={Boolean(editingAssignment)}
                  options={employees
                    .filter((employee) => employee.isActive)
                    .map((employee) => ({
                      value: employee.id,
                      label: employeeName(employee),
                      description: employee.employeeCode,
                    }))}
                  placeholder={t('selectEmployee')}
                  searchPlaceholder={t('searchEmployee')}
                  emptyMessage={t('noMatchingEmployees')}
                />
              </div>
              <div className="min-w-0 space-y-2">
                <Label htmlFor="temporary-assignment-department">{t('temporaryDepartment')}</Label>
                <SearchableSelect
                  id="temporary-assignment-department"
                  value={form.targetDepartmentId || undefined}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      targetDepartmentId: value,
                    }))
                  }
                  options={departments
                    .filter((department) => department.isActive)
                    .map((department) => ({
                      value: department.id,
                      label: department.nameEn,
                    }))}
                  placeholder={t('selectDepartment')}
                  searchPlaceholder={t('searchDepartment')}
                  emptyMessage={t('noMatchingDepartments')}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('startDate')}</Label>
                <Input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effectiveFrom: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>{t('endDate')}</Label>
                <Input
                  type="date"
                  value={form.effectiveTo}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      effectiveTo: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('reason')}</Label>
                <Textarea
                  value={form.reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      reason: event.target.value,
                    }))
                  }
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={createAssignment.isPending || updateAssignment.isPending}>
                <CalendarClock className="size-4" />
                {createAssignment.isPending || updateAssignment.isPending ? t('saving') : t('saveTemporaryAssignment')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type SearchableSelectOption = {
  value: string;
  label: string;
  description?: string | null;
};

function SearchableSelect({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  disabled,
}: {
  id: string;
  value?: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selectedOption = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
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
      <PopoverContent align="start" className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
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
                  <Check className={cn('size-4', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{option.label}</span>
                    {option.description ? <span className="block truncate text-xs text-muted-foreground">{option.description}</span> : null}
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

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentOrFutureAssignment(assignment: TemporaryDepartmentAssignment) {
  return assignment.isActive && assignment.effectiveTo >= today();
}
