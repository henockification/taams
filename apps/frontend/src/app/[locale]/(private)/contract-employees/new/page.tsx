import { EmployeeCreatePage } from '@/components/employees/employee-create-page';

export default function ContractEmployeeCreateRoute() {
  return <EmployeeCreatePage employmentType="CONTRACT" backHref="/contract-employees" />;
}
