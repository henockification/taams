import {
  Building2,
  CalendarClock,
  KeyRound,
  LayoutDashboard,
  PanelsTopLeft,
  ShieldCheck,
  UserRoundCog,
  Users,
  type LucideIcon,
} from 'lucide-react';

export type AppNavItem = {
  titleKey: 'dashboard' | 'users' | 'roles' | 'permissions' | 'organizationStructure' | 'positions' | 'employees' | 'workSchedulesAndShifts';
  url: string;
  permissionResource: string;
  requiredPermission: string;
  icon: LucideIcon;
};

export type AppNavGroup = {
  labelKey: 'workspace' | 'core' | 'workScheduleShift' | 'security';
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
    ],
  },
  {
    labelKey: 'workScheduleShift',
    items: [
      {
        titleKey: 'workSchedulesAndShifts',
        url: '/work-schedules',
        permissionResource: 'work-schedules',
        requiredPermission: 'work-schedules:read',
        icon: CalendarClock,
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
  return userHasPermission(user, item.requiredPermission);
}

export function getNavItemForPath(pathname: string) {
  const items = appNavGroups.flatMap((group) => group.items);
  return items
    .filter((item) => pathname === item.url || pathname.startsWith(`${item.url}/`))
    .sort((a, b) => b.url.length - a.url.length)[0];
}

export function userCanAccessPath(user: AuthzUser, pathname: string) {
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
  return getAccessibleNavGroups(user)[0]?.items[0]?.url ?? null;
}
