export type LeaveRequestView = 'self' | 'approvals' | 'authorizations';

type LeaveRequestVisibilityRow = {
  employeeId: string;
  requestedBy: string;
  status?: string;
  employee?: { userId?: string | null } | null;
  interruptions?: Array<{ status?: string }>;
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

  if (view === 'authorizations') {
    const authorizationStatuses = new Set(['APPROVED', 'AUTHORIZED', 'AUTHORIZATION_REJECTED']);
    return requests.filter((request) => (
      authorizationStatuses.has(request.status ?? '')
      || request.interruptions?.some((interruption) => authorizationStatuses.has(interruption.status ?? ''))
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
