'use client';

import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, CalendarCheck, Pencil, Plus, UserPlus, UserRoundCog } from 'lucide-react';
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
import { DepartmentCombobox } from '@/components/employees/department-combobox';
import { EmployeeDepartment } from '@/components/employees/employee-department';
import { DirectLeaveDialog } from '@/components/leave/direct-leave-dialog';
import { canRecordDirectLeave } from '@/config/app-navigation';
import { useSession } from '@/lib/auth-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Link, useRouter } from '@/i18n';
import { useEmployeeName } from '@/lib/employee-name';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';
import {
  useBiometricExemptions,
  useCreateEmployeeSupervisor,
  useDepartments,
  useEmployee,
  useEmployees,
  useEmployeeSupervisors,
  useConvertEmployeeToContract,
  useCreateEmployeeUserAccount,
  useSupervisorCandidates,
  useUpdateEmployee,
} from '@/data/hooks/core.hooks';
import type { AbsenceReason } from '@/data/types/core.types';
import { buildEmployeeProfileUpdate, toDraft, type ProfileDraft } from '@/lib/employee-profile-update';
import {
  displayEmploymentStatus,
  resolveEmploymentFields,
  SOURCE_EMPLOYMENT_STATUS_OPTIONS,
} from '@/lib/employment-status';

type EmployeeDetailPageProps = {
  employeeId: string;
  backHref: '/employees' | '/contract-employees' | '/permanent-employees';
};

export function EmployeeDetailPage({ employeeId, backHref }: EmployeeDetailPageProps) {
  const { formatDate } = useCalendarPreference();
  const t = useTranslations('core');
  const common = useTranslations('common');
  const employeeName = useEmployeeName();
  const { data: employeeResponse, isLoading } = useEmployee(employeeId);
  const { data: supervisorsResponse, isLoading: supervisorsLoading } = useEmployeeSupervisors(employeeId);
  const { data: employeesResponse } = useEmployees();
  const { data: departmentsResponse } = useDepartments();
  const { data: biometricExemptionsResponse } = useBiometricExemptions();
  const createSupervisor = useCreateEmployeeSupervisor();
  const updateEmployee = useUpdateEmployee();
  const createUserAccount = useCreateEmployeeUserAccount();
  const convertToContract = useConvertEmployeeToContract();
  const router = useRouter();
  const [convertOpen, setConvertOpen] = useState(false);
  const [directLeaveOpen, setDirectLeaveOpen] = useState(false);
  const session = useSession();
  const canMarkOnLeave = canRecordDirectLeave(session.data?.user);
  const [contractDepartmentId, setContractDepartmentId] = useState('');
  const [contractSupervisorId, setContractSupervisorId] = useState('');
  const { data: supervisorCandidatesResponse } = useSupervisorCandidates(convertOpen);
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

    try {
      await updateEmployee.mutateAsync({
        employeeId,
        ...buildEmployeeProfileUpdate(employee, draft, departments),
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

  // Employees added before accounts were created automatically have no login yet.
  const createAccount = async () => {
    try {
      await createUserAccount.mutateAsync(employeeId);
      notifications.show({
        title: common('success'),
        message: t('userAccountCreated'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('userAccountCreateFailed'),
        color: 'red',
      });
    }
  };

  // Permanent staff who resign and return on contract keep their record, contact details and login.
  const saveContractMove = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await convertToContract.mutateAsync({ employeeId, departmentId: contractDepartmentId, supervisorId: contractSupervisorId });
      setConvertOpen(false);
      notifications.show({
        title: common('success'),
        message: t('movedToContract'),
        color: 'green',
      });
      router.replace(`/contract-employees/${employeeId}`);
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('moveToContractFailed'),
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
            {employeeName(employee)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {employee.employeeCode} · {employee.email || employee.phoneNumber || t('noContact')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={resolveEmploymentFields(importedEmploymentStatus, employee.employmentStatus).isActive ? 'default' : 'secondary'}>
            {displayEmploymentStatus(importedEmploymentStatus, employee.employmentStatus)}
          </Badge>
          {isBiometricExempt ? (
            <Badge variant="outline" className="border-emerald-500 text-emerald-700 dark:text-emerald-400">
              {t('biometricExempt')}
            </Badge>
          ) : null}
          {employee.absenceReason ? (
            <Badge variant="outline" className="border-sky-500 text-sky-700 dark:text-sky-400">
              {t(`absenceReason${employee.absenceReason}`)}
            </Badge>
          ) : null}
          {!employee.userId ? (
            <>
              <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">
                {t('noUserAccount')}
              </Badge>
              <Button
                type="button"
                size="sm"
                onClick={createAccount}
                disabled={createUserAccount.isPending || !employee.email || !employee.phoneNumber}
                title={!employee.email || !employee.phoneNumber ? t('userAccountNeedsContact') : undefined}
              >
                <UserPlus className="size-4" />
                {createUserAccount.isPending ? t('creatingUserAccount') : t('createUserAccount')}
              </Button>
            </>
          ) : null}
        </div>
      </div>
      {!employee.userId && (!employee.email || !employee.phoneNumber) ? (
        <p className="-mt-3 text-xs text-muted-foreground lg:text-right">{t('userAccountNeedsContact')}</p>
      ) : null}

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
              <div className="flex flex-wrap gap-2">
                {employee.employmentType === 'PERMANENT' ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setContractDepartmentId('');
                      setContractSupervisorId('');
                      setConvertOpen(true);
                    }}
                  >
                    <ArrowRightLeft className="size-4" />
                    {t('moveToContract')}
                  </Button>
                ) : null}
                {canMarkOnLeave ? (
                  <Button type="button" variant="outline" onClick={() => setDirectLeaveOpen(true)}>
                    <CalendarCheck className="size-4" />
                    {t('markOnLeave')}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" onClick={startEditing}>
                  <Pencil className="size-4" />
                  {t('editEmployee')}
                </Button>
              </div>
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
            <Field label={t('department')} editing={isEditing} value={<EmployeeDepartment employeeId={employee.id} department={departmentName} showPeriod />}>
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
              value={displayEmploymentStatus(importedEmploymentStatus, employee.employmentStatus)}
            >
              <Select
                value={draft?.sourceEmploymentStatus}
                onValueChange={(value) => patchDraft({ sourceEmploymentStatus: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {employmentStatusSelectOptions(draft?.sourceEmploymentStatus).map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
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
            <Field
              label={t('absenceReason')}
              editing={isEditing}
              value={employee.absenceReason ? t(`absenceReason${employee.absenceReason}`) : t('absenceReasonNone')}
            >
              <Select
                value={draft?.absenceReason || 'NONE'}
                onValueChange={(value) => patchDraft({ absenceReason: value === 'NONE' ? '' : value as AbsenceReason })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">{t('absenceReasonNone')}</SelectItem>
                  <SelectItem value="EDUCATION">{t('absenceReasonEDUCATION')}</SelectItem>
                  <SelectItem value="WORK_ABROAD">{t('absenceReasonWORK_ABROAD')}</SelectItem>
                  <SelectItem value="LEAVE_WITHOUT_PAY">{t('absenceReasonLEAVE_WITHOUT_PAY')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {isEditing ? (
              <p className="text-xs text-muted-foreground sm:col-span-2">{t('absenceReasonHint')}</p>
            ) : null}
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
                        {employeeName(assignment.supervisor)}
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

      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('moveToContract')}</DialogTitle>
            <DialogDescription>{t('moveToContractDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveContractMove}>
            <div className="space-y-2">
              <Label htmlFor="contract-department">{t('contractNewDepartment')}</Label>
              <DepartmentCombobox
                id="contract-department"
                departments={departments}
                isContract
                value={contractDepartmentId}
                onChange={setContractDepartmentId}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('contractNewSupervisor')}</Label>
              <Select value={contractSupervisorId} onValueChange={setContractSupervisorId}>
                <SelectTrigger><SelectValue placeholder={t('selectSupervisor')} /></SelectTrigger>
                <SelectContent>
                  {(supervisorCandidatesResponse?.employees ?? [])
                    .filter((option) => option.id !== employeeId)
                    .map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {employeeName(option)} - {option.employeeCode}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">{t('moveToContractNote')}</p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConvertOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={!contractDepartmentId || !contractSupervisorId || convertToContract.isPending}>
                {convertToContract.isPending ? t('saving') : t('moveToContract')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                      {employeeName(option)} - {option.employeeCode}
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

      {canMarkOnLeave ? (
        <DirectLeaveDialog employee={employee} open={directLeaveOpen} onOpenChange={setDirectLeaveOpen} />
      ) : null}
    </div>
  );
}

function employmentStatusSelectOptions(currentValue?: string) {
  const options = SOURCE_EMPLOYMENT_STATUS_OPTIONS.map((option) => option.value);
  if (currentValue && !options.includes(currentValue as (typeof options)[number])) {
    return [currentValue, ...options];
  }
  return options;
}

function Field({
  label,
  value,
  editing = true,
  children,
}: {
  label: string;
  value?: ReactNode;
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

function Info({ label, value }: { label: string; value?: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || '-'}</p>
    </div>
  );
}
