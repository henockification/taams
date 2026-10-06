import type { BiometricExemption, Employee } from '../types/core.types';

type ExemptionMatch = Pick<BiometricExemption, 'employeeId' | 'positionId' | 'isActive'> & {
  effectiveFrom?: string | Date | null;
  effectiveTo?: string | Date | null;
  reviewDueAt?: string | Date | null;
};

/**
 * `asOfDate` (YYYY-MM-DD) is the day being evaluated, e.g. the attendance date, so
 * recalculating a past day uses the exemptions that applied on that day.
 */
export function resolveEmployeeBiometricExemptions(
  employee: Pick<Employee, 'id' | 'positionId'>,
  exemptions: ExemptionMatch[],
  asOfDate: string = new Date().toISOString().slice(0, 10),
) {
  const activeExemptions = exemptions.filter((exemption) => exemption.isActive
    && (!exemption.effectiveFrom || String(exemption.effectiveFrom).slice(0, 10) <= asOfDate)
    && (!exemption.effectiveTo || String(exemption.effectiveTo).slice(0, 10) >= asOfDate)
    && (!exemption.reviewDueAt || String(exemption.reviewDueAt).slice(0, 10) >= asOfDate));
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
  asOfDate?: string,
) {
  return resolveEmployeeBiometricExemptions(employee, exemptions, asOfDate).isExempt;
}
