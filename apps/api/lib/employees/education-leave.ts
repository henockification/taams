export const EDUCATION_LEAVE_TYPES = ['ABROAD', 'LOCAL'] as const;
export type EducationLeaveType = (typeof EDUCATION_LEAVE_TYPES)[number];

export type EducationLeaveFields = {
  educationLeaveType?: string | null;
  educationLeaveStart?: string | null;
  educationLeaveExpectedReturn?: string | null;
  educationLeaveReturnedOn?: string | null;
};

/**
 * True when the employee is away for education on this date: from the start date up
 * to the day before they returned. While on leave their attendance is not generated,
 * approved or sent to IFMIS.
 */
export function isOnEducationLeave(employee: EducationLeaveFields | null | undefined, date: string) {
  if (!employee?.educationLeaveType || !employee.educationLeaveStart) return false;
  const day = String(date).slice(0, 10);
  if (day < String(employee.educationLeaveStart).slice(0, 10)) return false;
  return !employee.educationLeaveReturnedOn || day < String(employee.educationLeaveReturnedOn).slice(0, 10);
}

/** Throws a user-facing message when the leave fields are inconsistent. */
export function assertValidEducationLeave(fields: EducationLeaveFields) {
  const { educationLeaveType: type, educationLeaveStart: start, educationLeaveExpectedReturn: expected, educationLeaveReturnedOn: returned } = fields;
  if (!type) {
    if (start || expected || returned) throw new Error('Choose abroad or local education leave, or clear the education leave dates');
    return;
  }
  if (!(EDUCATION_LEAVE_TYPES as readonly string[]).includes(type)) throw new Error('Education leave must be abroad or local');
  if (!start) throw new Error('Education leave start date is required');
  if (expected && expected < start) throw new Error('Expected return date must be on or after the education leave start date');
  if (returned && returned <= start) throw new Error('Return date must be after the education leave start date');
}
