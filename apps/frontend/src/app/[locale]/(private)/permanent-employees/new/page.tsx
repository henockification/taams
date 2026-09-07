import { EmployeeCreatePage } from '@/components/employees/employee-create-page';

export default function PermanentEmployeeCreateRoute() {
  return <EmployeeCreatePage employmentType="PERMANENT" backHref="/permanent-employees" />;
}
