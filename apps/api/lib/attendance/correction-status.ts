/**
 * Attendance corrections are decided by the employee's supervisor only.
 * New requests start as PENDING_REVIEW; the other values are legacy states from
 * the former HR-review step that are still awaiting a supervisor decision.
 */
export const PENDING_CORRECTION_STATUSES = ['PENDING_REVIEW', 'PENDING_HR_REVIEW', 'HR_REVIEWED', 'PENDING'];
