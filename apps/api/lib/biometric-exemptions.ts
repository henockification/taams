import type { BiometricExemption, Employee } from '../types/core.types';

type ExemptionMatch = Pick<BiometricExemption, 'employeeId' | 'positionId' | 'isActive'>;

export function resolveEmployeeBiometricExemptions(
  employee: Pick<Employee, 'id' | 'positionId'>,
  exemptions: ExemptionMatch[],
) {
  const activeExemptions = exemptions.filter((exemption) => exemption.isActive);
  const matches = activeExemptions.filter((exemption) => (
    (exemption.employeeId !== null && exemption.employeeId === employee.id)
    || (exemption.positionId !== null && employee.positionId !== null && exemption.positionId === employee.positionId)
  ));

  return {
    isExempt: matches.length > 0,
    matches,
  };
}

export function isEmployeeBiometricExempt(
  employee: Pick<Employee, 'id' | 'positionId'>,
  exemptions: ExemptionMatch[],
) {
  return resolveEmployeeBiometricExemptions(employee, exemptions).isExempt;
}
