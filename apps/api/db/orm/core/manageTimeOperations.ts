import { and, count, eq, inArray, isNull, notInArray, or } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendancePunches,
  attendanceSyncBatches,
  biometricDevices,
  employees,
  employeeSupervisors,
  leaveRequests,
  manualPunchRequests,
} from '../../schema';

type TimeOperationSeverity = 'critical' | 'warning' | 'info' | 'success';
type TimeOperationStatus = 'CLEAR' | 'WATCH' | 'ACTION_REQUIRED';
type TimeOperationType =
  | 'MANUAL_PUNCH_APPROVAL'
  | 'LEAVE_REQUEST_APPROVAL'
  | 'UNPROCESSED_PUNCHES'
  | 'DEVICE_HEALTH'
  | 'SYNC_FAILURE'
  | 'DEVICE_SETUP'
  | 'ALL_CLEAR';

type TimeOperationItem = {
  id: string;
  type: TimeOperationType;
  severity: TimeOperationSeverity;
  title: string;
  description: string;
  count: number;
  actionLabel: string;
  actionHref: string;
  occurredAt: Date | null;
  metadata?: Record<string, unknown>;
};

type TimeOperationCounts = {
  pendingManualPunchRequests: number;
  pendingLeaveRequests: number;
  unprocessedAttendancePunches: number;
  criticalDeviceIssues: number;
  unknownDevices: number;
  syncFailures: number;
  deviceSetupNeeded: number;
};

type TimeOperationsScope =
  | { role: 'SUPER_ADMIN' }
  | { role: 'MANAGER'; employeeId: string; directReportIds: string[] }
  | { role: 'EMPLOYEE'; employeeId: string }
  | { role: 'SETUP_REQUIRED' };

type DashboardUser = {
  id: string;
  role?: string[] | null;
};

const MANAGER_ROLE_NAMES = ['supervisor', 'admin', 'super_admin', 'superadmin'];

export async function getTimeOperationsSummary(scope: TimeOperationsScope = { role: 'SUPER_ADMIN' }) {
  if (scope.role === 'MANAGER') {
    return getManagerTimeOperationsSummary(scope.directReportIds);
  }

  if (scope.role === 'EMPLOYEE') {
    return getEmployeeTimeOperationsSummary(scope.employeeId);
  }

  if (scope.role === 'SETUP_REQUIRED') {
    return buildSummary([], emptyCounts(), 'Employee profile setup needed');
  }

  return getSuperAdminTimeOperationsSummary();
}

export async function getTimeOperationsSummaryForUser(user: DashboardUser) {
  const scope = await getTimeOperationsScopeForUser(user);
  return getTimeOperationsSummary(scope);
}

async function getSuperAdminTimeOperationsSummary() {
  const [
    pendingManualPunchCount,
    pendingLeaveRequestCount,
    unprocessedPunchCount,
    criticalDeviceIssueCount,
    unknownDeviceCount,
    syncFailureCount,
    setupNeededCount,
    pendingManualPunches,
    pendingLeaveRequestItems,
    unprocessedPunches,
    deviceIssues,
    syncFailures,
    setupDevices,
  ] = await Promise.all([
    getCount(manualPunchRequests, eq(manualPunchRequests.status, 'PENDING_HR_REVIEW')),
    getCount(leaveRequests, eq(leaveRequests.status, 'PENDING')),
    getCount(attendancePunches, eq(attendancePunches.isProcessed, false)),
    getCount(
      biometricDevices,
      and(
        eq(biometricDevices.isActive, true),
        inArray(biometricDevices.healthStatus, ['OFFLINE', 'ERROR']),
      ),
    ),
    getCount(
      biometricDevices,
      and(eq(biometricDevices.isActive, true), eq(biometricDevices.healthStatus, 'UNKNOWN')),
    ),
    getCount(
      attendanceSyncBatches,
      inArray(attendanceSyncBatches.syncStatus, ['FAILED', 'PARTIAL']),
    ),
    getCount(
      biometricDevices,
      and(
        eq(biometricDevices.isActive, true),
        isNull(biometricDevices.lastSeenAt),
        notInArray(biometricDevices.integrationMode, ['MANUAL_ONLY', 'DISABLED']),
        or(eq(biometricDevices.pushEnabled, true), eq(biometricDevices.pullEnabled, true)),
      ),
    ),
    db.query.manualPunchRequests.findMany({
      where: eq(manualPunchRequests.status, 'PENDING_HR_REVIEW'),
      with: {
        employee: {
          with: {
            department: true,
          },
        },
      },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit: 3,
    }),
    db.query.leaveRequests.findMany({
      where: eq(leaveRequests.status, 'PENDING'),
      with: {
        employee: {
          with: {
            department: true,
          },
        },
        leaveType: true,
      },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit: 3,
    }),
    db.query.attendancePunches.findMany({
      where: eq(attendancePunches.isProcessed, false),
      with: {
        employee: true,
        device: true,
      },
      orderBy: (table, { asc }) => [asc(table.punchTime)],
      limit: 3,
    }),
    db.query.biometricDevices.findMany({
      where: and(
        eq(biometricDevices.isActive, true),
        inArray(biometricDevices.healthStatus, ['OFFLINE', 'ERROR']),
      ),
      orderBy: (table, { desc }) => [desc(table.lastFailedSyncAt), desc(table.updatedAt)],
      limit: 3,
    }),
    db.query.attendanceSyncBatches.findMany({
      where: inArray(attendanceSyncBatches.syncStatus, ['FAILED', 'PARTIAL']),
      with: {
        device: true,
      },
      orderBy: (table, { desc }) => [desc(table.syncStartedAt)],
      limit: 3,
    }),
    db.query.biometricDevices.findMany({
      where: and(
        eq(biometricDevices.isActive, true),
        isNull(biometricDevices.lastSeenAt),
        notInArray(biometricDevices.integrationMode, ['MANUAL_ONLY', 'DISABLED']),
        or(eq(biometricDevices.pushEnabled, true), eq(biometricDevices.pullEnabled, true)),
      ),
      orderBy: (table, { asc }) => [asc(table.deviceName)],
      limit: 3,
    }),
  ]);

  return buildSummary([
    buildManualPunchItem(pendingManualPunchCount, pendingManualPunches),
    buildLeaveRequestItem(pendingLeaveRequestCount, pendingLeaveRequestItems),
    buildDeviceHealthItem(criticalDeviceIssueCount, unknownDeviceCount, deviceIssues),
    buildUnprocessedPunchItem(unprocessedPunchCount, unprocessedPunches),
    buildSyncFailureItem(syncFailureCount, syncFailures),
    buildDeviceSetupItem(setupNeededCount, setupDevices),
  ].filter(Boolean) as TimeOperationItem[], {
    pendingManualPunchRequests: pendingManualPunchCount,
    pendingLeaveRequests: pendingLeaveRequestCount,
    unprocessedAttendancePunches: unprocessedPunchCount,
    criticalDeviceIssues: criticalDeviceIssueCount,
    unknownDevices: unknownDeviceCount,
    syncFailures: syncFailureCount,
    deviceSetupNeeded: setupNeededCount,
  });
}

async function getManagerTimeOperationsSummary(directReportIds: string[]) {
  if (directReportIds.length === 0) {
    return buildSummary([], emptyCounts(), 'Your team time operations are clear');
  }

  const [pendingManualPunchCount, pendingLeaveRequestCount, unprocessedPunchCount, pendingManualPunches, pendingLeaveRequestItems, unprocessedPunches] = await Promise.all([
    getCount(
      manualPunchRequests,
      and(
        inArray(manualPunchRequests.employeeId, directReportIds),
        inArray(manualPunchRequests.status, ['PENDING_HR_REVIEW', 'HR_REVIEWED', 'PENDING']),
      ),
    ),
    getCount(
      leaveRequests,
      and(
        inArray(leaveRequests.employeeId, directReportIds),
        eq(leaveRequests.status, 'PENDING'),
      ),
    ),
    getCount(
      attendancePunches,
      and(
        inArray(attendancePunches.employeeId, directReportIds),
        eq(attendancePunches.isProcessed, false),
      ),
    ),
    db.query.manualPunchRequests.findMany({
      where: and(
        inArray(manualPunchRequests.employeeId, directReportIds),
        inArray(manualPunchRequests.status, ['PENDING_HR_REVIEW', 'HR_REVIEWED', 'PENDING']),
      ),
      with: {
        employee: {
          with: {
            department: true,
          },
        },
      },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit: 3,
    }),
    db.query.leaveRequests.findMany({
      where: and(
        inArray(leaveRequests.employeeId, directReportIds),
        eq(leaveRequests.status, 'PENDING'),
      ),
      with: {
        employee: {
          with: {
            department: true,
          },
        },
        leaveType: true,
      },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit: 3,
    }),
    db.query.attendancePunches.findMany({
      where: and(
        inArray(attendancePunches.employeeId, directReportIds),
        eq(attendancePunches.isProcessed, false),
      ),
      with: {
        employee: true,
        device: true,
      },
      orderBy: (table, { asc }) => [asc(table.punchTime)],
      limit: 3,
    }),
  ]);

  return buildSummary([
    buildManualPunchItem(pendingManualPunchCount, pendingManualPunches),
    buildLeaveRequestItem(pendingLeaveRequestCount, pendingLeaveRequestItems, 'Review team leave requests'),
    buildUnprocessedPunchItem(unprocessedPunchCount, unprocessedPunches, 'Review team punch queue'),
  ].filter(Boolean) as TimeOperationItem[], {
    ...emptyCounts(),
    pendingManualPunchRequests: pendingManualPunchCount,
    pendingLeaveRequests: pendingLeaveRequestCount,
    unprocessedAttendancePunches: unprocessedPunchCount,
  }, 'Your team time operations are clear');
}

async function getEmployeeTimeOperationsSummary(employeeId: string) {
  const [pendingRequestCount, pendingLeaveRequestCount, pendingRequests, pendingLeaveRequestItems] = await Promise.all([
    getCount(
      manualPunchRequests,
      and(
        eq(manualPunchRequests.employeeId, employeeId),
        or(eq(manualPunchRequests.status, 'PENDING_HR_REVIEW'), eq(manualPunchRequests.status, 'HR_REVIEWED')),
      ),
    ),
    getCount(
      leaveRequests,
      and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.status, 'PENDING'),
      ),
    ),
    db.query.manualPunchRequests.findMany({
      where: and(
        eq(manualPunchRequests.employeeId, employeeId),
        or(eq(manualPunchRequests.status, 'PENDING_HR_REVIEW'), eq(manualPunchRequests.status, 'HR_REVIEWED')),
      ),
      with: {
        employee: true,
      },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit: 3,
    }),
    db.query.leaveRequests.findMany({
      where: and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.status, 'PENDING'),
      ),
      with: {
        leaveType: true,
      },
      orderBy: (table, { asc }) => [asc(table.createdAt)],
      limit: 3,
    }),
  ]);

  return buildSummary([
    buildEmployeeManualPunchItem(pendingRequestCount, pendingRequests),
    buildEmployeeLeaveRequestItem(pendingLeaveRequestCount, pendingLeaveRequestItems),
  ].filter(Boolean) as TimeOperationItem[], {
    ...emptyCounts(),
    pendingManualPunchRequests: pendingRequestCount,
    pendingLeaveRequests: pendingLeaveRequestCount,
  }, 'Your time requests are clear');
}

async function getTimeOperationsScopeForUser(user: DashboardUser): Promise<TimeOperationsScope> {
  const roles = normalizeRoles(user.role);

  if (roles.includes('super_admin')) {
    return { role: 'SUPER_ADMIN' };
  }

  const employee = await db.query.employees.findFirst({
    where: eq(employees.userId, user.id),
  });

  if (!employee) {
    return { role: 'SETUP_REQUIRED' };
  }

  const directReports = await db.query.employeeSupervisors.findMany({
    where: eq(employeeSupervisors.supervisorId, employee.id),
  });
  const isManager = roles.some((role) => MANAGER_ROLE_NAMES.includes(role)) || directReports.length > 0;

  if (isManager) {
    return {
      role: 'MANAGER',
      employeeId: employee.id,
      directReportIds: directReports.map((assignment) => assignment.employeeId),
    };
  }

  return { role: 'EMPLOYEE', employeeId: employee.id };
}

async function getCount(table: any, where: any) {
  const [result] = await db.select({ value: count() }).from(table).where(where);
  return Number(result?.value ?? 0);
}

function buildManualPunchItem(countValue: number, requests: any[]): TimeOperationItem | null {
  if (countValue === 0) return null;

  const firstRequest = requests[0];
  const employeeName = firstRequest?.employee ? formatEmployeeName(firstRequest.employee) : null;

  return {
    id: 'manual-punch-approvals',
    type: 'MANUAL_PUNCH_APPROVAL',
    severity: 'warning',
    title: `${countValue} manual punch ${pluralize(countValue, 'request')} pending`,
    description: employeeName
      ? `Oldest request is from ${employeeName} and needs approval or rejection.`
      : 'Employees are waiting for manual punch approvals.',
    count: countValue,
    actionLabel: 'Review requests',
    actionHref: '/attendance-correction-approvals',
    occurredAt: firstRequest?.createdAt ?? null,
    metadata: {
      previewIds: requests.map((request) => request.id),
    },
  };
}

function buildEmployeeManualPunchItem(countValue: number, requests: any[]): TimeOperationItem | null {
  if (countValue === 0) return null;

  const firstRequest = requests[0];

  return {
    id: 'my-manual-punch-requests',
    type: 'MANUAL_PUNCH_APPROVAL',
    severity: 'info',
    title: `${countValue} manual punch ${pluralize(countValue, 'request')} awaiting review`,
    description: 'Your correction request is waiting for supervisor approval.',
    count: countValue,
    actionLabel: 'View my requests',
    actionHref: '/attendance-corrections',
    occurredAt: firstRequest?.createdAt ?? null,
    metadata: {
      previewIds: requests.map((request) => request.id),
    },
  };
}

function buildLeaveRequestItem(countValue: number, requests: any[], actionLabel = 'Review leave requests'): TimeOperationItem | null {
  if (countValue === 0) return null;

  const firstRequest = requests[0];
  const employeeName = firstRequest?.employee ? formatEmployeeName(firstRequest.employee) : null;
  const leaveType = firstRequest?.leaveType?.nameEn ?? 'leave';

  return {
    id: 'leave-request-approvals',
    type: 'LEAVE_REQUEST_APPROVAL',
    severity: 'warning',
    title: `${countValue} leave ${pluralize(countValue, 'request')} pending`,
    description: employeeName
      ? `Oldest ${leaveType} request is from ${employeeName} and needs approval or rejection.`
      : 'Employees are waiting for leave request approvals.',
    count: countValue,
    actionLabel,
    actionHref: '/annual-leave-requests',
    occurredAt: firstRequest?.createdAt ?? null,
    metadata: {
      previewIds: requests.map((request) => request.id),
    },
  };
}

function buildEmployeeLeaveRequestItem(countValue: number, requests: any[]): TimeOperationItem | null {
  if (countValue === 0) return null;

  const firstRequest = requests[0];

  return {
    id: 'my-leave-requests',
    type: 'LEAVE_REQUEST_APPROVAL',
    severity: 'info',
    title: `${countValue} leave ${pluralize(countValue, 'request')} awaiting review`,
    description: 'Your leave request is waiting for supervisor approval.',
    count: countValue,
    actionLabel: 'View my leave requests',
    actionHref: '/leave-request-approvals',
    occurredAt: firstRequest?.createdAt ?? null,
    metadata: {
      previewIds: requests.map((request) => request.id),
    },
  };
}

function buildUnprocessedPunchItem(
  countValue: number,
  punches: any[],
  actionLabel = 'Open punch queue',
): TimeOperationItem | null {
  if (countValue === 0) return null;

  const firstPunch = punches[0];
  const deviceName = firstPunch?.device?.deviceName ?? 'a biometric device';

  return {
    id: 'unprocessed-attendance-punches',
    type: 'UNPROCESSED_PUNCHES',
    severity: countValue > 25 ? 'warning' : 'info',
    title: `${countValue} unprocessed ${pluralize(countValue, 'punch', 'punches')}`,
    description: `Oldest unprocessed punch came from ${deviceName}.`,
    count: countValue,
    actionLabel,
    actionHref: '/attendance-punches',
    occurredAt: firstPunch?.punchTime ?? null,
    metadata: {
      previewIds: punches.map((punch) => punch.id),
    },
  };
}

function buildDeviceHealthItem(
  criticalCount: number,
  unknownCount: number,
  devices: any[],
): TimeOperationItem | null {
  const total = criticalCount + unknownCount;
  if (total === 0) return null;

  const firstDevice = devices[0];
  const severity: TimeOperationSeverity = criticalCount > 0 ? 'critical' : 'info';

  return {
    id: 'biometric-device-health',
    type: 'DEVICE_HEALTH',
    severity,
    title: criticalCount > 0
      ? `${criticalCount} biometric ${pluralize(criticalCount, 'device')} offline or errored`
      : `${unknownCount} biometric ${pluralize(unknownCount, 'device')} waiting for health check`,
    description: firstDevice
      ? `${firstDevice.deviceName} is marked ${firstDevice.healthStatus}.`
      : 'Some biometric devices have not reported a healthy status yet.',
    count: total,
    actionLabel: 'Check devices',
    actionHref: '/biometric-devices',
    occurredAt: firstDevice?.lastFailedSyncAt ?? firstDevice?.updatedAt ?? null,
    metadata: {
      criticalCount,
      unknownCount,
      previewIds: devices.map((device) => device.id),
    },
  };
}

function buildSyncFailureItem(countValue: number, batches: any[]): TimeOperationItem | null {
  if (countValue === 0) return null;

  const firstBatch = batches[0];
  const deviceName = firstBatch?.device?.deviceName ?? 'a biometric device';

  return {
    id: 'attendance-sync-failures',
    type: 'SYNC_FAILURE',
    severity: 'critical',
    title: `${countValue} failed or partial sync ${pluralize(countValue, 'batch', 'batches')}`,
    description: `Latest issue was reported by ${deviceName}.`,
    count: countValue,
    actionLabel: 'View sync history',
    actionHref: '/biometric-devices',
    occurredAt: firstBatch?.syncStartedAt ?? null,
    metadata: {
      previewIds: batches.map((batch) => batch.id),
    },
  };
}

function buildDeviceSetupItem(countValue: number, devices: any[]): TimeOperationItem | null {
  if (countValue === 0) return null;

  const firstDevice = devices[0];

  return {
    id: 'biometric-device-setup',
    type: 'DEVICE_SETUP',
    severity: 'info',
    title: `${countValue} active ${pluralize(countValue, 'device')} not seen yet`,
    description: firstDevice
      ? `${firstDevice.deviceName} is active but has not pushed or pulled attendance yet.`
      : 'Some active biometric devices still need their first successful connection.',
    count: countValue,
    actionLabel: 'Finish setup',
    actionHref: '/biometric-devices',
    occurredAt: firstDevice?.createdAt ?? null,
    metadata: {
      previewIds: devices.map((device) => device.id),
    },
  };
}

function buildSummary(items: TimeOperationItem[], counts: TimeOperationCounts, clearHeadline = 'Time operations are clear') {
  const sortedItems = items.sort((a, b) => getSeverityRank(a.severity) - getSeverityRank(b.severity));
  const fullCounts = {
    ...counts,
    totalOpenItems: counts.pendingManualPunchRequests
      + counts.pendingLeaveRequests
      + counts.unprocessedAttendancePunches
      + counts.criticalDeviceIssues
      + counts.unknownDevices
      + counts.syncFailures
      + counts.deviceSetupNeeded,
  };
  const status = resolveStatus(sortedItems);

  if (sortedItems.length === 0) {
    sortedItems.push({
      id: 'all-clear',
      type: 'ALL_CLEAR',
      severity: 'success',
      title: clearHeadline,
      description: 'No role-specific approvals, punch queues, or reminders need attention.',
      count: 0,
      actionLabel: 'View attendance',
      actionHref: '/attendance-punches',
      occurredAt: null,
    });
  }

  return {
    generatedAt: new Date(),
    status,
    headline: status === 'CLEAR' ? clearHeadline : buildHeadline(status, fullCounts.totalOpenItems),
    counts: fullCounts,
    items: sortedItems,
  };
}

function emptyCounts(): TimeOperationCounts {
  return {
    pendingManualPunchRequests: 0,
    pendingLeaveRequests: 0,
    unprocessedAttendancePunches: 0,
    criticalDeviceIssues: 0,
    unknownDevices: 0,
    syncFailures: 0,
    deviceSetupNeeded: 0,
  };
}

function resolveStatus(items: TimeOperationItem[]): TimeOperationStatus {
  if (items.some((item) => item.severity === 'critical' || item.severity === 'warning')) {
    return 'ACTION_REQUIRED';
  }

  if (items.length > 0) {
    return 'WATCH';
  }

  return 'CLEAR';
}

function buildHeadline(status: TimeOperationStatus, totalOpenItems: number) {
  if (status === 'CLEAR') return 'No time operations need attention';
  if (status === 'WATCH') return `${totalOpenItems} time operation ${pluralize(totalOpenItems, 'item')} to monitor`;
  return `${totalOpenItems} time operation ${pluralize(totalOpenItems, 'item')} need attention`;
}

function getSeverityRank(severity: TimeOperationSeverity) {
  const ranks: Record<TimeOperationSeverity, number> = {
    critical: 0,
    warning: 1,
    info: 2,
    success: 3,
  };

  return ranks[severity];
}

function formatEmployeeName(employee: any) {
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function pluralize(countValue: number, singular: string, plural = `${singular}s`) {
  return countValue === 1 ? singular : plural;
}

function normalizeRoles(roles?: string[] | null) {
  return (roles ?? []).map((role) => role.toLowerCase());
}
