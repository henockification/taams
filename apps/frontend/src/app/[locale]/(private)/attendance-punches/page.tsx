'use client';

import { useMemo, useState } from 'react';
import { Clock3, ListFilter, ScanLine } from 'lucide-react';
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
import { EmptyState } from '@/components/ui/empty-state';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useBiometricExemptions,
  useAttendancePunchesPaginated,
  useBiometricDevices,
  useEmployees,
} from '@/data/hooks/core.hooks';
import type { Employee } from '@/data/types/core.types';

const allEmployeesValue = '__all';
const allDevicesValue = '__all';

function formatDateTime(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

export default function AttendancePunchesPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const [employeeId, setEmployeeId] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [status, setStatus] = useState<'all' | 'processed' | 'unprocessed'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const punchesQuery = useAttendancePunchesPaginated({
    page,
    pageSize,
    employeeId: employeeId || undefined,
    deviceId: deviceId || undefined,
    status: status === 'all' ? undefined : status,
  });
  const { data: employeesResponse } = useEmployees();
  const { data: devicesResponse } = useBiometricDevices();
  const { data: biometricExemptionsResponse } = useBiometricExemptions();

  const employees = employeesResponse?.employees ?? [];
  const devices = devicesResponse?.biometricDevices ?? [];
  const biometricExemptions = biometricExemptionsResponse?.biometricExemptions ?? [];
  const exemptEmployeeIds = useMemo(
    () => new Set(biometricExemptions.filter((exemption) => exemption.isActive && exemption.employeeId).map((exemption) => exemption.employeeId as string)),
    [biometricExemptions],
  );
  const exemptPositionIds = useMemo(
    () => new Set(biometricExemptions.filter((exemption) => exemption.isActive && exemption.positionId).map((exemption) => exemption.positionId as string)),
    [biometricExemptions],
  );
  const punches = punchesQuery.data?.attendancePunches ?? [];
  const pagination = punchesQuery.data?.pagination;
  const totalRecords = pagination?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));
  const startIndex = totalRecords === 0 ? 0 : (page - 1) * pageSize + 1;
  const endIndex = Math.min(page * pageSize, totalRecords);
  const isExemptEmployee = (employee?: Employee | null) => Boolean(
    employee && (exemptEmployeeIds.has(employee.id) || (employee.positionId ? exemptPositionIds.has(employee.positionId) : false)),
  );

  function resetToFirstPage() {
    setPage(1);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="grid gap-2 sm:grid-cols-3">
        <Summary label={t('records')} value={totalRecords} />
        <Summary label={t('page')} value={page} />
        <Summary label={t('pageSize')} value={pageSize} />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{t('punchReview')}</CardTitle>
            <CardDescription>{t('punchReviewDescription')}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row">
            <Tabs
              value={status}
              onValueChange={(value) => {
                setStatus(value as 'all' | 'processed' | 'unprocessed');
                resetToFirstPage();
              }}
            >
              <TabsList>
                <TabsTrigger value="all"><Clock3 className="size-4" />{t('allPunches')}</TabsTrigger>
                <TabsTrigger value="unprocessed"><ListFilter className="size-4" />{t('unprocessed')}</TabsTrigger>
                <TabsTrigger value="processed"><ListFilter className="size-4" />{t('processed')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select
              value={employeeId || allEmployeesValue}
              onValueChange={(value) => {
                setEmployeeId(value === allEmployeesValue ? '' : value);
                resetToFirstPage();
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder={t('selectEmployee')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allEmployeesValue}>{t('allPunches')}</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employeeName(employee)} · {employee.employeeCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={deviceId || allDevicesValue}
              onValueChange={(value) => {
                setDeviceId(value === allDevicesValue ? '' : value);
                resetToFirstPage();
              }}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder={t('selectDevice')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={allDevicesValue}>{t('allDevices')}</SelectItem>
                {devices.map((device) => (
                  <SelectItem key={device.id} value={device.id}>
                    {device.deviceName} · {device.deviceCode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {punchesQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : punches.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title={status === 'unprocessed' ? t('noUnprocessedPunches') : t('noAttendancePunches')}
              description={status === 'unprocessed' ? t('noUnprocessedPunchesDescription') : t('noAttendancePunchesDescription')}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <div className="overflow-hidden rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('punchTime')}</TableHead>
                      <TableHead>{t('employee')}</TableHead>
                      <TableHead>{t('biometricId')}</TableHead>
                      <TableHead>{t('device')}</TableHead>
                      <TableHead>{t('punchType')}</TableHead>
                      <TableHead>{t('source')}</TableHead>
                      <TableHead>{t('status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {punches.map((punch) => (
                      <TableRow key={punch.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(punch.punchTime)}</TableCell>
                        <TableCell>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{employeeName(punch.employee) || t('unknown')}</p>
                            <p className="truncate text-xs text-muted-foreground">{punch.employee?.employeeCode ?? '-'}</p>
                            {isExemptEmployee(punch.employee) ? (
                              <Badge variant="outline" className="mt-1 border-emerald-500 text-emerald-700 dark:text-emerald-400">
                                {t('biometricExempt')}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{punch.biometricId}</TableCell>
                        <TableCell>{punch.device?.deviceName ?? '-'}</TableCell>
                        <TableCell><Badge variant="secondary">{punch.punchType}</Badge></TableCell>
                        <TableCell>{punch.source}</TableCell>
                        <TableCell>
                          <Badge variant={punch.isProcessed ? 'default' : 'secondary'}>
                            {punch.isProcessed ? t('processed') : t('notProcessed')}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>{totalRecords === 0 ? t('noRows') : `${t('showing')} ${startIndex}-${endIndex} ${t('of')} ${totalRecords}`}</span>
                <div className="flex items-center gap-2">
                  <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[25, 50, 100, 200].map((size) => (
                        <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1}>
                    {common('previous')}
                  </Button>
                  <span className="whitespace-nowrap">{page} / {totalPages}</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages}>
                    {common('next')}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold">{value}</p>
    </div>
  );
}
