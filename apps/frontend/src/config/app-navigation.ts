import {
  Building2,
  ArrowRightLeft,
  BellRing,
  CalendarClock,
  CalendarDays,
  Clock3,
  ClipboardPlus,
  ClipboardList,
  FileSpreadsheet,
  FileCheck2,
  Fingerprint,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  MonitorCog,
  PanelsTopLeft,
  PlaneTakeoff,
  Scale,
  Sheet,
  ShieldCheck,
  ScanLine,
  Timer,
  UserCheck,
  UserRoundCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AppNavItem = {
  titleKey: 'dashboard' | 'executiveDashboard' | 'hrDashboard' | 'departmentHeadDashboard' | 'users' | 'roles' | 'permissions' | 'notificationLogs' | 'organizationStructure' | 'positions' | 'employees' | 'permanentEmployees' | 'fiscalYears' | 'leaveTypes' | 'leaveBalances' | 'leaveTransfer' | 'leaveRequestApprovals' | 'supervisorDelegation' | 'temporaryAssignments' | 'workSchedules' | 'holidays' | 'shifts' | 'scheduleAssignments' | 'biometricDevices' | 'biometricExemptions' | 'attendancePunches' | 'attendanceApprovals' | 'hrAttendanceApproval' | 'manualPunchRequests' | 'attendanceCorrectionApprovals' | 'overtimeRequests' | 'overtimeAssignments' | 'annualLeaveRequests' | 'otherLeaveRequests' | 'attendanceDailyReport' | 'attendancePunchesReport' | 'lateAttendanceReport' | 'overtimeReport' | 'leaveBalancesReport' | 'leaveRequestsReport' | 'employeeRosterReport' | 'deviceSyncReport';
  url: string;
  permissionResource: string;
  requiredPermission: string;
  legacyPermissions?: string[];
  icon: LucideIcon;
};

export type AppNavGroup = {
  labelKey: 'workspace' | 'core' | 'leaveManagement' | 'supervisor' | 'employeeServices' | 'workScheduleShift' | 'biometric' | 'reports' | 'security';
  icon: LucideIcon;
  items: AppNavItem[];
  requiredRole?: 'supervisor';
};

export const appNavGroups: AppNavGroup[] = [
  {
    labelKey: 'workspace',
    icon: LayoutDashboard,
    items: [
      {
        titleKey: 'dashboard',
        url: '/dashboard',
        permissionResource: 'dashboard',
        requiredPermission: 'dashboard:read',
        icon: LayoutDashboard,
      },
      {
        titleKey: 'executiveDashboard',
        url: '/executive-dashboard',
        permissionResource: 'executive-dashboard',
        requiredPermission: 'executive-dashboard:read',
        icon: MonitorCog,
      },
      {
        titleKey: 'hrDashboard',
        url: '/hr-dashboard',
        permissionResource: 'hr-dashboard',
        requiredPermission: 'hr-dashboard:read',
        icon: HeartPulse,
      },
      {
        titleKey: 'departmentHeadDashboard',
        url: '/department-head-dashboard',
        permissionResource: 'department-head-dashboard',
        requiredPermission: 'department-head-dashboard:read',
        icon: UserCheck,
      },
    ],
  },
  {
    labelKey: 'core',
    icon: Building2,
    items: [
      // Temporarily hidden: organization structure should not appear in navigation or be directly accessible.
      // {
      //   titleKey: 'organizationStructure',
      //   url: '/organization-structure',
      //   permissionResource: 'organization-structure',
      //   requiredPermission: 'organization-structure:read',
      //   icon: Building2,
      // },
      // Temporarily hidden: positions should not appear in navigation or be directly accessible.
      // {
      //   titleKey: 'positions',
      //   url: '/positions',
      //   permissionResource: 'positions',
      //   requiredPermission: 'positions:read',
      //   icon: PanelsTopLeft,
      // },
      {
        titleKey: 'permanentEmployees',
        url: '/permanent-employees',
        permissionResource: 'permanent-employees',
        requiredPermission: 'permanent-employees:read',
        legacyPermissions: ['employees:read'],
        icon: FileSpreadsheet,
      },
      {
        titleKey: 'employees',
        url: '/employees',
        permissionResource: 'employees',
        requiredPermission: 'employees:read',
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    labelKey: 'leaveManagement',
    icon: PlaneTakeoff,
    items: [
      {
        titleKey: 'fiscalYears',
        url: '/leave-management/fiscal-years',
        permissionResource: 'leave-fiscal-years',
        requiredPermission: 'leave-fiscal-years:read',
        legacyPermissions: ['leave-management:read'],
        icon: CalendarDays,
      },
      {
        titleKey: 'leaveTypes',
        url: '/leave-management/leave-types',
        permissionResource: 'leave-types',
        requiredPermission: 'leave-types:read',
        legacyPermissions: ['leave-management:read'],
        icon: ListChecks,
      },
      {
        titleKey: 'leaveBalances',
        url: '/leave-management/balances',
        permissionResource: 'leave-balances',
        requiredPermission: 'leave-balances:read',
        legacyPermissions: ['leave-management:read'],
        icon: Scale,
      },
      {
        titleKey: 'leaveTransfer',
        url: '/leave-management/carry-forward',
        permissionResource: 'leave-transfer',
        requiredPermission: 'leave-transfer:read',
        legacyPermissions: ['leave-management:read'],
        icon: ArrowRightLeft,
      },
    ],
  },
  {
    labelKey: 'supervisor',
    icon: UserCheck,
    requiredRole: 'supervisor',
    items: [
      {
        titleKey: 'leaveRequestApprovals',
        url: '/leave-request-approvals',
        permissionResource: 'leave-request-approvals',
        requiredPermission: 'leave-request-approvals:approve',
        legacyPermissions: ['leave-requests:approve'],
        icon: FileCheck2,
      },
      {
        titleKey: 'overtimeAssignments',
        url: '/overtime-assignments',
        permissionResource: 'overtime-requests',
        requiredPermission: 'overtime-requests:approve',
        icon: Timer,
      },
      {
        titleKey: 'attendanceCorrectionApprovals',
        url: '/attendance-correction-approvals',
        permissionResource: 'manual-punch-requests',
        requiredPermission: 'manual-punch-requests:approve',
        icon: ClipboardList,
      },
      {
        titleKey: 'attendanceApprovals',
        url: '/attendance-approvals/supervisor',
        permissionResource: 'attendance-approvals',
        requiredPermission: 'attendance-approvals:approve',
        icon: FileCheck2,
      },
      {
        titleKey: 'supervisorDelegation',
        url: '/supervisor-delegations',
        permissionResource: 'supervisor-delegations',
        requiredPermission: 'supervisor-delegations:read',
        icon: UserRoundCog,
      },
      {
        titleKey: 'temporaryAssignments',
        url: '/temporary-assignments',
        permissionResource: 'employees',
        requiredPermission: 'employees:read',
        icon: ArrowRightLeft,
      },
    ],
  },
  {
    labelKey: 'employeeServices',
    icon: Users,
    items: [
      {
        titleKey: 'annualLeaveRequests',
        url: '/annual-leave-requests',
        permissionResource: 'annual-leave-requests',
        requiredPermission: 'annual-leave-requests:read',
        legacyPermissions: ['leave-requests:read'],
        icon: PlaneTakeoff,
      },
      {
        titleKey: 'otherLeaveRequests',
        url: '/other-leave-requests',
        permissionResource: 'other-leave-requests',
        requiredPermission: 'other-leave-requests:read',
        legacyPermissions: ['leave-requests:read'],
        icon: FileCheck2,
      },
      {
        titleKey: 'overtimeRequests',
        url: '/overtime-requests',
        permissionResource: 'overtime-requests',
        requiredPermission: 'overtime-requests:read',
        icon: Timer,
      },
      {
        titleKey: 'manualPunchRequests',
        url: '/manual-punch-requests',
        permissionResource: 'manual-punch-requests',
        requiredPermission: 'manual-punch-requests:read',
        icon: ClipboardPlus,
      },
    ],
  },
  {
    labelKey: 'workScheduleShift',
    icon: CalendarClock,
    items: [
      {
        titleKey: 'workSchedules',
        url: '/work-schedules',
        permissionResource: 'work-schedules',
        requiredPermission: 'work-schedules:read',
        icon: CalendarClock,
      },
      {
        titleKey: 'holidays',
        url: '/holidays',
        permissionResource: 'holidays',
        requiredPermission: 'holidays:read',
        legacyPermissions: ['work-schedules:read'],
        icon: CalendarDays,
      },
      {
        titleKey: 'shifts',
        url: '/shifts',
        permissionResource: 'shifts',
        requiredPermission: 'shifts:read',
        legacyPermissions: ['work-schedules:read'],
        icon: Timer,
      },
      {
        titleKey: 'scheduleAssignments',
        url: '/work-schedule-assignments',
        permissionResource: 'schedule-assignments',
        requiredPermission: 'schedule-assignments:read',
        legacyPermissions: ['work-schedules:read'],
        icon: UserRoundCog,
      },
    ],
  },
  {
    labelKey: 'biometric',
    icon: Fingerprint,
    items: [
      {
        titleKey: 'biometricDevices',
        url: '/biometric-devices',
        permissionResource: 'biometric-devices',
        requiredPermission: 'biometric-devices:read',
        icon: Fingerprint,
      },
      {
        titleKey: 'biometricExemptions',
        url: '/biometric-exemptions',
        permissionResource: 'biometric-exemptions',
        requiredPermission: 'biometric-exemptions:read',
        icon: ShieldCheck,
      },
      {
        titleKey: 'attendancePunches',
        url: '/attendance-punches',
        permissionResource: 'attendance-punches',
        requiredPermission: 'attendance-punches:read',
        icon: ScanLine,
      },
      {
        titleKey: 'hrAttendanceApproval',
        url: '/attendance-approvals/hr',
        permissionResource: 'hr-attendance-approvals',
        requiredPermission: 'hr-attendance-approvals:approve',
        icon: ShieldCheck,
      },
    ],
  },
  {
    labelKey: 'reports',
    icon: ClipboardList,
    items: [
      {
        titleKey: 'attendanceDailyReport',
        url: '/reports/attendance-daily',
        permissionResource: 'reports-attendance-daily',
        requiredPermission: 'reports-attendance-daily:read',
        icon: CalendarDays,
      },
      {
        titleKey: 'attendancePunchesReport',
        url: '/reports/attendance-punches',
        permissionResource: 'reports-attendance-punches',
        requiredPermission: 'reports-attendance-punches:read',
        icon: ScanLine,
      },
      {
        titleKey: 'lateAttendanceReport',
        url: '/reports/late-attendance',
        permissionResource: 'reports-late-attendance',
        requiredPermission: 'reports-late-attendance:read',
        icon: Clock3,
      },
      {
        titleKey: 'overtimeReport',
        url: '/reports/overtime',
        permissionResource: 'reports-overtime',
        requiredPermission: 'reports-overtime:read',
        icon: Timer,
      },
      {
        titleKey: 'leaveBalancesReport',
        url: '/reports/leave-balances',
        permissionResource: 'reports-leave-balances',
        requiredPermission: 'reports-leave-balances:read',
        icon: Scale,
      },
      {
        titleKey: 'leaveRequestsReport',
        url: '/reports/leave-requests',
        permissionResource: 'reports-leave-requests',
        requiredPermission: 'reports-leave-requests:read',
        icon: PlaneTakeoff,
      },
      {
        titleKey: 'employeeRosterReport',
        url: '/reports/employees',
        permissionResource: 'reports-employees',
        requiredPermission: 'reports-employees:read',
        icon: Users,
      },
      {
        titleKey: 'deviceSyncReport',
        url: '/reports/device-sync',
        permissionResource: 'reports-device-sync',
        requiredPermission: 'reports-device-sync:read',
        icon: Sheet,
      },
    ],
  },
  {
    labelKey: 'security',
    icon: ShieldCheck,
    items: [
      {
        titleKey: 'users',
        url: '/users',
        permissionResource: 'users',
        requiredPermission: 'users:read',
        icon: Users,
      },
      {
        titleKey: 'roles',
        url: '/roles',
        permissionResource: 'roles',
        requiredPermission: 'roles:read',
        icon: ShieldCheck,
      },
      {
        titleKey: 'permissions',
        url: '/permissions',
        permissionResource: 'permissions',
        requiredPermission: 'permissions:read',
        icon: KeyRound,
      },
      {
        titleKey: 'notificationLogs',
        url: '/notification-logs',
        permissionResource: 'notification-logs',
        requiredPermission: 'notification-logs:read',
        icon: BellRing,
      },
    ],
  },
] as const;

export const permissionResourceOptions: AppNavItem[] = appNavGroups.flatMap((group) => group.items);

export const permissionActions = ['read', 'add', 'edit', 'approve', 'reject'] as const;

type AuthzUser = {
  role?: string[];
  permissions?: string[];
  delegatedSupervisorCapabilities?: Array<{ id: string; endsAt?: string | null }>;
  hasDelegatedSupervisorAccess?: boolean;
} | null | undefined;

export function isSuperAdmin(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  return roles.includes('super_admin') || roles.includes('superadmin');
}

export function userHasPermission(user: AuthzUser, permission: string) {
  if (isSuperAdmin(user)) return true;
  return Boolean(user?.permissions?.includes(permission));
}

export function userCanAccessNavItem(user: AuthzUser, item: AppNavItem) {
  if (item.url === '/dashboard') return hasEmployeeDashboardRole(user);
  if (item.url === '/executive-dashboard' && hasExecutiveRole(user)) return true;
  if (item.url === '/hr-dashboard' && hasHrDashboardAccess(user)) return true;
  if (item.url === '/department-head-dashboard' && hasSupervisorRole(user)) return true;
  if (item.url === '/attendance-approvals/supervisor') return hasSupervisorApprovalAccess(user, 'attendance-approvals:approve');
  if (item.url === '/attendance-approvals/hr' && hasHrAttendanceApprovalAccess(user)) return true;
  if (item.url === '/notification-logs' && hasHrRole(user)) return true;
  if (item.url === '/supervisor-delegations') return hasExactSupervisorRole(user) || isSuperAdmin(user);
  if (item.url === '/overtime-assignments') return hasDelegatedSupervisorAccess(user) || (hasExactSupervisorRole(user) && hasSupervisorApprovalAccess(user, 'overtime-requests:approve'));
  if (item.url === '/leave-request-approvals') return hasDelegatedSupervisorAccess(user) || (hasExactSupervisorRole(user) && hasSupervisorApprovalAccess(user, 'leave-request-approvals:approve'));
  if (item.url === '/attendance-correction-approvals') return hasDelegatedSupervisorAccess(user) || (hasExactSupervisorRole(user) && hasSupervisorApprovalAccess(user, 'manual-punch-requests:approve'));
  if (item.url === '/annual-leave-requests' || item.url === '/other-leave-requests' || item.url === '/overtime-requests' || item.url === '/manual-punch-requests') return Boolean(user);
  return userHasPermission(user, item.requiredPermission)
    || Boolean(item.legacyPermissions?.some((permission) => userHasPermission(user, permission)));
}

export function hasExecutiveRole(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  return roles.some((role) => (
    role === 'super_admin'
    || role === 'executive'
  ));
}

export function hasHrRole(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  return roles.some((role) => (
    role === 'super_admin'
    || role === 'superadmin'
    || role === 'admin'
    || role === 'executive'
    || role === 'human_resource'
  )) || Boolean(user?.permissions?.some(isHrCapabilityPermission));
}

export function hasHrDashboardAccess(user: AuthzUser) {
  return hasUnrestrictedRole(user)
    || hasHumanResourceRole(user)
    || userHasPermission(user, 'hr-dashboard:read');
}

export function hasHrAttendanceApprovalAccess(user: AuthzUser) {
  return hasUnrestrictedRole(user)
    || hasHumanResourceRole(user)
    || userHasPermission(user, 'hr-attendance-approvals:approve');
}

export function hasEmployeeDashboardRole(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  if (roles.length === 0) return Boolean(user);
  if (!roles.includes('employee')) return false;
  return !roles.some((role) => (
    role === 'super_admin'
    || role === 'superadmin'
    || role === 'admin'
    || role === 'executive'
    || role === 'human_resource'
    || role === 'supervisor'
  ));
}

function isHrCapabilityPermission(permission: string) {
  const normalized = permission.trim().toLowerCase();
  const resource = normalized.split(':')[0];
  return normalized.startsWith('hr-') || [
    'employees',
    'permanent-employees',
    'hr-dashboard',
    'hr-attendance-approvals',
    'manual-punch-requests',
    'leave-balances',
    'leave-transfer',
    'leave-fiscal-years',
    'leave-types',
    'leave-request-approvals',
    'biometric-exemptions',
    'attendance-punches',
    'work-schedules',
    'holidays',
    'shifts',
    'schedule-assignments',
  ].includes(resource);
}

export function hasSupervisorRole(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  return roles.some((role) => (
    role === 'super_admin'
    || role === 'superadmin'
    || role === 'admin'
    || role === 'supervisor'
  ));
}

export function hasDelegatedSupervisorAccess(user: AuthzUser) {
  if (!user) return false;
  if (user.hasDelegatedSupervisorAccess) return true;

  const now = Date.now();
  return Boolean(user.delegatedSupervisorCapabilities?.some((delegation) => {
    if (!delegation.endsAt) return true;
    return new Date(delegation.endsAt).getTime() > now;
  }));
}

export function hasExactSupervisorRole(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  return roles.includes('supervisor');
}

export function hasSupervisorApprovalAccess(user: AuthzUser, permission?: string) {
  return hasSupervisorRole(user) || hasDelegatedSupervisorAccess(user) || Boolean(permission && userHasPermission(user, permission));
}

export function getNavItemForPath(pathname: string) {
  const items = appNavGroups.flatMap((group) => group.items);
  return items
    .filter((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))
    .sort((a, b) => b.url.length - a.url.length)[0];
}

export function userCanAccessPath(user: AuthzUser, pathname: string) {
  if (pathname === '/organization-structure' || pathname.startsWith('/organization-structure/')) return false;
  if (pathname === '/positions' || pathname.startsWith('/positions/')) return false;
  if (pathname === '/leave-request-approvals' || pathname.startsWith('/leave-request-approvals/')) return hasSupervisorApprovalAccess(user, 'leave-request-approvals:approve');
  if (pathname === '/overtime-assignments' || pathname.startsWith('/overtime-assignments/')) return hasDelegatedSupervisorAccess(user) || (hasExactSupervisorRole(user) && hasSupervisorApprovalAccess(user, 'overtime-requests:approve'));
  if (pathname === '/attendance-correction-approvals' || pathname.startsWith('/attendance-correction-approvals/')) return hasDelegatedSupervisorAccess(user) || (hasExactSupervisorRole(user) && hasSupervisorApprovalAccess(user, 'manual-punch-requests:approve'));
  if (pathname === '/supervisor-delegations' || pathname.startsWith('/supervisor-delegations/')) return hasExactSupervisorRole(user) || isSuperAdmin(user);
  if (pathname === '/annual-leave-requests' || pathname.startsWith('/annual-leave-requests/')) return Boolean(user);
  if (pathname === '/overtime-requests') return Boolean(user);
  if (pathname === '/manual-punch-requests') return Boolean(user);
  if (pathname === '/notification-logs' && hasHrRole(user)) return true;
  if (pathname === '/department-head-dashboard') return hasSupervisorApprovalAccess(user, 'department-head-dashboard:read');
  if (pathname === '/attendance-approvals/supervisor') return hasSupervisorApprovalAccess(user, 'attendance-approvals:approve');
  if (pathname === '/attendance-approvals/hr') return hasHrAttendanceApprovalAccess(user);
  const navItem = getNavItemForPath(pathname);
  return navItem ? userCanAccessNavItem(user, navItem) : true;
}

export function getAccessibleNavGroups(user: AuthzUser) {
  return appNavGroups
    .filter((group) => group.requiredRole !== 'supervisor' || hasExactSupervisorRole(user) || hasDelegatedSupervisorAccess(user))
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => userCanAccessNavItem(user, item)),
    }))
    .filter((group) => group.items.length > 0);
}

export function getFirstAccessiblePath(user: AuthzUser) {
  if (hasExecutiveRole(user)) return '/executive-dashboard';
  if (hasHrDashboardAccess(user)) return '/hr-dashboard';
  if (hasSupervisorRole(user)) return '/department-head-dashboard';
  if (hasDelegatedSupervisorAccess(user)) return '/leave-request-approvals';
  return getAccessibleNavGroups(user)[0]?.items[0]?.url ?? null;
}

function hasUnrestrictedRole(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  return roles.some((role) => (
    role === 'super_admin'
    || role === 'superadmin'
    || role === 'admin'
    || role === 'executive'
  ));
}

function hasHumanResourceRole(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  return roles.some((role) => (
    role === 'human_resource'
  ));
}
