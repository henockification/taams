export type LeaveRequestView = 'self' | 'approvals';

type LeaveRequestVisibilityRow = {
  employeeId: string;
  requestedBy: string;
  employee?: { userId?: string | null } | null;
};

type SupervisorAssignmentVisibilityRow = {
  employeeId: string;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
};

export function filterLeaveRequestsByView<T extends LeaveRequestVisibilityRow>(
  requests: T[],
  view: LeaveRequestView,
  actorUserId: string,
  approvalEmployeeIds: Iterable<string> = [],
) {
  if (view === 'self') {
    return requests.filter((request) => (
      request.requestedBy === actorUserId && request.employee?.userId === actorUserId
    ));
  }

  const visibleEmployeeIds = new Set(approvalEmployeeIds);
  return requests.filter((request) => (
    visibleEmployeeIds.has(request.employeeId) && request.requestedBy !== actorUserId
  ));
}

export function effectivePrimaryEmployeeIds(
  assignments: SupervisorAssignmentVisibilityRow[],
  referenceDate: string,
) {
  return assignments
    .filter((assignment) => (
      assignment.isPrimary
      && assignment.effectiveFrom <= referenceDate
      && (!assignment.effectiveTo || assignment.effectiveTo >= referenceDate)
    ))
    .map((assignment) => assignment.employeeId);
}
