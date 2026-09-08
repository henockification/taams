'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Plus, UserRoundCog } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CalendarDateField } from '@/components/calendar/calendar-date-field';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAllEmployeeSupervisors,
  useBulkCreateEmployeeSupervisors,
  useDepartments,
  useEmployees,
} from '@/data/hooks/core.hooks';
import type { Employee, EmployeeSupervisor, EmploymentStatus, EmploymentType } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { cn } from '@/lib/utils';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const allDepartmentsValue = '__all_departments';
const allStatusesValue = '__all_statuses';
const allEmploymentTypesValue = '__all_employment_types';
const pageSizes = [25, 50, 100];
const employmentStatuses: EmploymentStatus[] = ['ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED'];
const employmentTypes: EmploymentType[] = ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY'];

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

export function SupervisorAssignmentsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const { data: employeesResponse, isLoading: employeesLoading } = useEmployees();
  const { data: departmentsResponse } = useDepartments();
  const { data: supervisorsResponse, isLoading: supervisorsLoading } = useAllEmployeeSupervisors();
  const bulkAssign = useBulkCreateEmployeeSupervisors();

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(allDepartmentsValue);
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | typeof allStatusesValue>('ACTIVE');
  const [typeFilter, setTypeFilter] = useState<EmploymentType | typeof allEmploymentTypesValue>(allEmploymentTypesValue);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supervisorId, setSupervisorId] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [effectiveFrom, setEffectiveFrom] = useState(todayInput());
  const [effectiveTo, setEffectiveTo] = useState('');

  const employees = employeesResponse?.employees ?? [];
  const departments = departmentsResponse?.departments ?? [];
  const supervisorAssignments = supervisorsResponse?.supervisors ?? [];

  const currentPrimaryByEmployeeId = useMemo(() => {
    const today = todayInput();
    const byEmployee = new Map<string, EmployeeSupervisor>();

    for (const assignment of supervisorAssignments) {
      if (!assignment.isPrimary) continue;
      if (assignment.effectiveFrom > today) continue;
      if (assignment.effectiveTo && assignment.effectiveTo < today) continue;

      const current = byEmployee.get(assignment.employeeId);
      if (!current || assignment.effectiveFrom > current.effectiveFrom) {
        byEmployee.set(assignment.employeeId, assignment);
      }
    }

    return byEmployee;
  }, [supervisorAssignments]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return employees.filter((employee) => {
      if (statusFilter !== allStatusesValue && employee.employmentStatus !== statusFilter) return false;
      if (typeFilter !== allEmploymentTypesValue && employee.employmentType !== typeFilter) return false;
      if (departmentFilter !== allDepartmentsValue && employee.departmentId !== departmentFilter) return false;
      if (!query) return true;

      const haystack = [
        employee.firstNameEn,
        employee.middleNameEn,
        employee.lastNameEn,
        employee.employeeCode,
        employee.email,
        employee.phoneNumber,
        employee.department?.nameEn,
        employee.sourceDepartmentName,
        employee.position?.nameEn,
        employee.positionName,
        employee.sourcePositionName,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    }).sort((left, right) => employeeName(left).localeCompare(employeeName(right), undefined, { sensitivity: 'base' }));
  }, [departmentFilter, employees, search, statusFilter, typeFilter]);

  const filteredEmployeeIds = useMemo(() => filteredEmployees.map((employee) => employee.id), [filteredEmployees]);
  const selectedFilteredCount = filteredEmployeeIds.filter((id) => selectedEmployeeIds.has(id)).length;
  const allFilteredSelected = filteredEmployeeIds.length > 0 && selectedFilteredCount === filteredEmployeeIds.length;
  const totalRecords = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);
  const selectedEmployees = useMemo(
    () => employees
      .filter((employee) => selectedEmployeeIds.has(employee.id))
      .sort((left, right) => employeeName(left).localeCompare(employeeName(right), undefined, { sensitivity: 'base' })),
    [employees, selectedEmployeeIds],
  );
  const selectedEmployeeSet = useMemo(() => new Set(selectedEmployeeIds), [selectedEmployeeIds]);
  const supervisorOptions = useMemo(() => (
    employees
      .filter((employee) => employee.employmentStatus === 'ACTIVE' && !selectedEmployeeSet.has(employee.id))
      .sort((left, right) => employeeName(left).localeCompare(employeeName(right), undefined, { sensitivity: 'base' }))
  ), [employees, selectedEmployeeSet]);

  useEffect(() => {
    if (currentPage !== page) setPage(currentPage);
  }, [currentPage, page]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, pageSize, search, statusFilter, typeFilter]);

  const toggleEmployeeSelection = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (checked) next.add(employeeId);
      else next.delete(employeeId);
      return next;
    });
  };

  const toggleFilteredSelection = (checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      for (const employeeId of filteredEmployeeIds) {
        if (checked) next.add(employeeId);
        else next.delete(employeeId);
      }
      return next;
    });
  };

  const openAssignmentDialog = () => {
    if (selectedEmployeeIds.size === 0) return;
    setSupervisorId('');
    setIsPrimary(true);
    setEffectiveFrom(todayInput());
    setEffectiveTo('');
    setDialogOpen(true);
  };

  const saveAssignment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supervisorId || selectedEmployeeIds.size === 0) return;

    try {
      const result = await bulkAssign.mutateAsync({
        employeeIds: [...selectedEmployeeIds],
        supervisorId,
        isPrimary,
        effectiveFrom,
        effectiveTo: effectiveTo || null,
      });
      setDialogOpen(false);
      setSelectedEmployeeIds(new Set());
      notifications.show({
        title: result.failed > 0 ? common('error') : common('success'),
        message: result.failed > 0
          ? t('supervisorsPartiallyAssigned', { assignedCount: result.created, failedCount: result.failed })
          : t('supervisorsBulkAssigned', { count: result.created }),
        color: result.failed > 0 ? 'yellow' : 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  const loading = employeesLoading || supervisorsLoading;

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="rounded-lg">
        <CardHeader className="gap-2">
          <div>
            <CardTitle>{t('supervisorAssignments')}</CardTitle>
            <CardDescription>{t('supervisorAssignmentsDescription')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-wrap items-end gap-2">
              <Field label={t('employeeSearch')} id="supervisor-assignment-search">
                <Input
                  id="supervisor-assignment-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t('searchEmployees')}
                  className="min-w-64 md:max-w-sm"
                />
              </Field>
              <Field label={t('department')} id="supervisor-assignment-department">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger id="supervisor-assignment-department" className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allDepartmentsValue}>{t('allDepartments')}</SelectItem>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>{department.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('employmentStatus')} id="supervisor-assignment-status">
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as EmploymentStatus | typeof allStatusesValue)}>
                  <SelectTrigger id="supervisor-assignment-status" className="w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allStatusesValue}>{t('allEmploymentStatuses')}</SelectItem>
                    {employmentStatuses.map((status) => (
                      <SelectItem key={status} value={status}>{t(status.toLowerCase() as 'active')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('employmentType')} id="supervisor-assignment-type">
                <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as EmploymentType | typeof allEmploymentTypesValue)}>
                  <SelectTrigger id="supervisor-assignment-type" className="w-full sm:w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allEmploymentTypesValue}>{t('allEmploymentTypes')}</SelectItem>
                    {employmentTypes.map((type) => (
                      <SelectItem key={type} value={type}>{t(`employmentType${type}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Button onClick={openAssignmentDialog} disabled={selectedEmployeeIds.size === 0}>
              <Plus className="size-4" />
              {t('assignSupervisor')}
              {selectedEmployeeIds.size > 0 ? ` (${selectedEmployeeIds.size})` : ''}
            </Button>
          </div>

          {loading ? (
            <p className="py-8 text-sm text-muted-foreground">{common('loading')}</p>
          ) : filteredEmployees.length === 0 ? (
            <EmptyState icon={UserRoundCog} title={t('noMatchingEmployees')} description={t('noMatchingEmployeesDescription')} />
          ) : (
            <div className="space-y-3">
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={allFilteredSelected ? true : selectedFilteredCount > 0 ? 'indeterminate' : false}
                          onCheckedChange={(checked) => toggleFilteredSelection(checked === true)}
                          aria-label={t('selectAll')}
                        />
                      </TableHead>
                      <TableHead>{t('employee')}</TableHead>
                      <TableHead>{t('department')}</TableHead>
                      <TableHead>{t('position')}</TableHead>
                      <TableHead>{t('currentPrimarySupervisor')}</TableHead>
                      <TableHead>{t('effectivePeriod')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEmployees.map((employee) => {
                      const currentPrimary = currentPrimaryByEmployeeId.get(employee.id) ?? null;

                      return (
                        <TableRow key={employee.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedEmployeeIds.has(employee.id)}
                              onCheckedChange={(checked) => toggleEmployeeSelection(employee.id, checked === true)}
                              aria-label={employeeName(employee)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="min-w-48">
                              <p className="font-medium text-foreground">{employeeName(employee)}</p>
                              <p className="text-xs text-muted-foreground">{employee.employeeCode}</p>
                            </div>
                          </TableCell>
                          <TableCell>{employee.department?.nameEn ?? employee.sourceDepartmentName ?? '-'}</TableCell>
                          <TableCell>{employee.position?.nameEn ?? employee.positionName ?? employee.sourcePositionName ?? '-'}</TableCell>
                          <TableCell>{currentPrimary?.supervisor ? employeeName(currentPrimary.supervisor) : '-'}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {currentPrimary
                              ? `${formatDate(currentPrimary.effectiveFrom)} - ${currentPrimary.effectiveTo ? formatDate(currentPrimary.effectiveTo) : t('openEnded')}`
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={employee.employmentStatus === 'ACTIVE' ? 'default' : 'secondary'}>
                              {t(employee.employmentStatus.toLowerCase() as 'active')}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  {t('showingRecords', {
                    from: totalRecords === 0 ? 0 : startIndex + 1,
                    to: Math.min(startIndex + pageSize, totalRecords),
                    total: totalRecords,
                  })}
                </p>
                <div className="flex items-center gap-2">
                  <Select value={String(pageSize)} onValueChange={(value) => setPageSize(Number(value))}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pageSizes.map((size) => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={currentPage <= 1}>
                    {common('previous')}
                  </Button>
                  <span className="min-w-20 text-center text-sm text-muted-foreground">
                    {currentPage} / {totalPages}
                  </span>
                  <Button type="button" variant="outline" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={currentPage >= totalPages}>
                    {common('next')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('assignSupervisor')}</DialogTitle>
            <DialogDescription>{t('selectedEmployeesPreview', { count: selectedEmployees.length })}</DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={saveAssignment}>
            <div className="grid gap-4">
              <Field label={t('supervisor')} id="bulk-supervisor">
                <SearchableEmployeeSelect
                  id="bulk-supervisor"
                  value={supervisorId}
                  onValueChange={setSupervisorId}
                  employees={supervisorOptions}
                  placeholder={t('selectSupervisor')}
                  searchPlaceholder={t('searchEmployees')}
                  emptyMessage={t('noMatchingEmployees')}
                />
              </Field>
              <Field label={t('effectiveFrom')} id="bulk-supervisor-effective-from">
                <CalendarDateField id="bulk-supervisor-effective-from" value={effectiveFrom} onChange={setEffectiveFrom} required />
              </Field>
              <Field label={t('effectiveTo')} id="bulk-supervisor-effective-to">
                <CalendarDateField id="bulk-supervisor-effective-to" value={effectiveTo} onChange={setEffectiveTo} />
              </Field>
              <SwitchRow label={t('primary')} checked={isPrimary} onCheckedChange={setIsPrimary} />
              {isPrimary ? (
                <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {t('primarySupervisorReplacementNote')}
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={!supervisorId || !effectiveFrom || selectedEmployeeIds.size === 0 || bulkAssign.isPending}>
                {bulkAssign.isPending ? common('loading') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function employeeName(employee: Employee) {
  return `${employee.firstNameEn} ${employee.middleNameEn ?? ''} ${employee.lastNameEn}`.replace(/\s+/g, ' ').trim();
}

function Field({ label, id, children }: { label: ReactNode; id: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SwitchRow({ label, checked, onCheckedChange }: { label: ReactNode; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SearchableEmployeeSelect({
  id,
  value,
  onValueChange,
  employees,
  placeholder,
  searchPlaceholder,
  emptyMessage,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  employees: Employee[];
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedEmployee = employees.find((employee) => employee.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedEmployee ? `${employeeName(selectedEmployee)} - ${selectedEmployee.employeeCode}` : placeholder}
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
              {employees.map((employee) => {
                const name = employeeName(employee);
                const description = [
                  employee.employeeCode,
                  employee.department?.nameEn ?? employee.sourceDepartmentName,
                  employee.email,
                  employee.phoneNumber,
                ].filter(Boolean).join(' ');

                return (
                  <CommandItem
                    key={employee.id}
                    value={`${name} ${description}`}
                    onSelect={() => {
                      onValueChange(employee.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('size-4', value === employee.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{description}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
