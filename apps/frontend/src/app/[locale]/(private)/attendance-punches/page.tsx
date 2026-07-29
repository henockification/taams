'use client';

import { useMemo, useState } from 'react';
import { Clock3, ListFilter, ScanLine } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
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
  useAttendancePunches,
  useEmployeeAttendancePunches,
  useEmployees,
  useUnprocessedAttendancePunches,
} from '@/data/hooks/core.hooks';
import type { Employee } from '@/data/types/core.types';

const allEmployeesValue = '__all';

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
  const [mode, setMode] = useState<'all' | 'unprocessed'>('all');
  const [employeeId, setEmployeeId] = useState('');

  const allPunches = useAttendancePunches();
  const unprocessedPunches = useUnprocessedAttendancePunches();
  const employeePunches = useEmployeeAttendancePunches(employeeId);
  const { data: employeesResponse } = useEmployees();
  const { data: biometricExemptionsResponse } = useBiometricExemptions();

  const employees = employeesResponse?.employees ?? [];
  const biometricExemptions = biometricExemptionsResponse?.biometricExemptions ?? [];
  const exemptEmployeeIds = useMemo(
    () => new Set(biometricExemptions.filter((exemption) => exemption.isActive && exemption.employeeId).map((exemption) => exemption.employeeId as string)),
    [biometricExemptions],
  );
  const exemptPositionIds = useMemo(
    () => new Set(biometricExemptions.filter((exemption) => exemption.isActive && exemption.positionId).map((exemption) => exemption.positionId as string)),
    [biometricExemptions],
  );
  const selectedQuery = employeeId ? employeePunches : mode === 'unprocessed' ? unprocessedPunches : allPunches;
  const punches = selectedQuery.data?.attendancePunches ?? [];
  const unprocessedCount = unprocessedPunches.data?.attendancePunches.length ?? 0;
  const processedCount = useMemo(() => (allPunches.data?.attendancePunches ?? []).filter((punch) => punch.isProcessed).length, [allPunches.data]);
  const isExemptEmployee = (employee?: Employee | null) => Boolean(
    employee && (exemptEmployeeIds.has(employee.id) || (employee.positionId ? exemptPositionIds.has(employee.positionId) : false)),
  );

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="grid gap-2 sm:grid-cols-3">
        <Summary label={t('allPunches')} value={allPunches.data?.attendancePunches.length ?? 0} />
        <Summary label={t('unprocessed')} value={unprocessedCount} />
        <Summary label={t('processed')} value={processedCount} />
      </div>

      <Card className="rounded-lg">
        <CardHeader className="gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle>{t('punchReview')}</CardTitle>
            <CardDescription>{t('punchReviewDescription')}</CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Tabs value={mode} onValueChange={(value) => setMode(value as 'all' | 'unprocessed')}>
              <TabsList>
                <TabsTrigger value="all"><Clock3 className="size-4" />{t('allPunches')}</TabsTrigger>
                <TabsTrigger value="unprocessed"><ListFilter className="size-4" />{t('unprocessed')}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Select value={employeeId || allEmployeesValue} onValueChange={(value) => setEmployeeId(value === allEmployeesValue ? '' : value)}>
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
          </div>
        </CardHeader>
        <CardContent>
          {selectedQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : punches.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title={mode === 'unprocessed' && !employeeId ? t('noUnprocessedPunches') : t('noAttendancePunches')}
              description={mode === 'unprocessed' && !employeeId ? t('noUnprocessedPunchesDescription') : t('noAttendancePunchesDescription')}
            />
          ) : (
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
