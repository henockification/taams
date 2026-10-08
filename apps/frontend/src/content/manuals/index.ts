import {
  type AuthzUser,
  hasDelegatedSupervisorAccess,
  hasExactSupervisorRole,
  isSuperAdmin,
} from '@/config/app-navigation';
import type { ManualContent } from './types';
import contractEmployeeManual from './contract-employee.json';
import hrManual from './hr.json';
import permanentEmployeeManual from './permanent-employee.json';
import supervisorManual from './supervisor.json';

export type ManualId = 'hr' | 'supervisor' | 'contract-employee' | 'permanent-employee';

type ManualEntry = {
  id: ManualId;
  content: ManualContent;
  /** Whether the manual describes this user's own work. */
  appliesTo: (user: AuthzUser) => boolean;
};

const roles = (user: AuthzUser) => user?.role?.map((role) => role.toLowerCase()) ?? [];
const isAdministrator = (user: AuthzUser) => isSuperAdmin(user) || roles(user).includes('admin');

// Ordered by priority: the first manual that applies opens by default.
const MANUALS: ManualEntry[] = [
  { id: 'hr', content: hrManual as ManualContent, appliesTo: (user) => roles(user).includes('human_resource') },
  {
    id: 'supervisor',
    content: supervisorManual as ManualContent,
    appliesTo: (user) => hasExactSupervisorRole(user) || hasDelegatedSupervisorAccess(user),
  },
  {
    id: 'contract-employee',
    content: contractEmployeeManual as ManualContent,
    appliesTo: (user) => user?.employeeEmploymentType === 'CONTRACT',
  },
  {
    id: 'permanent-employee',
    content: permanentEmployeeManual as ManualContent,
    appliesTo: (user) => user?.employeeEmploymentType === 'PERMANENT',
  },
];

/** Manuals for the signed-in user; administrators can open every manual. */
export function getManualsForUser(user: AuthzUser) {
  if (isAdministrator(user)) return MANUALS;
  return MANUALS.filter((manual) => manual.appliesTo(user));
}

export function manualAssetPath(manualId: string, file: string) {
  return `/manuals/${manualId}/${file}`;
}
