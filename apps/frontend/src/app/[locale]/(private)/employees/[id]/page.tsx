'use client';

import { FormEvent, useMemo, useState } from 'react';
import { ArrowLeft, Plus, UserRoundCog } from 'lucide-react';
import { useParams, useSearchParams } from 'next/navigation';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Link } from '@/i18n';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';
import {
  useBiometricExemptions,
  useCreateEmployeeSupervisor,
  useEmployee,
  useEmployees,
  useEmployeeSupervisors,
} from '@/data/hooks/core.hooks';

export default function EmployeeDetailPage() {
  const { formatDate } = useCalendarPreference();
  const params = useParams();
  const searchParams = useSearchParams();
  const employeeId = params.id as string;
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { data: employeeResponse, isLoading } = useEmployee(employeeId);
  const { data: supervisorsResponse, isLoading: supervisorsLoading } = useEmployeeSupervisors(employeeId);
  const { data: employeesResponse } = useEmployees();
  const { data: biometricExemptionsResponse } = useBiometricExemptions();
  const createSupervisor = useCreateEmployeeSupervisor();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supervisorId, setSupervisorId] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

  const employee = employeeResponse?.employee;
  const supervisors = supervisorsResponse?.supervisors ?? [];
  const biometricExemptions = biometricExemptionsResponse?.biometricExemptions ?? [];
  const backHref = searchParams.get('from') === 'permanent-employees' ? '/permanent-employees' : '/employees';
  const englishFullName = employee
    ? [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ')
    : null;
  const departmentName = employee?.department?.nameEn ?? employee?.sourceDepartmentName ?? null;
  const positionName = employee?.positionName ?? employee?.position?.nameEn ?? employee?.sourcePositionName ?? null;
  const positionCode = employee?.sourcePositionCode ?? employee?.sourceEmployeeCode ?? null;
  const importedEmploymentStatus = employee?.sourceEmploymentStatus ?? null;
  const isBiometricExempt = Boolean(
    employee && biometricExemptions.some((exemption) => exemption.isActive && (
      exemption.employeeId === employee.id
      || (employee.positionId && exemption.positionId === employee.positionId)
    )),
  );
  const employeeOptions = useMemo(() => {
    return (employeesResponse?.employees ?? []).filter((option) => option.id !== employeeId);
  }, [employeeId, employeesResponse?.employees]);

  const saveSupervisor = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      await createSupervisor.mutateAsync({
        employeeId,
        supervisorId,
        isPrimary,
        effectiveFrom: effectiveFrom || undefined,
        effectiveTo: effectiveTo || null,
      });
      setDialogOpen(false);
      setSupervisorId('');
      setEffectiveFrom('');
      setEffectiveTo('');
      setIsPrimary(true);
      notifications.show({
        title: common('success'),
        message: t('supervisorAssigned'),
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

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loadingEmployees')}</p>;
  }

  if (!employee) {
    return (
      <div className="flex w-full flex-col gap-4">
        <Button variant="outline" asChild className="w-fit">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            {common('back')}
          </Link>
        </Button>
        <Card className="rounded-lg">
          <CardContent className="flex min-h-72 items-center justify-center">
            <p className="text-sm text-muted-foreground">{t('employeeNotFound')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 rounded-lg border border-border bg-card p-4 lg:flex-row lg:items-center">
        <Button variant="outline" asChild className="w-fit">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            {common('back')}
          </Link>
        </Button>
        <div className="min-w-0 flex-1 lg:text-right">
          <p className="truncate text-sm font-medium text-foreground">
            {employee.firstNameEn} {employee.middleNameEn} {employee.lastNameEn}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {employee.employeeCode} · {employee.email || employee.phoneNumber || t('noContact')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={employee.employmentStatus === 'ACTIVE' ? 'default' : 'secondary'}>
            {employee.employmentStatus}
          </Badge>
          {isBiometricExempt ? (
            <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400">
              {t('biometricExempt')}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{t('employeeProfile')}</CardTitle>
            <CardDescription>{t('employeeProfileDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Info label={t('englishFullName')} value={englishFullName} />
            <Info label={t('idNo')} value={employee.sourceIdNo ?? employee.employeeCode} />
            <Info label={t('employeeCode')} value={employee.employeeCode} />
            <Info label={t('payrollId')} value={employee.payrollId} />
            <Info label={t('biometricId')} value={employee.biometricId} />
            <Info label={t('firstNameAm')} value={employee.firstNameAm} />
            <Info label={t('middleNameAm')} value={employee.middleNameAm} />
            <Info label={t('lastNameAm')} value={employee.lastNameAm} />
            <Info label={t('gender')} value={employee.gender} />
            <Info label={t('phoneNumber')} value={employee.phoneNumber} />
            <Info label={t('email')} value={employee.email} />
            <Info label={t('department')} value={departmentName} />
            <Info label={t('position')} value={positionName} />
            <Info label={t('positionCode')} value={positionCode} />
            <Info label={t('employmentType')} value={employee.employmentType} />
            <Info label={t('employmentStatus')} value={importedEmploymentStatus ?? employee.employmentStatus} />
            <Info label={t('hireDate')} value={formatDate(employee.hireDate)} />
            <Info label={t('terminationDate')} value={formatDate(employee.terminationDate)} />
            <Info label={t('salary')} value={employee.salary} />
            <Info label={t('step')} value={employee.salaryStep} />
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="gap-4">
            <div>
              <CardTitle>{t('supervisors')}</CardTitle>
              <CardDescription>{t('supervisorsDescription')}</CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="w-full">
              <Plus className="size-4" />
              {t('assignSupervisor')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {supervisorsLoading ? (
              <p className="text-sm text-muted-foreground">{t('loadingEmployees')}</p>
            ) : supervisors.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noSupervisors')}</p>
            ) : (
              supervisors.map((assignment) => (
                <div key={assignment.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                      <UserRoundCog className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {assignment.supervisor?.firstNameEn} {assignment.supervisor?.lastNameEn}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(assignment.effectiveFrom)} {assignment.effectiveTo ? `- ${formatDate(assignment.effectiveTo)}` : ''}
                      </p>
                    </div>
                  </div>
                  <Badge variant={assignment.isPrimary ? 'default' : 'outline'} className="shrink-0">
                    {assignment.isPrimary ? t('primary') : t('secondary')}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('assignSupervisor')}</DialogTitle>
            <DialogDescription>{t('assignSupervisorDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveSupervisor}>
            <div className="space-y-2">
              <Label>{t('supervisor')}</Label>
              <Select value={supervisorId} onValueChange={setSupervisorId}>
                <SelectTrigger><SelectValue placeholder={t('selectSupervisor')} /></SelectTrigger>
                <SelectContent>
                  {employeeOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.firstNameEn} {option.lastNameEn} - {option.employeeCode}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('effectiveFrom')}</Label>
                <Input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t('effectiveTo')}</Label>
                <Input type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>{t('primary')}</Label>
              <Switch checked={isPrimary} onCheckedChange={setIsPrimary} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={!supervisorId || createSupervisor.isPending}>
                {createSupervisor.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || '-'}</p>
    </div>
  );
}
