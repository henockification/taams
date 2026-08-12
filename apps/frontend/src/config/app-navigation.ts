import {
  Building2,
  ArrowRightLeft,
  CalendarClock,
  CalendarDays,
  ClipboardPlus,
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
  ShieldCheck,
  ScanLine,
  Timer,
  UserCheck,
  UserRoundCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AppNavItem = {
  titleKey: 'dashboard' | 'executiveDashboard' | 'hrDashboard' | 'departmentHeadDashboard' | 'users' | 'roles' | 'permissions' | 'organizationStructure' | 'positions' | 'employees' | 'permanentEmployees' | 'fiscalYears' | 'leaveTypes' | 'leaveBalances' | 'leaveTransfer' | 'leaveRequestApprovals' | 'workSchedules' | 'shifts' | 'scheduleAssignments' | 'biometricDevices' | 'biometricExemptions' | 'attendancePunches' | 'attendanceApprovals' | 'hrAttendanceApproval' | 'manualPunchRequests' | 'annualLeaveRequests' | 'otherLeaveRequests';
  url: string;
  permissionResource: string;
  requiredPermission: string;
  legacyPermissions?: string[];
  icon: LucideIcon;
};

export type AppNavGroup = {
  labelKey: 'workspace' | 'core' | 'leaveManagement' | 'employeeServices' | 'workScheduleShift' | 'biometric' | 'security';
  items: AppNavItem[];
};

export const appNavGroups: AppNavGroup[] = [
  {
    labelKey: 'workspace',
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
    items: [
      {
        titleKey: 'organizationStructure',
        url: '/organization-structure',
        permissionResource: 'organization-structure',
        requiredPermission: 'organization-structure:read',
        icon: Building2,
      },
      {
        titleKey: 'positions',
        url: '/positions',
        permissionResource: 'positions',
        requiredPermission: 'positions:read',
        icon: PanelsTopLeft,
      },
      {
        titleKey: 'employees',
        url: '/employees',
        permissionResource: 'employees',
        requiredPermission: 'employees:read',
        icon: UserRoundCog,
      },
      {
        titleKey: 'permanentEmployees',
        url: '/permanent-employees',
        permissionResource: 'permanent-employees',
        requiredPermission: 'permanent-employees:read',
        legacyPermissions: ['employees:read'],
        icon: FileSpreadsheet,
      },
    ],
  },
  {
    labelKey: 'leaveManagement',
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
      {
        titleKey: 'leaveRequestApprovals',
        url: '/leave-request-approvals',
        permissionResource: 'leave-request-approvals',
        requiredPermission: 'leave-request-approvals:approve',
        legacyPermissions: ['leave-requests:approve'],
        icon: FileCheck2,
      },
    ],
  },
  {
    labelKey: 'employeeServices',
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
    ],
  },
  {
    labelKey: 'workScheduleShift',
    items: [
      {
        titleKey: 'workSchedules',
        url: '/work-schedules',
        permissionResource: 'work-schedules',
        requiredPermission: 'work-schedules:read',
        icon: CalendarClock,
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
        titleKey: 'attendanceApprovals',
        url: '/attendance-approvals/supervisor',
        permissionResource: 'attendance-approvals',
        requiredPermission: 'attendance-approvals:approve',
        icon: FileCheck2,
      },
      {
        titleKey: 'hrAttendanceApproval',
        url: '/attendance-approvals/hr',
        permissionResource: 'hr-attendance-approvals',
        requiredPermission: 'hr-attendance-approvals:approve',
        icon: ShieldCheck,
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
    labelKey: 'security',
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
    ],
  },
] as const;

export const permissionResourceOptions: AppNavItem[] = appNavGroups.flatMap((group) => group.items);

export const permissionActions = ['read', 'add', 'edit', 'approve', 'reject'] as const;

type AuthzUser = {
  role?: string[];
  permissions?: string[];
} | null | undefined;

export function isSuperAdmin(user: AuthzUser) {
  return Boolean(user?.role?.includes('super_admin'));
}

export function userHasPermission(user: AuthzUser, permission: string) {
  if (isSuperAdmin(user)) return true;
  return Boolean(user?.permissions?.includes(permission));
}

export function userCanAccessNavItem(user: AuthzUser, item: AppNavItem) {
  if (item.url === '/dashboard') return hasEmployeeDashboardRole(user);
  if (item.url === '/executive-dashboard' && hasExecutiveRole(user)) return true;
  if (item.url === '/hr-dashboard' && hasHrRole(user)) return true;
  if (item.url === '/department-head-dashboard' && hasDepartmentHeadRole(user)) return true;
  if (item.url === '/attendance-approvals/supervisor' && hasDepartmentHeadRole(user)) return true;
  if (item.url === '/attendance-approvals/hr' && hasHrRole(user)) return true;
  if (item.url === '/annual-leave-requests' || item.url === '/other-leave-requests') return Boolean(user);
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
    || role === 'human_resource'
  ));
}

export function hasEmployeeDashboardRole(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  if (roles.length === 0) return Boolean(user);
  if (!roles.includes('employee')) return false;
  return !roles.some((role) => (
    role === 'super_admin'
    || role === 'admin'
    || role === 'executive'
    || role === 'human_resource'
    || role === 'hr_manager'
    || role === 'manager'
    || role === 'department_manager'
    || role === 'department_head'
    || role === 'supervisor'
  ));
}

export function hasDepartmentHeadRole(user: AuthzUser) {
  const roles = user?.role?.map((role) => role.toLowerCase()) ?? [];
  return roles.some((role) => (
    role === 'super_admin'
    || role === 'admin'
    || role === 'manager'
    || role === 'department_manager'
    || role === 'department_head'
    || role === 'supervisor'
  ));
}

export function getNavItemForPath(pathname: string) {
  const items = appNavGroups.flatMap((group) => group.items);
  return items
    .filter((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))
    .sort((a, b) => b.url.length - a.url.length)[0];
}

export function userCanAccessPath(user: AuthzUser, pathname: string) {
  if (pathname === '/leave-request-approvals') return Boolean(user);
  if (pathname === '/department-head-dashboard') return Boolean(user);
  if (pathname === '/attendance-approvals/supervisor') return hasDepartmentHeadRole(user);
  if (pathname === '/attendance-approvals/hr') return hasHrRole(user);
  const navItem = getNavItemForPath(pathname);
  return navItem ? userCanAccessNavItem(user, navItem) : true;
}

export function getAccessibleNavGroups(user: AuthzUser) {
  return appNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => userCanAccessNavItem(user, item)),
    }))
    .filter((group) => group.items.length > 0);
}

export function getFirstAccessiblePath(user: AuthzUser) {
  if (hasExecutiveRole(user)) return '/executive-dashboard';
  if (hasHrRole(user)) return '/hr-dashboard';
  if (hasDepartmentHeadRole(user)) return '/department-head-dashboard';
  return getAccessibleNavGroups(user)[0]?.items[0]?.url ?? null;
}
