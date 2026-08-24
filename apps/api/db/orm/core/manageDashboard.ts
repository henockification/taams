import { and, count, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../db';
import {
  attendancePunches,
  biometricDevices,
  departments,
  employees,
  employeeSupervisors,
  employeeWorkSchedules,
  leaveBalances,
  leaveFiscalYears,
  leaveRequests,
  manualPunchRequests,
  positions,
} from '../../schema';
import { getTimeOperationsSummary } from './manageTimeOperations';

const MANAGER_ROLE_NAMES = ['admin', 'supervisor'];

export type DashboardRole = 'SUPER_ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'SETUP_REQUIRED';

type DashboardUser = {
  id: string;
  name: string | null;
  email: string | null;
  role?: string[] | null;
};

export async function getDashboardSummaryForUser(user: DashboardUser) {
  const roles = normalizeRoles(user.role);
  const generatedAt = new Date();
  const employee = await getEmployeeByUserId(user.id);

  if (roles.includes('super_admin')) {
    return buildSuperAdminDashboard(user, employee, generatedAt);
  }

  if (!employee) {
    return buildSetupRequiredDashboard(user, generatedAt);
  }

  const directReports = await getDirectReports(employee.id);
  const isManager = roles.some((role) => MANAGER_ROLE_NAMES.includes(role)) || directReports.length > 0;

  if (isManager) {
    return buildManagerDashboard(user, employee, directReports, generatedAt);
  }

  return buildEmployeeDashboard(user, employee, generatedAt);
}

async function buildSuperAdminDashboard(user: DashboardUser, employee: any, generatedAt: Date) {
  const [
    totalEmployees,
    activeEmployees,
    totalDepartments,
    totalPositions,
    activeDevices,
    onlineDevices,
    offlineDevices,
    errorDevices,
    unknownDevices,
    pendingManualPunchRequests,
    pendingLeaveRequests,
    unprocessedPunches,
    timeOperations,
    currentAnnualLeaveBalance,
  ] = await Promise.all([
    getCount(employees),
    getCount(employees, eq(employees.isActive, true)),
    getCount(departments),
    getCount(positions),
    getCount(biometricDevices, eq(biometricDevices.isActive, true)),
    getCount(biometricDevices, and(eq(biometricDevices.isActive, true), eq(biometricDevices.healthStatus, 'ONLINE'))),
    getCount(biometricDevices, and(eq(biometricDevices.isActive, true), eq(biometricDevices.healthStatus, 'OFFLINE'))),
    getCount(biometricDevices, and(eq(biometricDevices.isActive, true), eq(biometricDevices.healthStatus, 'ERROR'))),
    getCount(biometricDevices, and(eq(biometricDevices.isActive, true), eq(biometricDevices.healthStatus, 'UNKNOWN'))),
    getCount(manualPunchRequests, eq(manualPunchRequests.status, 'PENDING_HR_REVIEW')),
    getCount(leaveRequests, eq(leaveRequests.status, 'PENDING')),
    getCount(attendancePunches, eq(attendancePunches.isProcessed, false)),
    getTimeOperationsSummary(),
    employee ? getCurrentAnnualLeaveBalance(employee.id) : Promise.resolve(null),
  ]);

  return {
    generatedAt,
    role: 'SUPER_ADMIN' as DashboardRole,
    setupRequired: false,
    user: formatDashboardUser(user),
    employee: null,
    currentAnnualLeaveBalance,
    metrics: [
      createMetric('total-employees', 'Total employees', totalEmployees, 'People registered in the organization', '/employees'),
      createMetric('active-employees', 'Active employees', activeEmployees, 'Employees currently marked active', '/employees'),
      createMetric('departments', 'Departments', totalDepartments, 'Organizational units configured', '/organization-structure'),
      createMetric('positions', 'Positions', totalPositions, 'Job positions available', '/positions'),
      createMetric('pending-leave-requests', 'Pending leave requests', pendingLeaveRequests, 'Leave requests awaiting approval', '/leave-request-approvals'),
    ],
    quickActions: [
      createQuickAction('Employees', 'Maintain employee records and assignments.', '/employees'),
      createQuickAction('Devices', 'Review biometric device status and sync settings.', '/biometric-devices'),
      createQuickAction('Manual punch requests', 'Approve or reject employee correction requests.', '/manual-punch-requests'),
      createQuickAction('Leave requests', 'Approve or reject employee leave requests.', '/leave-request-approvals'),
      createQuickAction('Attendance punches', 'Inspect raw and processed punch records.', '/attendance-punches'),
    ],
    sections: {
      superAdmin: {
        deviceHealth: {
          total: activeDevices,
          online: onlineDevices,
          offline: offlineDevices,
          error: errorDevices,
          unknown: unknownDevices,
        },
        pendingManualPunchRequests,
        unprocessedPunches,
        timeOperations,
      },
    },
    placeholders: [
      createPlaceholder('attendance-insights', 'Attendance insights preview', 'Late arrivals, early outs, and payroll readiness will appear here once attendance calculations are implemented.'),
    ],
  };
}

async function buildManagerDashboard(
  user: DashboardUser,
  employee: any,
  directReports: any[],
  generatedAt: Date,
) {
  const directReportIds = directReports.map((assignment) => assignment.employeeId);
  const [pendingManualPunchRequests, pendingLeaveRequests, recentTeamPunches, currentAnnualLeaveBalance] = directReportIds.length > 0
    ? await Promise.all([
      db.query.manualPunchRequests.findMany({
        where: and(
          inArray(manualPunchRequests.employeeId, directReportIds),
          eq(manualPunchRequests.status, 'HR_REVIEWED'),
        ),
        with: { employee: { with: { department: true, position: true } } },
        orderBy: (table, { asc }) => [asc(table.createdAt)],
        limit: 6,
      }),
      db.query.leaveRequests.findMany({
        where: and(
          inArray(leaveRequests.employeeId, directReportIds),
          eq(leaveRequests.status, 'PENDING'),
        ),
        with: { employee: { with: { department: true, position: true } }, leaveType: true },
        orderBy: (table, { asc }) => [asc(table.createdAt)],
        limit: 6,
      }),
      db.query.attendancePunches.findMany({
        where: inArray(attendancePunches.employeeId, directReportIds),
        with: {
          employee: { with: { department: true, position: true } },
          device: true,
        },
        orderBy: (table, { desc }) => [desc(table.punchTime)],
        limit: 8,
      }),
      getCurrentAnnualLeaveBalance(employee.id),
    ])
    : [[], [], [], null];

  return {
    generatedAt,
    role: 'MANAGER' as DashboardRole,
    setupRequired: false,
    user: formatDashboardUser(user),
    employee,
    currentAnnualLeaveBalance,
    metrics: [
      createMetric('direct-reports', 'Direct reports', directReports.length, 'Employees assigned to your supervision', '/employees'),
      createMetric('pending-requests', 'Pending requests', pendingManualPunchRequests.length, 'Manual punch requests awaiting supervisor action', '/manual-punch-requests'),
      createMetric('pending-leave-requests', 'Pending leave requests', pendingLeaveRequests.length, 'Leave requests awaiting supervisor action', '/leave-request-approvals'),
      createMetric('recent-team-punches', 'Recent team punches', recentTeamPunches.length, 'Latest punch records from your team', '/attendance-punches'),
    ],
    quickActions: [
      createQuickAction('Manual punch requests', 'Review correction requests from your team.', '/manual-punch-requests'),
      createQuickAction('Leave requests', 'Review leave requests from your team.', '/leave-request-approvals'),
      createQuickAction('Attendance punches', 'Check recent team attendance activity.', '/attendance-punches'),
      createQuickAction('Work schedules', 'Review shift and schedule setup.', '/work-schedules'),
    ],
    sections: {
      manager: {
        directReportsCount: directReports.length,
        directReports: directReports.map((assignment) => assignment.employee).filter(Boolean),
        pendingManualPunchRequests,
        pendingLeaveRequests,
        recentTeamPunches,
        teamScheduleCoverage: createPlaceholder('team-schedule-coverage', 'Team schedule coverage preview', 'Coverage gaps and shift conflicts will show here after schedule coverage calculations are added.'),
        attendanceExceptions: createPlaceholder('attendance-exceptions', 'Attendance exceptions preview', 'Late arrivals, missed outs, and unusual punches will appear here when exception processing is ready.'),
      },
    },
    placeholders: [
      createPlaceholder('team-schedule-coverage', 'Team schedule coverage preview', 'Coverage gaps and shift conflicts will show here after schedule coverage calculations are added.'),
      createPlaceholder('attendance-exceptions', 'Attendance exceptions preview', 'Late arrivals, missed outs, and unusual punches will appear here when exception processing is ready.'),
    ],
  };
}

async function buildEmployeeDashboard(user: DashboardUser, employee: any, generatedAt: Date) {
  const selectedDate = new Date().toISOString().slice(0, 10);
  const dayRange = getDayRange(selectedDate);
  const [latestWorkSchedule, recentPunches, todayPunches, manualPunchRequestItems, leaveRequestItems, currentAnnualLeaveBalance] = await Promise.all([
    getLatestEmployeeWorkSchedule(employee.id),
    db.query.attendancePunches.findMany({
      where: eq(attendancePunches.employeeId, employee.id),
      with: { device: true },
      orderBy: (table, { desc }) => [desc(table.punchTime)],
      limit: 8,
    }),
    db.query.attendancePunches.findMany({
      where: and(
        eq(attendancePunches.employeeId, employee.id),
        gte(attendancePunches.punchTime, dayRange.start),
        lte(attendancePunches.punchTime, dayRange.end),
      ),
      with: { device: true },
      orderBy: (table, { asc }) => [asc(table.punchTime)],
    }),
    db.query.manualPunchRequests.findMany({
      where: eq(manualPunchRequests.employeeId, employee.id),
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit: 6,
    }),
    db.query.leaveRequests.findMany({
      where: eq(leaveRequests.employeeId, employee.id),
      with: { leaveType: true, fiscalYear: true },
      orderBy: (table, { desc }) => [desc(table.createdAt)],
      limit: 6,
    }),
    getCurrentAnnualLeaveBalance(employee.id),
  ]);
  const todayAttendance = buildTodayAttendance(todayPunches);

  return {
    generatedAt,
    role: 'EMPLOYEE' as DashboardRole,
    setupRequired: false,
    user: formatDashboardUser(user),
    employee,
    currentAnnualLeaveBalance,
    metrics: [
      createMetric('recent-punches', 'Recent punches', recentPunches.length, 'Latest attendance punches linked to your profile', '/attendance-punches'),
      createMetric('manual-requests', 'Manual requests', manualPunchRequestItems.length, 'Your recent correction requests', '/manual-punch-requests'),
      createMetric('annual-leave-balance', 'Annual leave balance', currentAnnualLeaveBalance?.available ?? 'Not set', 'Available annual leave in the active fiscal year', '/annual-leave-requests'),
      createMetric('schedule-status', latestWorkSchedule ? 'Schedule assigned' : 'No schedule yet', latestWorkSchedule ? 'Active' : 'Setup needed', 'Latest work schedule assignment', '/work-schedules'),
    ],
    quickActions: [
      createQuickAction('Request manual punch', 'Submit a correction request for a missed or wrong punch.', '/manual-punch-requests'),
      createQuickAction('Request annual leave', 'Submit annual leave for supervisor approval.', '/annual-leave-requests'),
    ],
    sections: {
      employee: {
        profile: employee,
        latestWorkSchedule,
        recentPunches,
        todayPunches,
        leaveRequests: leaveRequestItems,
        manualPunchRequests: manualPunchRequestItems,
        todayAttendance,
        announcements: [],
      },
    },
    placeholders: [],
  };
}

function buildSetupRequiredDashboard(user: DashboardUser, generatedAt: Date) {
  return {
    generatedAt,
    role: 'SETUP_REQUIRED' as DashboardRole,
    setupRequired: true,
    user: formatDashboardUser(user),
    employee: null,
    currentAnnualLeaveBalance: null,
    metrics: [],
    quickActions: [
      createQuickAction('Complete employee setup', 'Link this user to an employee record to unlock the dashboard.', '/employees'),
    ],
    sections: {
      setup: {
        title: 'Employee profile link needed',
        description: 'This user account is not linked to an employee record yet. Once linked, schedules, punches, and requests can be displayed here.',
      },
    },
    placeholders: [],
  };
}

async function getEmployeeByUserId(userId: string) {
  return db.query.employees.findFirst({
    where: eq(employees.userId, userId),
    with: {
      department: true,
      position: true,
    },
  });
}

async function getDirectReports(employeeId: string) {
  return db.query.employeeSupervisors.findMany({
    where: eq(employeeSupervisors.supervisorId, employeeId),
    with: {
      employee: {
        with: {
          department: true,
          position: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.createdAt)],
  });
}

async function getLatestEmployeeWorkSchedule(employeeId: string) {
  return db.query.employeeWorkSchedules.findFirst({
    where: and(eq(employeeWorkSchedules.employeeId, employeeId), eq(employeeWorkSchedules.isActive, true)),
    with: {
      workSchedule: {
        with: {
          days: {
            with: {
              shift: true,
            },
          },
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.effectiveFrom), desc(table.createdAt)],
  });
}

function getDayRange(date: string) {
  return {
    start: new Date(`${date}T00:00:00`),
    end: new Date(`${date}T23:59:59.999`),
  };
}

function buildTodayAttendance(punches: any[]) {
  const checkIn = punches[0] ?? null;
  const checkOut = punches.length > 1 ? punches[punches.length - 1] : null;
  const workingMinutes = checkIn && checkOut
    ? Math.max(0, Math.round((new Date(checkOut.punchTime).getTime() - new Date(checkIn.punchTime).getTime()) / (1000 * 60)))
    : 0;

  return {
    date: new Date().toISOString().slice(0, 10),
    checkIn,
    checkOut,
    workingMinutes,
    workingHours: Math.round((workingMinutes / 60) * 10) / 10,
  };
}

async function getCurrentAnnualLeaveBalance(employeeId: string) {
  const activeFiscalYear = await db.query.leaveFiscalYears.findFirst({
    where: eq(leaveFiscalYears.isActive, true),
    columns: { id: true },
  });
  if (!activeFiscalYear) return null;

  return db.query.leaveBalances.findFirst({
    where: and(
      eq(leaveBalances.employeeId, employeeId),
      eq(leaveBalances.fiscalYearId, activeFiscalYear.id),
    ),
    columns: {
      available: true,
    },
  });
}

async function getCount(table: any, where?: any) {
  const query = db.select({ value: count() }).from(table);
  const [result] = where ? await query.where(where) : await query;
  return Number(result?.value ?? 0);
}

function normalizeRoles(roles?: string[] | null) {
  return (roles ?? []).map((role) => role.toLowerCase());
}

function formatDashboardUser(user: DashboardUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: user.role ?? ['user'],
  };
}

function createMetric(id: string, label: string, value: number | string, description: string, href?: string) {
  return { id, label, value, description, href };
}

function createQuickAction(label: string, description: string, href: string) {
  return { label, description, href };
}

function createPlaceholder(id: string, title: string, description: string) {
  return { id, title, description, isPreview: true };
}
