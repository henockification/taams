import type { Department, Employee, CreateEmployeeInput } from '../data/types/core.types';
import { canonicalSourceEmploymentStatus, resolveEmploymentFields } from './employment-status';

export type ProfileDraft = {
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
  sourceEmploymentStatus: string;
  hireDate: string;
  terminationDate: string;
  salary: string;
  salaryStep: string;
  nationalId: string;
  paidByIfmis: boolean;
};

export function toDraft(employee: Employee): ProfileDraft {
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
    sourceEmploymentStatus: canonicalSourceEmploymentStatus(employee.sourceEmploymentStatus, employee.employmentStatus),
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

function profileFields(draft: ProfileDraft, departmentName: string | null) {
  return {
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
    sourceDepartmentName: departmentName,
    positionName: emptyToNull(draft.positionName),
    sourcePositionName: emptyToNull(draft.positionName),
    sourcePositionCode: emptyToNull(draft.sourcePositionCode),
    ...resolveEmploymentFields(draft.sourceEmploymentStatus),
    hireDate: emptyToNull(draft.hireDate),
    terminationDate: emptyToNull(draft.terminationDate),
    salary: emptyToNull(draft.salary),
    salaryStep: emptyToNull(draft.salaryStep),
    nationalId: emptyToNull(draft.nationalId),
    paidByIfmis: draft.paidByIfmis,
  };
}

export function buildEmployeeProfileUpdate(employee: Employee, draft: ProfileDraft, departments: Department[]): Partial<CreateEmployeeInput> {
  const departmentName = (departmentId: string) => departments.find((department) => department.id === departmentId)?.nameEn ?? employee.sourceDepartmentName;
  const before = profileFields(toDraft(employee), departmentName(employee.departmentId));
  const after = profileFields(draft, departmentName(draft.departmentId));
  return Object.fromEntries(Object.entries(after).filter(([key, value]) => value !== before[key as keyof typeof before]));
}
