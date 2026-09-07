'use client';

import type { FormEvent, ReactNode } from 'react';
import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { CalendarDateField } from '@/components/calendar/calendar-date-field';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Link, useRouter } from '@/i18n';
import { useCreateEmployee, useDepartments, usePositions } from '@/data/hooks/core.hooks';
import type { EmploymentStatus, EmploymentType } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

type EmployeeCreatePageProps = {
  employmentType: Extract<EmploymentType, 'PERMANENT' | 'CONTRACT'>;
  backHref: '/permanent-employees' | '/contract-employees';
};

type EmployeeCreateForm = {
  employeeCode: string;
  payrollId: string;
  biometricId: string;
  firstNameEn: string;
  middleNameEn: string;
  lastNameEn: string;
  firstNameAm: string;
  middleNameAm: string;
  lastNameAm: string;
  gender: string;
  phoneNumber: string;
  email: string;
  departmentId: string;
  positionId: string;
  positionName: string;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  terminationDate: string;
  salary: string;
  salaryStep: string;
  nationalId: string;
  sourceIdNo: string;
  sourceEmployeeCode: string;
  sourceEmploymentStatus: string;
  sourcePositionCode: string;
  paidByIfmis: boolean;
};

const noneValue = '__none';
const genderOptions = ['MALE', 'FEMALE'];
const employmentStatuses: EmploymentStatus[] = ['ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED'];

const initialForm: EmployeeCreateForm = {
  employeeCode: '',
  payrollId: '',
  biometricId: '',
  firstNameEn: '',
  middleNameEn: '',
  lastNameEn: '',
  firstNameAm: '',
  middleNameAm: '',
  lastNameAm: '',
  gender: '',
  phoneNumber: '',
  email: '',
  departmentId: '',
  positionId: '',
  positionName: '',
  employmentStatus: 'ACTIVE',
  hireDate: '',
  terminationDate: '',
  salary: '',
  salaryStep: '',
  nationalId: '',
  sourceIdNo: '',
  sourceEmployeeCode: '',
  sourceEmploymentStatus: '',
  sourcePositionCode: '',
  paidByIfmis: true,
};

export function EmployeeCreatePage({ employmentType, backHref }: EmployeeCreatePageProps) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const router = useRouter();
  const createEmployee = useCreateEmployee();
  const { data: departmentsResponse, isLoading: departmentsLoading } = useDepartments();
  const { data: positionsResponse, isLoading: positionsLoading } = usePositions();
  const [form, setForm] = useState<EmployeeCreateForm>(initialForm);

  const departments = departmentsResponse?.departments ?? [];
  const positions = positionsResponse?.positions ?? [];
  const selectedDepartment = departments.find((department) => department.id === form.departmentId);
  const selectedPosition = positions.find((position) => position.id === form.positionId);
  const canSave = Boolean(
    form.employeeCode.trim()
    && form.firstNameEn.trim()
    && form.lastNameEn.trim()
    && form.email.trim()
    && form.phoneNumber.trim()
    && form.departmentId
  );

  const patchForm = (patch: Partial<EmployeeCreateForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const saveEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) return;

    try {
      const response = await createEmployee.mutateAsync({
        employeeCode: form.employeeCode.trim(),
        payrollId: emptyToNull(form.payrollId),
        biometricId: emptyToNull(form.biometricId),
        firstNameEn: form.firstNameEn.trim(),
        middleNameEn: emptyToNull(form.middleNameEn),
        lastNameEn: form.lastNameEn.trim(),
        firstNameAm: emptyToNull(form.firstNameAm),
        middleNameAm: emptyToNull(form.middleNameAm),
        lastNameAm: emptyToNull(form.lastNameAm),
        gender: emptyToNull(form.gender),
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim(),
        departmentId: form.departmentId,
        sourceDepartmentName: selectedDepartment?.nameEn ?? null,
        positionId: form.positionId || null,
        positionName: emptyToNull(form.positionName) ?? selectedPosition?.nameEn ?? null,
        sourcePositionName: emptyToNull(form.positionName) ?? selectedPosition?.nameEn ?? null,
        sourcePositionCode: emptyToNull(form.sourcePositionCode) ?? selectedPosition?.code ?? null,
        employmentStatus: form.employmentStatus,
        employmentType,
        hireDate: emptyToNull(form.hireDate),
        terminationDate: emptyToNull(form.terminationDate),
        salary: emptyToNull(form.salary),
        salaryStep: emptyToNull(form.salaryStep),
        nationalId: emptyToNull(form.nationalId),
        sourceIdNo: emptyToNull(form.sourceIdNo),
        sourceEmployeeCode: emptyToNull(form.sourceEmployeeCode),
        sourceEmploymentStatus: emptyToNull(form.sourceEmploymentStatus) ?? form.employmentStatus,
        paidByIfmis: form.paidByIfmis,
        isActive: form.employmentStatus === 'ACTIVE',
      });

      notifications.show({
        title: common('success'),
        message: t('employeeCreatedWithUser'),
        color: 'green',
      });
      router.push(`${backHref}/${response.employee.id}`);
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="outline" asChild className="w-fit">
          <Link href={backHref}>
            <ArrowLeft className="size-4" />
            {common('back')}
          </Link>
        </Button>
        <div className="min-w-0 sm:text-right">
          <p className="text-sm font-medium text-foreground">{t('addEmployee')}</p>
          <p className="text-xs text-muted-foreground">{t(`employmentType${employmentType}`)}</p>
        </div>
      </div>

      <form className="space-y-6" onSubmit={saveEmployee}>
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{t('employeeProfile')}</CardTitle>
            <CardDescription>{t('addEmployeeDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label={t('employeeCode')} id="employee-code" required>
              <Input id="employee-code" value={form.employeeCode} onChange={(event) => patchForm({ employeeCode: event.target.value })} required />
            </Field>
            <Field label={t('email')} id="employee-email" required>
              <Input id="employee-email" type="email" value={form.email} onChange={(event) => patchForm({ email: event.target.value })} required />
            </Field>
            <Field label={t('phoneNumber')} id="employee-phone" required>
              <Input id="employee-phone" value={form.phoneNumber} onChange={(event) => patchForm({ phoneNumber: event.target.value })} required />
            </Field>
            <Field label={t('firstNameEn')} id="first-name-en" required>
              <Input id="first-name-en" value={form.firstNameEn} onChange={(event) => patchForm({ firstNameEn: event.target.value })} required />
            </Field>
            <Field label={t('middleNameEn')} id="middle-name-en">
              <Input id="middle-name-en" value={form.middleNameEn} onChange={(event) => patchForm({ middleNameEn: event.target.value })} />
            </Field>
            <Field label={t('lastNameEn')} id="last-name-en" required>
              <Input id="last-name-en" value={form.lastNameEn} onChange={(event) => patchForm({ lastNameEn: event.target.value })} required />
            </Field>
            <Field label={t('firstNameAm')} id="first-name-am">
              <Input id="first-name-am" value={form.firstNameAm} onChange={(event) => patchForm({ firstNameAm: event.target.value })} />
            </Field>
            <Field label={t('middleNameAm')} id="middle-name-am">
              <Input id="middle-name-am" value={form.middleNameAm} onChange={(event) => patchForm({ middleNameAm: event.target.value })} />
            </Field>
            <Field label={t('lastNameAm')} id="last-name-am">
              <Input id="last-name-am" value={form.lastNameAm} onChange={(event) => patchForm({ lastNameAm: event.target.value })} />
            </Field>
            <Field label={t('gender')} id="employee-gender">
              <Select value={form.gender || noneValue} onValueChange={(value) => patchForm({ gender: value === noneValue ? '' : value })}>
                <SelectTrigger id="employee-gender"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('notSpecified')}</SelectItem>
                  {genderOptions.map((gender) => <SelectItem key={gender} value={gender}>{gender}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('nationalId')} id="national-id">
              <Input id="national-id" value={form.nationalId} onChange={(event) => patchForm({ nationalId: event.target.value })} />
            </Field>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{t('organization')}</CardTitle>
            <CardDescription>{t('organizationDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label={t('department')} id="employee-department" required>
              <Select value={form.departmentId} onValueChange={(departmentId) => patchForm({ departmentId })} disabled={departmentsLoading}>
                <SelectTrigger id="employee-department"><SelectValue placeholder={t('selectDepartment')} /></SelectTrigger>
                <SelectContent>
                  {departments.map((department) => <SelectItem key={department.id} value={department.id}>{department.nameEn}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('position')} id="employee-position">
              <Select value={form.positionId || noneValue} onValueChange={(value) => patchForm({ positionId: value === noneValue ? '' : value })} disabled={positionsLoading}>
                <SelectTrigger id="employee-position"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={noneValue}>{t('noPosition')}</SelectItem>
                  {positions.map((position) => <SelectItem key={position.id} value={position.id}>{position.nameEn}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('positionName')} id="position-name">
              <Input id="position-name" value={form.positionName} onChange={(event) => patchForm({ positionName: event.target.value })} placeholder={selectedPosition?.nameEn ?? ''} />
            </Field>
            <Field label={t('positionCode')} id="position-code">
              <Input id="position-code" value={form.sourcePositionCode} onChange={(event) => patchForm({ sourcePositionCode: event.target.value })} placeholder={selectedPosition?.code ?? ''} />
            </Field>
            <Field label={t('employmentStatus')} id="employment-status">
              <Select value={form.employmentStatus} onValueChange={(value) => patchForm({ employmentStatus: value as EmploymentStatus })}>
                <SelectTrigger id="employment-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {employmentStatuses.map((status) => <SelectItem key={status} value={status}>{t(status.toLowerCase() as 'active')}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t('hireDate')} id="hire-date">
              <CalendarDateField id="hire-date" value={form.hireDate} onChange={(hireDate) => patchForm({ hireDate })} />
            </Field>
            <Field label={t('terminationDate')} id="termination-date">
              <CalendarDateField id="termination-date" value={form.terminationDate} onChange={(terminationDate) => patchForm({ terminationDate })} />
            </Field>
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>{t('additionalDetails')}</CardTitle>
            <CardDescription>{t('additionalDetailsDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label={t('payrollId')} id="payroll-id">
              <Input id="payroll-id" value={form.payrollId} onChange={(event) => patchForm({ payrollId: event.target.value })} />
            </Field>
            <Field label={t('biometricId')} id="biometric-id">
              <Input id="biometric-id" value={form.biometricId} onChange={(event) => patchForm({ biometricId: event.target.value })} />
            </Field>
            <Field label={t('idNo')} id="source-id-no">
              <Input id="source-id-no" value={form.sourceIdNo} onChange={(event) => patchForm({ sourceIdNo: event.target.value })} />
            </Field>
            <Field label={t('sourceEmployeeCode')} id="source-employee-code">
              <Input id="source-employee-code" value={form.sourceEmployeeCode} onChange={(event) => patchForm({ sourceEmployeeCode: event.target.value })} />
            </Field>
            <Field label={t('sourceEmploymentStatus')} id="source-employment-status">
              <Input id="source-employment-status" value={form.sourceEmploymentStatus} onChange={(event) => patchForm({ sourceEmploymentStatus: event.target.value })} />
            </Field>
            <Field label={t('salary')} id="salary">
              <Input id="salary" value={form.salary} onChange={(event) => patchForm({ salary: event.target.value })} />
            </Field>
            <Field label={t('step')} id="salary-step">
              <Input id="salary-step" value={form.salaryStep} onChange={(event) => patchForm({ salaryStep: event.target.value })} />
            </Field>
            <div className="flex items-end">
              <div className="flex w-full items-center justify-between rounded-md border border-border px-3 py-2">
                <Label>{t('paidByIfmis')}</Label>
                <Switch checked={form.paidByIfmis} onCheckedChange={(paidByIfmis) => patchForm({ paidByIfmis })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href={backHref}>{common('cancel')}</Link>
          </Button>
          <Button type="submit" disabled={!canSave || createEmployee.isPending}>
            <Save className="size-4" />
            {createEmployee.isPending ? common('loading') : common('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, id, children, required = false }: { label: ReactNode; id: string; children: ReactNode; required?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function emptyToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
