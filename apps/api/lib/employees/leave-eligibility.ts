export function assertContractLeaveEmployee(employee: { employmentType: string } | null | undefined) {
  if (!employee) throw new Error('Employee not found');
  if (employee.employmentType !== 'CONTRACT') {
    throw new Error('Leave Management is available only for contract employees');
  }
}
