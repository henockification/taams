import type { Employee } from '@/data/types/core.types';

export function matchesEmployeePickerSearch(employee: Employee, search: string) {
  const terms = search.normalize('NFKC').trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const text = [
    employee.firstNameEn,
    employee.middleNameEn,
    employee.lastNameEn,
    employee.firstNameAm,
    employee.middleNameAm,
    employee.lastNameAm,
    employee.employeeCode,
    employee.payrollId,
    employee.biometricId,
    employee.email,
    employee.phoneNumber,
    employee.department?.nameEn,
    employee.department?.nameAm,
    employee.sourceDepartmentName,
  ].filter(Boolean).join(' ').normalize('NFKC').toLowerCase();

  return terms.every((term) => text.includes(term));
}
