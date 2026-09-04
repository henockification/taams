'use client';

import { useParams } from 'next/navigation';

import { EmployeeDetailPage } from '@/components/employees/employee-detail-page';

export default function ContractEmployeeDetailRoute() {
  const params = useParams();
  return <EmployeeDetailPage employeeId={params.id as string} backHref="/contract-employees" />;
}
