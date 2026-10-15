export const ABSENCE_REASONS = ['EDUCATION', 'WORK_ABROAD', 'LEAVE_WITHOUT_PAY'] as const;
export type AbsenceReason = (typeof ABSENCE_REASONS)[number];

/**
 * True when the employee is flagged as away indefinitely (education, work abroad or leave
 * without pay). While flagged, their attendance is not generated, approved or sent to
 * IFMIS; clearing the flag makes them active again.
 */
export function isIndefinitelyAbsent(employee: { absenceReason?: string | null } | null | undefined) {
  return Boolean(employee?.absenceReason);
}

/** Throws a user-facing message when the absence reason is not one of the known values. */
export function assertValidAbsenceReason(reason: string | null | undefined) {
  if (reason && !(ABSENCE_REASONS as readonly string[]).includes(reason)) {
    throw new Error('Absence reason must be education, work abroad or leave without pay');
  }
}
