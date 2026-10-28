'use client';

import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { CalendarCheck, FileSpreadsheet, Plus } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EmployeeDepartment, useEmployeeDepartmentLabel } from '@/components/employees/employee-department';
import { DirectLeaveDialog } from '@/components/leave/direct-leave-dialog';
import { canRecordDirectLeave } from '@/config/app-navigation';
import { useSession } from '@/lib/auth-client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatEmployeeName } from '@/lib/employee-name';
import { useEmployees } from '@/data/hooks/core.hooks';
import type { Employee, EmploymentType } from '@/data/types/core.types';
import { matchSourceEmploymentStatus, SOURCE_EMPLOYMENT_STATUS_OPTIONS } from '@/lib/employment-status';
import { useRouter } from '@/i18n';

const employmentStatusOptions = SOURCE_EMPLOYMENT_STATUS_OPTIONS;
type EmploymentStatusFilter = 'ALL' | (typeof employmentStatusOptions)[number]['value'];
const allDepartmentsValue = '__all_departments';

type ImportedEmployeesKind = 'permanent' | 'contract';

const directoryCopy = {
  permanent: {
    searchId: 'permanent-employee-search',
    statusId: 'permanent-employee-status-filter',
    departmentId: 'permanent-employee-department-filter',
    searchPlaceholder: 'searchPermanentEmployees',
    totalLabel: 'totalPermanentEmployees',
    emptyTitle: 'noPermanentEmployees',
    emptyDescription: 'noPermanentEmployeesDescription',
    noMatchTitle: 'noMatchingPermanentEmployees',
    noMatchDescription: 'noMatchingPermanentEmployeesDescription',
  },
  contract: {
    searchId: 'contract-employee-search',
    statusId: 'contract-employee-status-filter',
    departmentId: 'contract-employee-department-filter',
    searchPlaceholder: 'searchContractEmployees',
    totalLabel: 'totalContractEmployees',
    emptyTitle: 'noContractEmployees',
    emptyDescription: 'noContractEmployeesDescription',
    noMatchTitle: 'noMatchingContractEmployees',
    noMatchDescription: 'noMatchingContractEmployeesDescription',
  },
} as const;

export function ImportedEmployeesPage({
  kind,
  employmentType,
  detailBasePath,
}: {
  kind: ImportedEmployeesKind;
  employmentType: EmploymentType;
  detailBasePath: '/permanent-employees' | '/contract-employees';
}) {
  const t = useTranslations('core');
  const locale = useLocale();
  const router = useRouter();
  const employeeDepartmentLabel = useEmployeeDepartmentLabel();
  const copy = directoryCopy[kind];
  const { data: employeesResponse, isLoading } = useEmployees();
  const [search, setSearch] = useState('');
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState<EmploymentStatusFilter>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState(allDepartmentsValue);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [directLeaveTarget, setDirectLeaveTarget] = useState<Employee | null>(null);
  const session = useSession();
  const canMarkOnLeave = canRecordDirectLeave(session.data?.user);
  const gridColumns = canMarkOnLeave
    ? 'grid-cols-[260px_130px_220px_220px_100px_180px_150px]'
    : 'grid-cols-[260px_130px_220px_220px_100px_180px]';

  const directoryEmployees = useMemo(() => (
    (employeesResponse?.employees ?? []).filter((employee) => employee.employmentType === employmentType)
  ), [employeesResponse?.employees, employmentType]);

  const departments = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const employee of directoryEmployees) {
      const department = employeeDepartmentOption(employee);
      if (department) byId.set(department.id, department);
    }
    return [...byId.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [directoryEmployees]);

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return directoryEmployees.filter((employee) => {
      if (employmentStatusFilter !== 'ALL') {
        const matched = matchSourceEmploymentStatus(employee.sourceEmploymentStatus ?? employee.employmentStatus);
        if (matched?.value !== employmentStatusFilter) return false;
      }

      if (departmentFilter !== allDepartmentsValue) {
        if (employeeDepartmentOption(employee)?.id !== departmentFilter) return false;
      }

      if (!query) return true;

      const haystack = [
        employee.firstNameEn,
        employee.middleNameEn,
        employee.lastNameEn,
        employee.firstNameAm,
        employee.middleNameAm,
        employee.lastNameAm,
        employee.sourceFullNameAm,
        employee.employeeCode,
        employee.sourceIdNo,
        employee.phoneNumber,
        employee.email,
        employee.department?.nameEn,
        employee.sourceDepartmentName,
        employeeDepartmentLabel(employee.id, employee.department?.nameEn ?? employee.sourceDepartmentName),
        employee.positionName,
        employee.sourcePositionName,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    }).sort((left, right) => formatEmployeeName(left, locale).localeCompare(formatEmployeeName(right, locale), undefined, { sensitivity: 'base' }));
  }, [departmentFilter, directoryEmployees, employeeDepartmentLabel, employmentStatusFilter, locale, search]);

  const totalRecords = filteredEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEmployees = filteredEmployees.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage !== page) {
      setPage(currentPage);
    }
  }, [currentPage, page]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, employmentStatusFilter, pageSize, search]);

  const openEmployee = (employeeId: string) => {
    router.push(`${detailBasePath}/${employeeId}`);
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-2">
          <FilterField label={t('employeeSearch')} htmlFor={copy.searchId}>
            <Input
              id={copy.searchId}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t(copy.searchPlaceholder)}
              className="min-w-64 flex-1 md:max-w-sm"
            />
          </FilterField>
          <FilterField label={t('employmentStatus')} htmlFor={copy.statusId}>
            <Select
              value={employmentStatusFilter}
              onValueChange={(value) => setEmploymentStatusFilter(value as EmploymentStatusFilter)}
            >
              <SelectTrigger id={copy.statusId} className="w-full sm:w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">{t('allEmploymentStatuses')}</SelectItem>
                {employmentStatusOptions.map((status) => (
                  <SelectItem key={status.value} value={status.value}>{status.value}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label={t('department')} htmlFor={copy.departmentId}>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger id={copy.departmentId} className="w-full sm:w-64">
                <SelectValue placeholder={t('selectDepartment')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allDepartmentsValue}>{t('allDepartments')}</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => router.push(`${detailBasePath}/new`)}>
            <Plus className="size-4" />
            {t('addEmployee')}
          </Button>
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-[11px] leading-none text-muted-foreground">{t(copy.totalLabel)}</p>
            <p className="text-base font-semibold">{totalRecords}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loadingEmployees')}</p>
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={directoryEmployees.length === 0 ? t(copy.emptyTitle) : t(copy.noMatchTitle)}
          description={directoryEmployees.length === 0 ? t(copy.emptyDescription) : t(copy.noMatchDescription)}
          className="min-h-72"
        />
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border border-border">
            <div className="min-w-[820px]">
              <div className={`grid ${gridColumns} gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground`}>
                <span>{t('employee')}</span>
                <span>{t('idNo')}</span>
                <span>{t('department')}</span>
                <span>{t('position')}</span>
                <span>{t('gender')}</span>
                <span>{t('status')}</span>
                {canMarkOnLeave ? <span>{t('actions')}</span> : null}
              </div>
              {paginatedEmployees.map((employee) => {
                const amharicName = [employee.firstNameAm, employee.middleNameAm, employee.lastNameAm]
                  .filter(Boolean)
                  .join(' ');
                // The secondary line shows the name in the other language.
                const secondaryName = locale === 'am' ? formatEmployeeName(employee, 'en') : amharicName;
                const sourceStatus = employee.sourceEmploymentStatus ?? employee.employmentStatus;

                return (
                  <div
                    key={employee.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEmployee(employee.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openEmployee(employee.id);
                      }
                    }}
                    className={`grid cursor-pointer ${gridColumns} gap-3 border-b border-border px-4 py-4 text-sm outline-none transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{formatEmployeeName(employee, locale)}</p>
                      <p className="truncate text-xs text-muted-foreground">{secondaryName || '-'}</p>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="secondary">{employee.sourceIdNo ?? employee.employeeCode}</Badge>
                    </div>
                    <p className="truncate"><EmployeeDepartment employeeId={employee.id} department={employee.department?.nameEn ?? employee.sourceDepartmentName ?? '-'} /></p>
                    <div className="min-w-0">
                      <p className="truncate">{employee.positionName ?? employee.position?.nameEn ?? employee.sourcePositionName ?? t('noPosition')}</p>
                      <p className="truncate text-xs text-muted-foreground">{employee.sourcePositionCode ?? '-'}</p>
                    </div>
                    <p className="truncate">{employee.gender ?? '-'}</p>
                    <EmploymentStatusBadge value={sourceStatus} />
                    {canMarkOnLeave ? (
                      <div className="flex items-center">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDirectLeaveTarget(employee);
                          }}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <CalendarCheck className="size-4" />
                          {t('markOnLeave')}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {totalRecords === 0 ? 'No records' : `Showing ${startIndex + 1}-${Math.min(startIndex + pageSize, totalRecords)} of ${totalRecords}`}
            </p>
            <div className="flex items-center gap-2">
              <Select
                value={String(pageSize)}
                onValueChange={(value) => setPageSize(Number(value))}
              >
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25 / page</SelectItem>
                  <SelectItem value="50">50 / page</SelectItem>
                  <SelectItem value="100">100 / page</SelectItem>
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage <= 1}
              >
                Previous
              </Button>
              <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      )}

      {canMarkOnLeave ? (
        <DirectLeaveDialog
          employee={directLeaveTarget}
          open={Boolean(directLeaveTarget)}
          onOpenChange={(open) => !open && setDirectLeaveTarget(null)}
        />
      ) : null}
    </div>
  );
}

function employeeDepartmentOption(employee: Employee) {
  if (employee.department?.id) {
    return { id: employee.department.id, name: employee.department.nameEn };
  }
  if (employee.departmentId) {
    return { id: employee.departmentId, name: employee.sourceDepartmentName ?? employee.departmentId };
  }
  if (employee.sourceDepartmentName) {
    return { id: `source:${employee.sourceDepartmentName}`, name: employee.sourceDepartmentName };
  }
  return null;
}

function FilterField({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function EmploymentStatusBadge({ value }: { value: string | null }) {
  const matched = matchSourceEmploymentStatus(value);
  const tone = matched?.isActive
    ? 'success'
    : matched
      ? 'danger'
      : 'neutral';

  const toneClasses = tone === 'success'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100'
    : tone === 'danger'
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100'
      : 'border-border bg-muted/40 text-foreground';

  return (
    <div className={`flex items-center rounded-md border px-2 py-1 text-xs font-medium ${toneClasses}`}>
      <span className="truncate">{value || '-'}</span>
    </div>
  );
}
