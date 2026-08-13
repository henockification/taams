'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, FileSpreadsheet, UploadCloud } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { notifications } from '@/lib/notifications';
import {
  useEmployees,
  useHrUnits,
  useImportPermanentEmployees,
} from '@/data/hooks/core.hooks';
import type { PermanentEmployeeImportResponse } from '@/data/types/core.types';
import { useRouter } from '@/i18n';

const employmentStatusOptions = [
  { value: 'WORKING', label: 'በስራ ላይ', matches: ['በስራ ላይ', 'በ ስራ ላይ', 'working', 'active'] },
  { value: 'RESIGNED', label: 'በገዛ ፍቃድ የተሰናበቱ', matches: ['በገዛ ፍቃድ የተሰናበቱ', 'resigned', 'left by own request'] },
  { value: 'RETIRED', label: 'በጡረታ የተገለሉ', matches: ['በጡረታ የተገለሉ', 'retired'] },
] as const;

type EmploymentStatusFilter = 'ALL' | (typeof employmentStatusOptions)[number]['value'];

export default function PermanentEmployeesPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const router = useRouter();
  const { data: employeesResponse, isLoading } = useEmployees();
  const { data: hrUnitsResponse } = useHrUnits();
  const importPermanentEmployees = useImportPermanentEmployees();
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedHrUnitId, setSelectedHrUnitId] = useState('');
  const [result, setResult] = useState<PermanentEmployeeImportResponse | null>(null);
  const [search, setSearch] = useState('');
  const [employmentStatusFilter, setEmploymentStatusFilter] = useState<EmploymentStatusFilter>('ALL');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const hrUnits = hrUnitsResponse?.hrUnits ?? [];

  const permanentEmployees = useMemo(() => (
    (employeesResponse?.employees ?? []).filter((employee) => employee.employmentType === 'PERMANENT')
  ), [employeesResponse?.employees]);

  const filteredPermanentEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();

    return permanentEmployees.filter((employee) => {
      if (employmentStatusFilter !== 'ALL') {
        const sourceStatus = normalizeText(employee.sourceEmploymentStatus ?? '');
        const selected = employmentStatusOptions.find((option) => option.value === employmentStatusFilter);
        if (!selected || !selected.matches.some((match) => sourceStatus.includes(normalizeText(match)))) {
          return false;
        }
      }

      if (!query) return true;

      const haystack = [
        employee.firstNameEn,
        employee.middleNameEn,
        employee.lastNameEn,
        employee.employeeCode,
        employee.sourceIdNo,
        employee.phoneNumber,
        employee.hrUnit?.nameEn,
        employee.department?.nameEn,
        employee.sourceDepartmentName,
        employee.positionName,
        employee.sourcePositionName,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [employmentStatusFilter, permanentEmployees, search]);

  const totalRecords = filteredPermanentEmployees.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedEmployees = filteredPermanentEmployees.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (currentPage !== page) {
      setPage(currentPage);
    }
  }, [currentPage, page]);

  useEffect(() => {
    setPage(1);
  }, [employmentStatusFilter, pageSize, search]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
    setResult(null);
  };

  const importFile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFile || !selectedHrUnitId) return;

    try {
      const response = await importPermanentEmployees.mutateAsync({ file: selectedFile, hrUnitId: selectedHrUnitId });
      setResult(response);
      setSelectedFile(null);
      setImportDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: t('permanentEmployeesImportComplete'),
        color: response.failed > 0 ? 'yellow' : 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('permanentEmployeesImportFailed'),
        color: 'red',
      });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchPermanentEmployees')}
            className="min-w-64 flex-1 md:max-w-sm"
          />
          <Select
            value={employmentStatusFilter}
            onValueChange={(value) => setEmploymentStatusFilter(value as EmploymentStatusFilter)}
          >
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('allEmploymentStatuses')}</SelectItem>
              {employmentStatusOptions.map((status) => (
                <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setImportDialogOpen(true)}>
            <UploadCloud className="size-4" />
            {t('importPermanentEmployees')}
          </Button>
          <div className="rounded-md border border-border px-3 py-2">
            <p className="text-[11px] leading-none text-muted-foreground">{t('totalPermanentEmployees')}</p>
            <p className="text-base font-semibold">{permanentEmployees.length}</p>
          </div>
        </div>
      </div>

      {result ? (
        <div className="space-y-4 rounded-lg border border-border p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <ImportMetric label={t('created')} value={result.created} />
            <ImportMetric label={t('updated')} value={result.updated} />
            <ImportMetric label={t('skipped')} value={result.skipped} />
            <ImportMetric label={t('failed')} value={result.failed} tone={result.failed > 0 ? 'warning' : 'default'} />
            <ImportMetric label={t('totalRows')} value={result.totalRows} />
          </div>

          {result.errors.length > 0 ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="mb-2 flex items-center gap-2 font-medium">
                <AlertCircle className="size-4" />
                {t('rowErrors')}
              </div>
              <div className="max-h-52 space-y-2 overflow-auto pr-1">
                {result.errors.map((error) => (
                  <div key={`${error.rowNumber}-${error.employeeCode ?? 'unknown'}`} className="rounded-md bg-background/70 p-2">
                    <p className="font-medium">
                      {t('rowNumber', { rowNumber: error.rowNumber })}
                      {error.employeeCode ? ` · ${error.employeeCode}` : ''}
                    </p>
                    <p className="mt-1 text-muted-foreground">{error.errors.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
              <CheckCircle2 className="size-4" />
              {t('allRowsImported')}
            </div>
          )}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t('loadingEmployees')}</p>
      ) : filteredPermanentEmployees.length === 0 ? (
        <EmptyState
          icon={FileSpreadsheet}
          title={permanentEmployees.length === 0 ? t('noPermanentEmployees') : t('noMatchingPermanentEmployees')}
          description={permanentEmployees.length === 0 ? t('noPermanentEmployeesDescription') : t('noMatchingPermanentEmployeesDescription')}
          className="min-h-72"
        />
      ) : (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-md border border-border">
            <div className="min-w-[960px]">
              <div className="grid grid-cols-[260px_130px_180px_220px_220px_100px_180px] gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground">
                <span>{t('employee')}</span>
                <span>{t('idNo')}</span>
                <span>{t('hrUnit')}</span>
                <span>{t('department')}</span>
                <span>{t('position')}</span>
                <span>{t('gender')}</span>
                <span>{t('status')}</span>
              </div>
              {paginatedEmployees.map((employee) => {
                const amharicName = [employee.firstNameAm, employee.middleNameAm, employee.lastNameAm]
                  .filter(Boolean)
                  .join(' ');
                const sourceStatus = employee.sourceEmploymentStatus ?? employee.employmentStatus;

                return (
                  <div
                    key={employee.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/employees/${employee.id}?from=permanent-employees`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        router.push(`/employees/${employee.id}?from=permanent-employees`);
                      }
                    }}
                    className="grid cursor-pointer grid-cols-[260px_130px_180px_220px_220px_100px_180px] gap-3 border-b border-border px-4 py-4 text-sm outline-none transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{employee.firstNameEn} {employee.middleNameEn} {employee.lastNameEn}</p>
                      <p className="truncate text-xs text-muted-foreground">{amharicName || '-'}</p>
                    </div>
                    <div className="flex items-center">
                      <Badge variant="secondary">{employee.sourceIdNo ?? employee.employeeCode}</Badge>
                    </div>
                    <p className="truncate">{employee.hrUnit?.nameEn ?? '-'}</p>
                    <p className="truncate">{employee.department?.nameEn ?? employee.sourceDepartmentName ?? '-'}</p>
                    <div className="min-w-0">
                      <p className="truncate">{employee.positionName ?? employee.position?.nameEn ?? employee.sourcePositionName ?? t('noPosition')}</p>
                      <p className="truncate text-xs text-muted-foreground">{employee.sourcePositionCode ?? '-'}</p>
                    </div>
                    <p className="truncate">{employee.gender ?? '-'}</p>
                    <EmploymentStatusBadge value={sourceStatus} />
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

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('importPermanentEmployees')}</DialogTitle>
            <DialogDescription>{t('importPermanentEmployeesDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={importFile}>
            <div className="space-y-2">
              <Label>{t('hrUnit')}</Label>
              <Select value={selectedHrUnitId} onValueChange={setSelectedHrUnitId}>
                <SelectTrigger><SelectValue placeholder={t('hrUnitRequired')} /></SelectTrigger>
                <SelectContent>
                  {hrUnits.map((hrUnit) => (
                    <SelectItem key={hrUnit.id} value={hrUnit.id}>{hrUnit.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="permanent-employee-file">{t('excelFile')}</Label>
              <Input
                id="permanent-employee-file"
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
              />
            </div>

            {selectedFile ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <span className="min-w-0 truncate">{selectedFile.name}</span>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setImportDialogOpen(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={!selectedFile || !selectedHrUnitId || importPermanentEmployees.isPending}>
                <UploadCloud className="size-4" />
                {importPermanentEmployees.isPending ? t('importingPermanentEmployees') : t('importPermanentEmployees')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImportMetric({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'warning';
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-[11px] leading-none text-muted-foreground">{label}</p>
      <p className={tone === 'warning' ? 'mt-1 text-lg font-semibold text-amber-600' : 'mt-1 text-lg font-semibold'}>
        {value}
      </p>
    </div>
  );
}

function EmploymentStatusBadge({ value }: { value: string | null }) {
  const normalized = (value ?? '').trim().toLowerCase();
  const tone = normalized.includes('active') || normalized.includes('በስራ') || normalized.includes('ስራ ላይ')
    ? 'success'
    : normalized.includes('term') || normalized.includes('terminated') || normalized.includes('ተቋርጧል')
      ? 'danger'
      : normalized.includes('suspend') || normalized.includes('ታግዷል')
        ? 'warning'
        : 'neutral';

  const toneClasses = tone === 'success'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100'
    : tone === 'danger'
      ? 'border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100'
      : tone === 'warning'
        ? 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100'
        : 'border-border bg-muted/40 text-foreground';

  return (
    <div className={`flex items-center rounded-md border px-2 py-1 text-xs font-medium ${toneClasses}`}>
      <span className="truncate">{value || '-'}</span>
    </div>
  );
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}
