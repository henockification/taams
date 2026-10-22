'use client';

import Image from 'next/image';
import { Check, ChevronsUpDown, Download, FileText, Printer, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
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
import { CalendarDateField } from '@/components/calendar/calendar-date-field';
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
  useUsersReportRoles,
} from '@/data/hooks/core.hooks';
import type { ReportHighlight, ReportKey } from '@/data/types/core.types';
import { formatEmployeeName } from '@/lib/employee-name';
import { cn } from '@/lib/utils';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

type FilterType = 'date' | 'time' | 'select' | 'search' | 'checkbox' | 'number';

type FilterConfig = {
  key: string;
  label: string;
  type: FilterType;
  options?: { value: string; label: string }[];
  /** A select that always has a value, e.g. a view switch; the first option is the default. */
  required?: boolean;
};

type ReportConfig = {
  key: ReportKey;
  title: string;
  description: string;
  filters: FilterConfig[];
};

type ReportPageProps = {
  reportKey: ReportKey;
  /** Replaces the department filter options, e.g. with only the departments a supervisor heads. */
  departmentOptions?: { value: string; label: string }[];
  /** Shown above the filters, e.g. the departments the report covers. */
  headerNote?: ReactNode;
};

const reportConfigs: Record<ReportKey, Omit<ReportConfig, 'filters'> & { filterKeys: string[]; defaultDateFrom?: 'monthStart' }> = {
  'attendance-daily': {
    key: 'attendance-daily',
    title: 'Attendance Daily Summary',
    description: 'Session check-ins and check-outs, late and early minutes, attendance, leave and absence days by employee.',
    filterKeys: ['view', 'dateFrom', 'dateTo', 'departmentId', 'employeeId', 'attendanceStatus'],
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
    description: 'Late check-ins and late returns from break, per session, as shown on attendance approval.',
    filterKeys: ['view', 'dateFrom', 'dateTo', 'departmentId', 'employeeId', 'attendanceStatus', 'minLateMinutes'],
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
  audit: {
    key: 'audit',
    title: 'Audit Trail',
    description: 'Who did what, when, and with what change across TAAMS.',
    filterKeys: ['dateFrom', 'dateTo', 'actorSearch', 'action', 'resourceType', 'employeeId', 'departmentId', 'outcome', 'delegatedOnly'],
  },
  users: {
    key: 'users',
    title: 'Users',
    description: 'User accounts with their roles, login status and email status, and how many users hold each role.',
    filterKeys: ['search', 'role', 'loginStatus', 'emailStatus'],
  },
  'supervisor-attendance': {
    key: 'supervisor-attendance',
    title: 'Supervisor Attendance Report',
    description: 'Daily attendance for every employee in the departments you head and their sub-departments.',
    filterKeys: ['dateFrom', 'dateTo', 'departmentId', 'search', 'attendanceStatus'],
  },
  'supervisor-attendance-summary': {
    key: 'supervisor-attendance-summary',
    title: 'Supervisor Attendance Summary',
    description: 'Attendance totals per employee in the departments you head and their sub-departments.',
    filterKeys: ['dateFrom', 'dateTo', 'departmentId', 'search', 'attendanceStatus'],
    defaultDateFrom: 'monthStart',
  },
};

export function ReportPage({ reportKey, departmentOptions, headerNote }: ReportPageProps) {
  const common = useTranslations('common');
  const { formatDate, formatDateTime } = useCalendarPreference();
  const configBase = reportConfigs[reportKey];
  const [filters, setFilters] = useState<Record<string, string>>(
    () => defaultFilters(configBase.filterKeys, configBase.defaultDateFrom),
  );
  // Only load the option lists a report actually filters by; users without access to them would otherwise hit 403s.
  const usesFilter = (key: string) => configBase.filterKeys.includes(key);
  const departmentsQuery = useDepartments(usesFilter('departmentId') && !departmentOptions);
  const employeesQuery = useEmployees(usesFilter('employeeId'));
  const devicesQuery = useBiometricDevices(usesFilter('deviceId'));
  const fiscalYearsQuery = useLeaveFiscalYears(usesFilter('fiscalYearId'));
  const leaveTypesQuery = useLeaveTypes(usesFilter('leaveTypeId'));
  const rolesQuery = useUsersReportRoles(usesFilter('role'));
  const locale = useLocale();
  // The API formats employee names in the requested language, for the table and the Excel file alike.
  const requestParams = useMemo(() => ({ ...filters, locale }), [filters, locale]);
  const reportQuery = useReport(reportKey, requestParams);
  const [isExporting, setIsExporting] = useState(false);

  const reportFilters = useMemo(() => buildFilters({
    keys: configBase.filterKeys,
    locale,
    departments: departmentsQuery.data?.departments ?? [],
    departmentOptions,
    employees: employeesQuery.data?.employees ?? [],
    devices: devicesQuery.data?.biometricDevices ?? [],
    fiscalYears: fiscalYearsQuery.data?.leaveFiscalYears ?? [],
    leaveTypes: leaveTypesQuery.data?.leaveTypes ?? [],
    roles: rolesQuery.data?.roles ?? [],
  }), [
    configBase.filterKeys,
    departmentsQuery.data,
    departmentOptions,
    employeesQuery.data,
    devicesQuery.data,
    fiscalYearsQuery.data,
    leaveTypesQuery.data,
    rolesQuery.data,
    locale,
  ]);

  // Links (e.g. from dashboards) can preset filters through the URL query string.
  const appliedUrlFilters = useRef(false);
  useEffect(() => {
    if (appliedUrlFilters.current) return;
    appliedUrlFilters.current = true;
    const allowed = new Set(reportFilters.map((filter) => filter.key));
    const fromUrl: Record<string, string> = {};
    new URLSearchParams(window.location.search).forEach((value, key) => {
      if (allowed.has(key)) fromUrl[key] = value;
    });
    if (Object.keys(fromUrl).length > 0) setFilters((current) => ({ ...current, ...fromUrl }));
  }, [reportFilters]);

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
      const blob = await coreApi.downloadReportExcel(reportKey, requestParams);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportKey}${filters.view === 'summary' ? '-employee-totals' : ''}-report.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="report-page flex w-full flex-col gap-5">
      {headerNote}
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

      <div className="report-actions report-filters flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-2">
          {reportFilters.map((filter) => (
            <FilterControl
              key={filter.key}
              filter={filter}
              value={filters[filter.key] ?? ''}
              onChange={(value) => updateFilter(filter.key, value)}
            />
          ))}
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

      <Card className="report-card rounded-lg">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Tams" width={42} height={42} className="size-10 object-contain" />
              <div>
                <CardTitle className="text-lg">
                  {configBase.title}{filters.view === 'summary' ? ' — Employee totals' : ''}
                </CardTitle>
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
            <div className="space-y-4">
              <ReportHighlights highlights={report.summary.highlights} />
              <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {report.columns.map((column) => (
                      <TableHead
                        key={column.key}
                        className={wideTextColumns.has(column.key) ? 'min-w-48' : 'whitespace-nowrap'}
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.rows.map((row, index) => (
                    <TableRow key={index}>
                      {report.columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={wideTextColumns.has(column.key) ? 'min-w-48 max-w-72 whitespace-normal' : 'whitespace-nowrap'}
                        >
                          <ReportCell columnKey={column.key} value={formatReportValue(row[column.key], formatDate, formatDateTime)} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
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
        <Select
          value={value || (filter.required ? filter.options?.[0]?.value : 'all')}
          onValueChange={(next) => onChange(next === 'all' ? '' : next)}
        >
          <SelectTrigger size="sm" className="h-8 w-full min-w-0 px-2.5 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="start" className="min-w-[var(--radix-select-trigger-width)]">
            {filter.required ? null : <SelectItem value="all" className="text-xs">All</SelectItem>}
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

  if (filter.type === 'date') {
    return (
      <FilterShell filter={filter}>
        <CalendarDateField value={value} onChange={onChange} className="h-8 text-xs" />
      </FilterShell>
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

/** Free-text columns that would otherwise stretch the table and push the figures out of view. */
const wideTextColumns = new Set(['department', 'temporaryFrom', 'directSupervisor', 'payrollNote', 'reason', 'changesSummary', 'errorMessage']);

function ReportHighlights({ highlights }: { highlights?: ReportHighlight[] }) {
  if (!highlights?.length) return null;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-1.5">
      {highlights.map((highlight) => (
        <div key={highlight.label} className="min-w-0 rounded-md border border-border px-2.5 py-2">
          <p className="text-[11px] leading-tight text-muted-foreground">{highlight.label}</p>
          <p className="mt-1 text-xl font-semibold leading-none">{highlight.value}</p>
          {highlight.detail ? <p className="mt-1 text-[10px] leading-tight text-muted-foreground">{highlight.detail}</p> : null}
        </div>
      ))}
    </div>
  );
}

/** Styles attendance cells the way the attendance approval screen does: status badges and flagged exceptions. */
function ReportCell({ columnKey, value }: { columnKey: string; value: string }) {
  if (/^session\d+Status$/.test(columnKey) && value) {
    const variant = value === 'Present' ? 'default' : value === 'Absent' ? 'destructive' : 'secondary';
    return <Badge variant={variant}>{value}</Badge>;
  }
  if (/^session\d+(In|Out)$/.test(columnKey)) {
    if (value.startsWith('Missing')) return <span className="text-destructive">{value}</span>;
    if (value === 'No punches') return <span className="text-muted-foreground">{value}</span>;
    if (/ (Late|Early) \(/.test(value) || value.includes('Late check-out')) {
      return <span className="font-medium text-amber-600">{value}</span>;
    }
    return <>{value}</>;
  }
  if (flaggedMinuteColumns.has(columnKey) && Number(value) > 0) {
    return <span className="font-medium text-amber-600">{value}</span>;
  }
  if (columnKey === 'absenceDays' || columnKey === 'absentSessions') {
    return Number(value) > 0 ? <span className="font-medium text-destructive">{value}</span> : <>{value}</>;
  }
  return <>{value}</>;
}

const flaggedMinuteColumns = new Set([
  'lateMinutes',
  'lateCheckInMinutes',
  'lateReturnMinutes',
  'earlyBreakMinutes',
  'earlyDepartureMinutes',
  'earlyLeaveMinutes',
  'lateDays',
]);

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
  locale: string;
  departments: any[];
  departmentOptions?: { value: string; label: string }[];
  employees: any[];
  devices: any[];
  fiscalYears: any[];
  leaveTypes: any[];
  roles: Array<{ id: string; name: string }>;
}) {
  const options = {
    departmentId: input.departmentOptions
      ?? input.departments.map((department) => ({ value: department.id, label: department.nameEn })),
    employeeId: input.employees.map((employee) => ({ value: employee.id, label: `${employee.employeeCode} - ${formatEmployeeName(employee, input.locale)}` })),
    deviceId: input.devices.map((device) => ({ value: device.id, label: device.deviceName })),
    fiscalYearId: input.fiscalYears.map((fiscalYear) => ({ value: fiscalYear.id, label: fiscalYear.name })),
    leaveTypeId: input.leaveTypes.map((leaveType) => ({ value: leaveType.id, label: leaveType.nameEn })),
    role: [...input.roles.map((role) => ({ value: role.name, label: role.name })), { value: '__none', label: 'No role' }],
  };
  const definitions: Record<string, FilterConfig> = {
    view: { key: 'view', label: 'View', type: 'select', options: reportViews, required: true },
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
    actorSearch: { key: 'actorSearch', label: 'Actor', type: 'search' },
    action: { key: 'action', label: 'Action', type: 'select', options: auditActions },
    resourceType: { key: 'resourceType', label: 'Resource type', type: 'select', options: auditResourceTypes },
    outcome: { key: 'outcome', label: 'Outcome', type: 'select', options: auditOutcomes },
    delegatedOnly: { key: 'delegatedOnly', label: 'Delegated only', type: 'checkbox' },
    role: { key: 'role', label: 'Role', type: 'select', options: options.role },
    loginStatus: { key: 'loginStatus', label: 'Login status', type: 'select', options: loginStatuses },
    emailStatus: { key: 'emailStatus', label: 'Email status', type: 'select', options: emailStatuses },
  };

  return input.keys.map((key) => definitions[key]);
}

function defaultFilters(keys: string[], defaultDateFrom?: 'monthStart') {
  const today = new Date().toISOString().slice(0, 10);
  const dateFromDefault = defaultDateFrom === 'monthStart' ? `${today.slice(0, 8)}01` : today;
  return Object.fromEntries(keys.map((key) => [
    key,
    key === 'dateFrom' ? dateFromDefault : key === 'dateTo' ? today : '',
  ]));
}

function formatReportValue(
  value: unknown,
  formatDate: (value: Date | string | null | undefined) => string,
  formatDateTime: (value: Date | string | null | undefined) => string,
) {
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) return formatDateTime(value);
  }
  return String(value ?? '');
}

const attendanceStatuses = [
  { value: 'PENDING_SUPERVISOR', label: 'Pending supervisor' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'SUPERVISOR_APPROVED', label: 'Supervisor approved' },
  { value: 'HR_APPROVED', label: 'HR approved' },
];
const reportViews = [
  { value: 'daily', label: 'Daily records' },
  { value: 'summary', label: 'Employee totals' },
];
const punchStatuses = [{ value: 'processed', label: 'Processed' }, { value: 'unprocessed', label: 'Unprocessed' }];
const leaveStatuses = ['PENDING', 'APPROVED', 'AUTHORIZED', 'REJECTED', 'AUTHORIZATION_REJECTED'].map((value) => ({ value, label: value }));
const syncStatuses = ['STARTED', 'COMPLETED', 'FAILED', 'PARTIAL'].map((value) => ({ value, label: value }));
const loginStatuses = [
  { value: 'active', label: 'Active' },
  { value: 'locked', label: 'Locked' },
  { value: 'revoked', label: 'Access revoked' },
];
const emailStatuses = [
  { value: 'verified', label: 'Verified' },
  { value: 'unverified', label: 'Unverified' },
];
// Only contract and permanent employees are managed; other types are not applicable.
const employmentTypes = [{ value: 'CONTRACT', label: 'Contract' }, { value: 'PERMANENT', label: 'Permanent' }];
const employmentStatuses = ['ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED'].map((value) => ({ value, label: value }));
const auditOutcomes = ['SUCCESS', 'DENIED', 'FAILED'].map((value) => ({ value, label: value }));
const auditResourceTypes = [
  'leave_request',
  'leave_balance',
  'attendance_daily_record',
  'overtime_request',
  'manual_punch_request',
  'biometric_exemption',
  'supervisor_delegation',
  'temporary_department_assignment',
  'ifmis_export_batch',
  'user',
  'role',
  'permission',
  'employee',
  'department',
  'position',
  'auth_session',
  'biometric_device',
  'attendance_punch',
  'holiday',
  'shift',
  'work_schedule',
].map((value) => ({ value, label: value.replace(/_/g, ' ') }));
const auditActions = [
  'AUTH_SIGN_IN',
  'AUTH_SIGN_OUT',
  'AUTH_PASSWORD_RESET',
  'AUTH_PASSWORD_RESET_REQUESTED',
  'AUTH_SESSIONS_REVOKED',
  'PERMISSION_DENIED',
  'LEAVE_REQUEST_SUBMITTED',
  'LEAVE_TYPE_DELETED',
  'LEAVE_REQUEST_UPDATED',
  'LEAVE_REQUEST_APPROVED',
  'LEAVE_REQUEST_REJECTED',
  'LEAVE_REQUEST_AUTHORIZED',
  'LEAVE_REQUEST_AUTHORIZATION_REJECTED',
  'LEAVE_INTERRUPTION_SUBMITTED',
  'LEAVE_INTERRUPTION_APPROVED',
  'LEAVE_INTERRUPTION_REJECTED',
  'LEAVE_INTERRUPTION_AUTHORIZED',
  'LEAVE_INTERRUPTION_AUTHORIZATION_REJECTED',
  'LEAVE_BALANCE_UPSERTED',
  'LEAVE_BALANCE_TRANSFERRED',
  'LEAVE_BALANCE_CONSUMED',
  'ATTENDANCE_DAILY_RECORDS_GENERATED',
  'ATTENDANCE_SUPERVISOR_APPROVED',
  'ATTENDANCE_HR_APPROVED',
  'ATTENDANCE_RETURNED',
  'ATTENDANCE_REOPENED_AFTER_CORRECTION',
  'ATTENDANCE_PAYROLL_ADJUSTED',
  'OVERTIME_ASSIGNED',
  'OVERTIME_UPDATED',
  'OVERTIME_APPROVED',
  'OVERTIME_REJECTED',
  'MANUAL_PUNCH_SUBMITTED',
  'MANUAL_PUNCH_HR_REVIEWED',
  'MANUAL_PUNCH_HR_REJECTED',
  'MANUAL_PUNCH_APPROVED',
  'MANUAL_PUNCH_REJECTED',
  'BIOMETRIC_EXEMPTION_SUBMITTED',
  'BIOMETRIC_EXEMPTION_APPROVED',
  'BIOMETRIC_EXEMPTION_REJECTED',
  'SUPERVISOR_DELEGATION_CREATED',
  'SUPERVISOR_DELEGATION_REVOKED',
  'TEMPORARY_ASSIGNMENT_CREATED',
  'IFMIS_PREVIEWED',
  'IFMIS_PUSHED',
  'IFMIS_ABSENCE_ADJUSTMENT_SET',
  'IFMIS_ABSENCE_ADJUSTMENT_CLEARED',
  'USER_CREATED',
  'USER_UPDATED',
  'USER_ROLES_ASSIGNED',
  'USER_ACCESS_REVOKED',
  'USER_ACCESS_RESTORED',
  'ROLE_CREATED',
  'ROLE_UPDATED',
  'EMPLOYEE_CREATED',
  'EMPLOYEE_UPDATED',
  'EMPLOYEE_IMPORTED',
  'DEPARTMENT_CREATED',
  'DEPARTMENT_UPDATED',
  'DEPARTMENT_MOVED',
  'DEPARTMENT_HEAD_CHANGED',
  'POSITION_CREATED',
  'POSITION_UPDATED',
  'BIOMETRIC_DEVICE_CREATED',
  'BIOMETRIC_DEVICE_UPDATED',
  'BIOMETRIC_DEVICE_SYNCED',
  'BIOMETRIC_ENROLLMENT_IMPORTED',
  'BIOMETRIC_ENROLLMENT_SYNCED',
  'BIOMETRIC_EMPLOYEE_PROVISIONED',
  'BIOMETRIC_EMPLOYEE_DEPROVISIONED',
  'ATTENDANCE_PUNCH_CREATED',
  'HOLIDAY_CREATED',
  'HOLIDAY_UPDATED',
  'SHIFT_CREATED',
  'SHIFT_UPDATED',
  'WORK_SCHEDULE_CREATED',
  'WORK_SCHEDULE_UPDATED',
  'ZKTECO_INGESTED',
].map((value) => ({ value, label: value.replace(/_/g, ' ').toLowerCase() }));
