'use client';

import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Plus, UserRoundCog } from 'lucide-react';
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
import { CalendarDateField } from '@/components/calendar/calendar-date-field';
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
  useDepartments,
  useEmployee,
  useEmployees,
  useEmployeeSupervisors,
  useUpdateEmployee,
} from '@/data/hooks/core.hooks';
import type { Employee, EmploymentStatus } from '@/data/types/core.types';

type EmployeeDetailPageProps = {
  employeeId: string;
  backHref: '/employees' | '/contract-employees' | '/permanent-employees';
};

type ProfileDraft = {
  firstNameEn: string;
  middleNameEn: string;
  lastNameEn: string;
  firstNameAm: string;
  middleNameAm: string;
  lastNameAm: string;
  payrollId: string;
  biometricId: string;
  gender: string;
  phoneNumber: string;
  email: string;
  departmentId: string;
  positionName: string;
  sourcePositionCode: string;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  terminationDate: string;
  salary: string;
  salaryStep: string;
  nationalId: string;
  paidByIfmis: boolean;
};

const employmentStatuses: EmploymentStatus[] = ['ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED'];

export function EmployeeDetailPage({ employeeId, backHref }: EmployeeDetailPageProps) {
  const { formatDate } = useCalendarPreference();
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { data: employeeResponse, isLoading } = useEmployee(employeeId);
  const { data: supervisorsResponse, isLoading: supervisorsLoading } = useEmployeeSupervisors(employeeId);
  const { data: employeesResponse } = useEmployees();
  const { data: departmentsResponse } = useDepartments();
  const { data: biometricExemptionsResponse } = useBiometricExemptions();
  const createSupervisor = useCreateEmployeeSupervisor();
  const updateEmployee = useUpdateEmployee();
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [supervisorId, setSupervisorId] = useState('');
  const [isPrimary, setIsPrimary] = useState(true);
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

  const employee = employeeResponse?.employee;
  const supervisors = supervisorsResponse?.supervisors ?? [];
  const departments = departmentsResponse?.departments ?? [];
  const biometricExemptions = biometricExemptionsResponse?.biometricExemptions ?? [];
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

  const startEditing = () => {
    if (!employee) return;
    setDraft(toDraft(employee));
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setDraft(null);
    setIsEditing(false);
  };

  const patchDraft = (patch: Partial<ProfileDraft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const saveProfile = async () => {
    if (!employee || !draft) return;
    if (!draft.firstNameEn.trim() || !draft.lastNameEn.trim()) return;

    const selectedDepartment = departments.find((department) => department.id === draft.departmentId);

    try {
      await updateEmployee.mutateAsync({
        employeeId,
        firstNameEn: draft.firstNameEn.trim(),
        middleNameEn: emptyToNull(draft.middleNameEn),
        lastNameEn: draft.lastNameEn.trim(),
        firstNameAm: emptyToNull(draft.firstNameAm),
        middleNameAm: emptyToNull(draft.middleNameAm),
        lastNameAm: emptyToNull(draft.lastNameAm),
        payrollId: emptyToNull(draft.payrollId),
        biometricId: emptyToNull(draft.biometricId),
        gender: emptyToNull(draft.gender),
        phoneNumber: emptyToNull(draft.phoneNumber),
        email: emptyToNull(draft.email),
        departmentId: draft.departmentId,
        sourceDepartmentName: selectedDepartment?.nameEn ?? employee.sourceDepartmentName,
        positionName: emptyToNull(draft.positionName),
        sourcePositionName: emptyToNull(draft.positionName),
        sourcePositionCode: emptyToNull(draft.sourcePositionCode),
        employmentStatus: draft.employmentStatus,
        isActive: draft.employmentStatus === 'ACTIVE',
        hireDate: emptyToNull(draft.hireDate),
        terminationDate: emptyToNull(draft.terminationDate),
        salary: emptyToNull(draft.salary),
        salaryStep: emptyToNull(draft.salaryStep),
        nationalId: emptyToNull(draft.nationalId),
        paidByIfmis: draft.paidByIfmis,
      });
      setIsEditing(false);
      setDraft(null);
      notifications.show({
        title: common('success'),
        message: t('employeeUpdated'),
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

  const canSave = Boolean(draft?.firstNameEn.trim() && draft.lastNameEn.trim() && draft.departmentId);

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
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>{t('employeeProfile')}</CardTitle>
              <CardDescription>{t('employeeProfileDescription')}</CardDescription>
            </div>
            {isEditing ? (
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={cancelEditing} disabled={updateEmployee.isPending}>
                  {common('cancel')}
                </Button>
                <Button type="button" onClick={saveProfile} disabled={!canSave || updateEmployee.isPending}>
                  {updateEmployee.isPending ? t('saving') : common('save')}
                </Button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={startEditing}>
                <Pencil className="size-4" />
                {t('editEmployee')}
              </Button>
            )}
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {isEditing && draft ? (
              <>
                <Field label={t('firstNameEn')}>
                  <Input value={draft.firstNameEn} onChange={(event) => patchDraft({ firstNameEn: event.target.value })} required />
                </Field>
                <Field label={t('middleNameEn')}>
                  <Input value={draft.middleNameEn} onChange={(event) => patchDraft({ middleNameEn: event.target.value })} />
                </Field>
                <Field label={t('lastNameEn')}>
                  <Input value={draft.lastNameEn} onChange={(event) => patchDraft({ lastNameEn: event.target.value })} required />
                </Field>
              </>
            ) : (
              <Info label={t('englishFullName')} value={englishFullName} />
            )}
            <Info label={t('idNo')} value={employee.sourceIdNo ?? employee.employeeCode} />
            <Info label={t('employeeCode')} value={employee.employeeCode} />
            <Field label={t('payrollId')} editing={isEditing} value={employee.payrollId}>
              <Input value={draft?.payrollId ?? ''} onChange={(event) => patchDraft({ payrollId: event.target.value })} />
            </Field>
            <Field label={t('biometricId')} editing={isEditing} value={employee.biometricId}>
              <Input value={draft?.biometricId ?? ''} onChange={(event) => patchDraft({ biometricId: event.target.value })} />
            </Field>
            <Field label={t('nationalId')} editing={isEditing} value={employee.nationalId}>
              <Input value={draft?.nationalId ?? ''} onChange={(event) => patchDraft({ nationalId: event.target.value })} />
            </Field>
            <Field label={t('firstNameAm')} editing={isEditing} value={employee.firstNameAm}>
              <Input value={draft?.firstNameAm ?? ''} onChange={(event) => patchDraft({ firstNameAm: event.target.value })} />
            </Field>
            <Field label={t('middleNameAm')} editing={isEditing} value={employee.middleNameAm}>
              <Input value={draft?.middleNameAm ?? ''} onChange={(event) => patchDraft({ middleNameAm: event.target.value })} />
            </Field>
            <Field label={t('lastNameAm')} editing={isEditing} value={employee.lastNameAm}>
              <Input value={draft?.lastNameAm ?? ''} onChange={(event) => patchDraft({ lastNameAm: event.target.value })} />
            </Field>
            <Field label={t('gender')} editing={isEditing} value={employee.gender}>
              <Input value={draft?.gender ?? ''} onChange={(event) => patchDraft({ gender: event.target.value })} />
            </Field>
            <Field label={t('phoneNumber')} editing={isEditing} value={employee.phoneNumber}>
              <Input value={draft?.phoneNumber ?? ''} onChange={(event) => patchDraft({ phoneNumber: event.target.value })} />
            </Field>
            <Field label={t('email')} editing={isEditing} value={employee.email}>
              <Input type="email" value={draft?.email ?? ''} onChange={(event) => patchDraft({ email: event.target.value })} />
            </Field>
            <Field label={t('department')} editing={isEditing} value={departmentName}>
              <Select value={draft?.departmentId} onValueChange={(departmentId) => patchDraft({ departmentId })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('selectDepartment')} />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>{department.nameEn}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('position')} editing={isEditing} value={positionName}>
              <Input value={draft?.positionName ?? ''} onChange={(event) => patchDraft({ positionName: event.target.value })} />
            </Field>
            <Field label={t('positionCode')} editing={isEditing} value={positionCode}>
              <Input value={draft?.sourcePositionCode ?? ''} onChange={(event) => patchDraft({ sourcePositionCode: event.target.value })} />
            </Field>
            <Info label={t('employmentType')} value={employee.employmentType} />
            <Field
              label={t('employmentStatus')}
              editing={isEditing}
              value={importedEmploymentStatus ?? employee.employmentStatus}
            >
              <Select
                value={draft?.employmentStatus}
                onValueChange={(value) => patchDraft({ employmentStatus: value as EmploymentStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employmentStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{employmentStatusLabel(status, t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('hireDate')} editing={isEditing} value={formatDate(employee.hireDate)}>
              <CalendarDateField value={draft?.hireDate ?? ''} onChange={(hireDate) => patchDraft({ hireDate })} />
            </Field>
            <Field label={t('terminationDate')} editing={isEditing} value={formatDate(employee.terminationDate)}>
              <CalendarDateField value={draft?.terminationDate ?? ''} onChange={(terminationDate) => patchDraft({ terminationDate })} />
            </Field>
            <Field label={t('salary')} editing={isEditing} value={employee.salary}>
              <Input value={draft?.salary ?? ''} onChange={(event) => patchDraft({ salary: event.target.value })} />
            </Field>
            <Field label={t('step')} editing={isEditing} value={employee.salaryStep}>
              <Input value={draft?.salaryStep ?? ''} onChange={(event) => patchDraft({ salaryStep: event.target.value })} />
            </Field>
            <Field
              label={t('paidByIfmis')}
              editing={isEditing}
              value={employee.paidByIfmis === false ? common('no') : common('yes')}
            >
              <div className="flex h-9 items-center">
                <Switch
                  checked={draft?.paidByIfmis ?? true}
                  onCheckedChange={(paidByIfmis) => patchDraft({ paidByIfmis })}
                />
              </div>
            </Field>
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
                <CalendarDateField value={effectiveFrom} onChange={setEffectiveFrom} />
              </div>
              <div className="space-y-2">
                <Label>{t('effectiveTo')}</Label>
                <CalendarDateField value={effectiveTo} onChange={setEffectiveTo} />
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

function toDraft(employee: Employee): ProfileDraft {
  return {
    firstNameEn: employee.firstNameEn,
    middleNameEn: employee.middleNameEn ?? '',
    lastNameEn: employee.lastNameEn,
    firstNameAm: employee.firstNameAm ?? '',
    middleNameAm: employee.middleNameAm ?? '',
    lastNameAm: employee.lastNameAm ?? '',
    payrollId: employee.payrollId ?? '',
    biometricId: employee.biometricId ?? '',
    gender: employee.gender ?? '',
    phoneNumber: employee.phoneNumber ?? '',
    email: employee.email ?? '',
    departmentId: employee.departmentId,
    positionName: employee.positionName ?? employee.position?.nameEn ?? employee.sourcePositionName ?? '',
    sourcePositionCode: employee.sourcePositionCode ?? employee.sourceEmployeeCode ?? '',
    employmentStatus: employee.employmentStatus,
    hireDate: employee.hireDate ?? '',
    terminationDate: employee.terminationDate ?? '',
    salary: employee.salary ?? '',
    salaryStep: employee.salaryStep ?? '',
    nationalId: employee.nationalId ?? '',
    paidByIfmis: employee.paidByIfmis ?? true,
  };
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function employmentStatusLabel(status: EmploymentStatus, t: (key: string) => string) {
  switch (status) {
    case 'ACTIVE':
      return t('active');
    case 'INACTIVE':
      return t('inactive');
    case 'TERMINATED':
      return t('terminated');
    case 'SUSPENDED':
      return t('suspended');
  }
}

function Field({
  label,
  value,
  editing = true,
  children,
}: {
  label: string;
  value?: string | null;
  editing?: boolean;
  children: ReactNode;
}) {
  if (!editing) return <Info label={label} value={value} />;

  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      {children}
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
