'use client';

import Image from 'next/image';
import { Check, ChevronsUpDown, Download, FileText, Printer, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { coreApi } from '@/data/api/core.api';
import {
  useBiometricDevices,
  useDepartments,
  useEmployees,
  useLeaveFiscalYears,
  useLeaveTypes,
  useReport,
} from '@/data/hooks/core.hooks';
import type { ReportKey } from '@/data/types/core.types';
import { cn } from '@/lib/utils';

type FilterType = 'date' | 'time' | 'select' | 'search' | 'checkbox' | 'number';

type FilterConfig = {
  key: string;
  label: string;
  type: FilterType;
  options?: { value: string; label: string }[];
};

type ReportConfig = {
  key: ReportKey;
  title: string;
  description: string;
  filters: FilterConfig[];
};

type ReportPageProps = {
  reportKey: ReportKey;
};

const reportConfigs: Record<ReportKey, Omit<ReportConfig, 'filters'> & { filterKeys: string[] }> = {
  'attendance-daily': {
    key: 'attendance-daily',
    title: 'Attendance Daily Summary',
    description: 'Daily payroll-ready attendance status by employee.',
    filterKeys: ['dateFrom', 'dateTo', 'departmentId', 'employeeId', 'attendanceStatus'],
  },
  'attendance-punches': {
    key: 'attendance-punches',
    title: 'Attendance Punches',
    description: 'Raw device, import, web, mobile, and manual punch records.',
    filterKeys: ['dateFrom', 'dateTo', 'timeFrom', 'timeTo', 'departmentId', 'employeeId', 'deviceId', 'punchStatus'],
  },
  'late-attendance': {
    key: 'late-attendance',
    title: 'Late Attendance',
    description: 'Employees whose first punch is later than their assigned shift threshold.',
    filterKeys: ['dateFrom', 'dateTo', 'departmentId', 'employeeId', 'attendanceStatus', 'minLateMinutes'],
  },
  overtime: {
    key: 'overtime',
    title: 'Overtime',
    description: 'Employees whose checkout is later than their assigned shift end time.',
    filterKeys: ['dateFrom', 'dateTo', 'departmentId', 'employeeId', 'attendanceStatus', 'minOvertimeMinutes'],
  },
  'leave-balances': {
    key: 'leave-balances',
    title: 'Leave Balances',
    description: 'Employee leave balances for the selected fiscal year.',
    filterKeys: ['fiscalYearId', 'departmentId', 'employeeId', 'lowBalance'],
  },
  'leave-requests': {
    key: 'leave-requests',
    title: 'Leave Requests',
    description: 'Submitted leave requests by period and status.',
    filterKeys: ['dateFrom', 'dateTo', 'departmentId', 'employeeId', 'leaveTypeId', 'leaveStatus'],
  },
  employees: {
    key: 'employees',
    title: 'Employee Roster',
    description: 'Employee directory snapshot by department and employment type.',
    filterKeys: ['departmentId', 'employeeId', 'employmentType', 'employmentStatus', 'search'],
  },
  'device-sync': {
    key: 'device-sync',
    title: 'Device Sync',
    description: 'Biometric device sync batches and outcomes.',
    filterKeys: ['dateFrom', 'dateTo', 'deviceId', 'syncStatus'],
  },
};

export function ReportPage({ reportKey }: ReportPageProps) {
  const common = useTranslations('common');
  const configBase = reportConfigs[reportKey];
  const [filters, setFilters] = useState<Record<string, string>>(() => defaultFilters(configBase.filterKeys));
  const departmentsQuery = useDepartments();
  const employeesQuery = useEmployees();
  const devicesQuery = useBiometricDevices();
  const fiscalYearsQuery = useLeaveFiscalYears();
  const leaveTypesQuery = useLeaveTypes();
  const reportQuery = useReport(reportKey, filters);
  const [isExporting, setIsExporting] = useState(false);

  const reportFilters = useMemo(() => buildFilters({
    keys: configBase.filterKeys,
    departments: departmentsQuery.data?.departments ?? [],
    employees: employeesQuery.data?.employees ?? [],
    devices: devicesQuery.data?.biometricDevices ?? [],
    fiscalYears: fiscalYearsQuery.data?.leaveFiscalYears ?? [],
    leaveTypes: leaveTypesQuery.data?.leaveTypes ?? [],
  }), [
    configBase.filterKeys,
    departmentsQuery.data,
    employeesQuery.data,
    devicesQuery.data,
    fiscalYearsQuery.data,
    leaveTypesQuery.data,
  ]);

  const report = reportQuery.data?.report;
  const activeFilterText = reportFilters
    .map((filter) => {
      const value = filters[filter.key];
      if (!value) return null;
      if (filter.type === 'checkbox') return value === 'true' ? filter.label : null;
      return `${filter.label}: ${filter.options?.find((option) => option.value === value)?.label ?? value}`;
    })
    .filter(Boolean);

  const updateFilter = (key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const exportExcel = async () => {
    try {
      setIsExporting(true);
      const blob = await coreApi.downloadReportExcel(reportKey, filters);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportKey}-report.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="report-page mx-auto flex w-full max-w-7xl flex-col gap-5">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .report-page, .report-page * {
            visibility: visible;
          }
          .report-page {
            position: absolute;
            inset: 0;
            max-width: none !important;
            padding: 0;
          }
          .report-actions, .report-filters {
            display: none !important;
          }
          .report-card {
            border: 0 !important;
            box-shadow: none !important;
          }
          table {
            font-size: 10px;
          }
        }
      `}</style>

      <div className="report-actions flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{configBase.title}</h1>
          <p className="text-sm text-muted-foreground">{configBase.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => reportQuery.refetch()} disabled={reportQuery.isFetching}>
            <RefreshCw className={reportQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportExcel} disabled={isExporting || !report}>
            <Download className="size-4" />
            Excel
          </Button>
          <Button onClick={() => window.print()} disabled={!report}>
            <Printer className="size-4" />
            PDF
          </Button>
        </div>
      </div>

      <Card className="report-filters rounded-lg">
        <CardContent className="flex flex-wrap items-end gap-2 p-3">
          {reportFilters.map((filter) => (
            <FilterControl
              key={filter.key}
              filter={filter}
              value={filters[filter.key] ?? ''}
              onChange={(value) => updateFilter(filter.key, value)}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="report-card rounded-lg">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Tams" width={42} height={42} className="size-10 object-contain" />
              <div>
                <CardTitle className="text-lg">{configBase.title}</CardTitle>
                <p className="text-xs text-muted-foreground">Tams Attendance Management System</p>
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p>Generated: {report ? formatDateTime(report.generatedAt) : '-'}</p>
              <p>Total rows: {report?.summary.totalRows ?? 0}</p>
            </div>
          </div>
          {activeFilterText.length > 0 ? (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {activeFilterText.map((filter) => (
                <span key={filter} className="rounded-md border border-border px-2 py-1">{filter}</span>
              ))}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {reportQuery.isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : reportQuery.isError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {reportQuery.error instanceof Error ? reportQuery.error.message : common('error')}
            </div>
          ) : report && report.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {report.columns.map((column) => (
                      <TableHead key={column.key} className="whitespace-nowrap">{column.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, index) => (
                    <TableRow key={index}>
                      {report.columns.map((column) => (
                        <TableCell key={column.key} className="whitespace-nowrap">
                          {String(row[column.key] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="text-sm font-medium">No report rows</p>
              <p className="text-xs text-muted-foreground">Adjust filters or refresh the report.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterControl({
  filter,
  value,
  onChange,
}: {
  filter: FilterConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  if (filter.type === 'select') {
    if (filter.key === 'employeeId') {
      return (
        <FilterShell filter={filter}>
          <SearchableEmployeeFilter filter={filter} value={value} onChange={onChange} />
        </FilterShell>
      );
    }

    return (
      <FilterShell filter={filter}>
        <Select value={value || 'all'} onValueChange={(next) => onChange(next === 'all' ? '' : next)}>
          <SelectTrigger size="sm" className="h-8 w-full min-w-0 px-2.5 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-[var(--radix-select-trigger-width)]">
            <SelectItem value="all" className="text-xs">All</SelectItem>
            {(filter.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-xs">{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterShell>
    );
  }

  if (filter.type === 'checkbox') {
    return (
      <label className={cn('flex h-8 items-center gap-2 text-xs font-medium text-foreground', filterWidthClass(filter))}>
        <Checkbox checked={value === 'true'} onCheckedChange={(checked) => onChange(checked ? 'true' : '')} />
        {filter.label}
      </label>
    );
  }

  return (
    <FilterShell filter={filter}>
      <Input
        type={filter.type === 'search' ? 'search' : filter.type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 px-2.5 text-xs"
      />
    </FilterShell>
  );
}

function FilterShell({ filter, children }: { filter: FilterConfig; children: ReactNode }) {
  return (
    <div className={cn('space-y-1', filterWidthClass(filter))}>
      <Label className="text-[11px] font-medium leading-none text-muted-foreground">{filter.label}</Label>
      {children}
    </div>
  );
}

function SearchableEmployeeFilter({
  filter,
  value,
  onChange,
}: {
  filter: FilterConfig;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = filter.options?.find((option) => option.value === value);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-8 w-full justify-between px-2.5 text-xs font-normal"
        >
          <span className="truncate">{selected?.label ?? 'All'}</span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0">
        <Command>
          <CommandInput placeholder="Search employee..." className="h-8 py-2 text-xs" />
          <CommandList className="max-h-64">
            <CommandEmpty className="py-4 text-xs">No employee found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all employees" onSelect={() => selectValue('')} className="text-xs">
                <Check className={cn('size-3.5', !value ? 'opacity-100' : 'opacity-0')} />
                All
              </CommandItem>
              {(filter.options ?? []).map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => selectValue(option.value)}
                  className="text-xs"
                >
                  <Check className={cn('size-3.5', value === option.value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function filterWidthClass(filter: FilterConfig) {
  if (filter.key === 'employeeId') return 'w-full min-w-[16rem] sm:w-[18rem]';
  if (filter.type === 'search') return 'w-full min-w-[13rem] sm:w-[15rem]';
  if (filter.type === 'date') return 'w-[9.5rem] min-w-[9.5rem]';
  if (filter.type === 'time') return 'w-[8rem] min-w-[8rem]';
  if (filter.type === 'number') return 'w-[10rem] min-w-[9rem]';
  if (filter.type === 'checkbox') return 'w-[9rem] min-w-[9rem]';
  return 'w-[11rem] min-w-[10rem]';
}

function buildFilters(input: {
  keys: string[];
  departments: any[];
  employees: any[];
  devices: any[];
  fiscalYears: any[];
  leaveTypes: any[];
}) {
  const options = {
    departmentId: input.departments.map((department) => ({ value: department.id, label: department.nameEn })),
    employeeId: input.employees.map((employee) => ({ value: employee.id, label: `${employee.employeeCode} - ${employee.firstNameEn} ${employee.lastNameEn}` })),
    deviceId: input.devices.map((device) => ({ value: device.id, label: device.deviceName })),
    fiscalYearId: input.fiscalYears.map((fiscalYear) => ({ value: fiscalYear.id, label: fiscalYear.name })),
    leaveTypeId: input.leaveTypes.map((leaveType) => ({ value: leaveType.id, label: leaveType.nameEn })),
  };
  const definitions: Record<string, FilterConfig> = {
    dateFrom: { key: 'dateFrom', label: 'Start date', type: 'date' },
    dateTo: { key: 'dateTo', label: 'End date', type: 'date' },
    timeFrom: { key: 'timeFrom', label: 'Start time', type: 'time' },
    timeTo: { key: 'timeTo', label: 'End time', type: 'time' },
    departmentId: { key: 'departmentId', label: 'Department', type: 'select', options: options.departmentId },
    employeeId: { key: 'employeeId', label: 'Employee', type: 'select', options: options.employeeId },
    deviceId: { key: 'deviceId', label: 'Device', type: 'select', options: options.deviceId },
    fiscalYearId: { key: 'fiscalYearId', label: 'Fiscal year', type: 'select', options: options.fiscalYearId },
    leaveTypeId: { key: 'leaveTypeId', label: 'Leave type', type: 'select', options: options.leaveTypeId },
    attendanceStatus: { key: 'status', label: 'Status', type: 'select', options: attendanceStatuses },
    punchStatus: { key: 'status', label: 'Processed status', type: 'select', options: punchStatuses },
    leaveStatus: { key: 'status', label: 'Status', type: 'select', options: leaveStatuses },
    syncStatus: { key: 'status', label: 'Status', type: 'select', options: syncStatuses },
    employmentType: { key: 'employmentType', label: 'Employment type', type: 'select', options: employmentTypes },
    employmentStatus: { key: 'employmentStatus', label: 'Employment status', type: 'select', options: employmentStatuses },
    minLateMinutes: { key: 'minLateMinutes', label: 'Min late minutes', type: 'number' },
    minOvertimeMinutes: { key: 'minOvertimeMinutes', label: 'Min overtime minutes', type: 'number' },
    lowBalance: { key: 'lowBalance', label: 'Low balance only', type: 'checkbox' },
    search: { key: 'search', label: 'Search', type: 'search' },
  };

  return input.keys.map((key) => definitions[key]);
}

function defaultFilters(keys: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  return Object.fromEntries(keys.map((key) => [key, key === 'dateFrom' || key === 'dateTo' ? today : '']));
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

const attendanceStatuses = ['PENDING_SUPERVISOR', 'RETURNED', 'SUPERVISOR_APPROVED', 'HR_APPROVED'].map((value) => ({ value, label: value }));
const punchStatuses = [{ value: 'processed', label: 'Processed' }, { value: 'unprocessed', label: 'Unprocessed' }];
const leaveStatuses = ['PENDING', 'APPROVED', 'REJECTED'].map((value) => ({ value, label: value }));
const syncStatuses = ['STARTED', 'COMPLETED', 'FAILED', 'PARTIAL'].map((value) => ({ value, label: value }));
const employmentTypes = ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY'].map((value) => ({ value, label: value }));
const employmentStatuses = ['ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED'].map((value) => ({ value, label: value }));
