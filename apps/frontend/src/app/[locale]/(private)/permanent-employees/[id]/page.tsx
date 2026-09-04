'use client';

import { useParams } from 'next/navigation';

import { EmployeeDetailPage } from '@/components/employees/employee-detail-page';

export default function PermanentEmployeeDetailRoute() {
  const params = useParams();
  return <EmployeeDetailPage employeeId={params.id as string} backHref="/permanent-employees" />;
}
