'use client';

import { ShieldCheck } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

type DelegatedCapability = {
  id: string;
  supervisorEmployee?: {
    firstNameEn?: string | null;
    middleNameEn?: string | null;
    lastNameEn?: string | null;
  } | null;
  endsAt?: string | null;
};

type SessionUserWithDelegation = {
  delegatedSupervisorCapabilities?: DelegatedCapability[];
  hasDelegatedSupervisorAccess?: boolean;
} | null | undefined;

export function getActiveDelegatedCapability(user: SessionUserWithDelegation) {
  const now = Date.now();
  return user?.delegatedSupervisorCapabilities?.find((delegation) => (
    !delegation.endsAt || new Date(delegation.endsAt).getTime() > now
  )) ?? null;
}

export function DelegationBanner({ user }: { user: SessionUserWithDelegation }) {
  const delegation = getActiveDelegatedCapability(user);
  if (!delegation) return null;

  return (
    <Alert className="border-blue-200 bg-blue-50 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
      <ShieldCheck className="h-4 w-4" />
      <AlertTitle>Delegated supervisor access</AlertTitle>
      <AlertDescription>
        Acting as delegate for {employeeName(delegation.supervisorEmployee)}
        {delegation.endsAt ? ` until ${formatDateTime(delegation.endsAt)}` : ''}.
      </AlertDescription>
    </Alert>
  );
}

export function DelegationAuditBadge({ delegationId }: { delegationId?: string | null }) {
  if (!delegationId) return null;
  return <Badge variant="outline">Completed as delegate</Badge>;
}

export function delegatedActionLabel(label: string, user: SessionUserWithDelegation) {
  return getActiveDelegatedCapability(user) ? `${label} as delegate` : label;
}

function employeeName(employee?: DelegatedCapability['supervisorEmployee']) {
  if (!employee) return 'supervisor';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ') || 'supervisor';
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
