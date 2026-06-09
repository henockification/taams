/**
 * Role-Based Access Control (RBAC) Configuration
 * 
 * This file centralizes all role permissions for pages and menu items.
 * Easy to modify for future role requirements.
 */

export type Role = 'saas_admin' | 'tenant_admin' | 'tenant_user' | 'guest';

export interface PagePermission {
  path: string;
  allowedRoles: Role[];
  name: string;
  description?: string;
}

export interface MenuItem {
  icon: any; // Icon component
  label: string;
  href: string;
  allowedRoles: Role[];
  order: number; // For consistent ordering
}

// Define all available roles
export const ROLES = {
  SAAS_ADMIN: 'saas_admin' as const,
  TENANT_ADMIN: 'tenant_admin' as const,
  TENANT_USER: 'tenant_user' as const,
  GUEST: 'guest' as const,
  ADMIN: 'admin' as const,
  MODERATOR: 'moderator' as const,
} as const;

// Page permissions configuration
export const PAGE_PERMISSIONS: PagePermission[] = [
  {
    path: '/dashboard',
    allowedRoles: [ROLES.SAAS_ADMIN, ROLES.TENANT_ADMIN, ROLES.TENANT_USER, ROLES.GUEST],
    name: 'Dashboard',
    description: 'Main dashboard accessible to all authenticated users'
  },
  {
    path: '/tenants',
    allowedRoles: [ROLES.SAAS_ADMIN],
    name: 'Tenants',
    description: 'Tenant management - SaaS admin only'
  },
//   {
//     path: '/kbs',
//     allowedRoles: [ROLES.USER, ROLES.ADMIN, ROLES.MODERATOR],
//     name: 'Knowledge Bases',
//     description: 'Knowledge base management - Regular users and above'
//   },
//   {
//     path: '/installations',
//     allowedRoles: [ROLES.USER, ROLES.ADMIN, ROLES.MODERATOR],
//     name: 'Installations',
//     description: 'Installation management - Regular users and above'
//   },
//   {
//     path: '/onboarding',
//     allowedRoles: [ROLES.USER, ROLES.ADMIN, ROLES.MODERATOR],
//     name: 'Onboarding',
//     description: 'User onboarding - Regular users and above'
//   },
//   {
//     path: '/users',
//     allowedRoles: [ROLES.USER, ROLES.ADMIN, ROLES.MODERATOR],
//     name: 'Users',
//     description: 'User management - Regular users and above'
//   },
//   {
//     path: '/profile',
//     allowedRoles: [ROLES.SAAS_ADMIN, ROLES.USER, ROLES.ADMIN, ROLES.MODERATOR],
//     name: 'Profile',
//     description: 'User profile management - All authenticated users'
//   }
];

// Menu items configuration
export const MENU_ITEMS: MenuItem[] = [
  {
    icon: 'IconDashboard',
    label: 'Dashboard',
    href: '/dashboard',
    allowedRoles: [ROLES.SAAS_ADMIN, ROLES.TENANT_ADMIN, ROLES.TENANT_USER, ROLES.GUEST],
    order: 1
  },
  {
    icon: 'IconBuilding',
    label: 'Tenants',
    href: '/tenants',
    allowedRoles: [ROLES.SAAS_ADMIN],
    order: 2
  },
//   {
//     icon: 'IconBrain',
//     label: 'Knowledge Bases',
//     href: '/kbs',
//     allowedRoles: [ROLES.USER, ROLES.ADMIN, ROLES.MODERATOR],
//     order: 3
//   },
//   {
//     icon: 'IconCode',
//     label: 'Installations',
//     href: '/installations',
//     allowedRoles: [ROLES.USER, ROLES.ADMIN, ROLES.MODERATOR],
//     order: 4
//   }
];

// Helper functions
export const hasRole = (userRoles: string[] | undefined, requiredRoles: Role[]): boolean => {
  if (!userRoles || userRoles.length === 0) return false;
  return requiredRoles.some(role => userRoles.includes(role));
};

export const hasPageAccess = (userRoles: string[] | undefined, path: string): boolean => {
  const permission = PAGE_PERMISSIONS.find(p => p.path === path || path.startsWith(p.path + '/'));
  if (!permission) return false; // Default deny for unknown pages
  return hasRole(userRoles, permission.allowedRoles);
};

export const getAccessibleMenuItems = (userRoles: string[] | undefined): MenuItem[] => {
  return MENU_ITEMS
    .filter(item => hasRole(userRoles, item.allowedRoles))
    .sort((a, b) => a.order - b.order);
};

export const getPagePermission = (path: string): PagePermission | undefined => {
  return PAGE_PERMISSIONS.find(p => p.path === path || path.startsWith(p.path + '/'));
};
