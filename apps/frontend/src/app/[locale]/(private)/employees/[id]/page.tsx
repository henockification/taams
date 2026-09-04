'use client';

import { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

import { EmployeeDetailPage } from '@/components/employees/employee-detail-page';
import { useRouter } from '@/i18n';

export default function ContractEmployeeDetailRoute() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const employeeId = params.id as string;
  const fromPermanentEmployees = searchParams.get('from') === 'permanent-employees';

  useEffect(() => {
    if (fromPermanentEmployees) {
      router.replace(`/permanent-employees/${employeeId}`);
    }
  }, [employeeId, fromPermanentEmployees, router]);

  if (fromPermanentEmployees) return null;

  return <EmployeeDetailPage employeeId={employeeId} backHref="/employees" />;
}
