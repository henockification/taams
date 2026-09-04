'use client';

import { ImportedEmployeesPage } from '@/components/employees/imported-employees-page';

export default function ContractEmployeesPage() {
  return (
    <ImportedEmployeesPage
      kind="contract"
      employmentType="CONTRACT"
      detailBasePath="/contract-employees"
    />
  );
}
