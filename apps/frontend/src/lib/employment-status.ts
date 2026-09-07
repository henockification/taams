import type { EmploymentStatus } from '@/data/types/core.types';

export const SOURCE_EMPLOYMENT_STATUS = {
  WORKING: 'በስራ ላይ',
  RESIGNED: 'በገዛ ፍቃድ የተሰናበቱ',
  RETIRED: 'በጡረታ የተገለሉ',
} as const;

export const SOURCE_EMPLOYMENT_STATUS_OPTIONS = [
  {
    value: SOURCE_EMPLOYMENT_STATUS.WORKING,
    key: 'WORKING' as const,
    employmentStatus: 'ACTIVE' as const satisfies EmploymentStatus,
    isActive: true,
    matches: ['በስራ ላይ', 'በ ስራ ላይ', 'working', 'active', 'on duty', 'employed'],
  },
  {
    value: SOURCE_EMPLOYMENT_STATUS.RESIGNED,
    key: 'RESIGNED' as const,
    employmentStatus: 'TERMINATED' as const satisfies EmploymentStatus,
    isActive: false,
    matches: ['በገዛ ፍቃድ የተሰናበቱ', 'resigned', 'left by own request', 'terminated', 'separated', 'inactive'],
  },
  {
    value: SOURCE_EMPLOYMENT_STATUS.RETIRED,
    key: 'RETIRED' as const,
    employmentStatus: 'TERMINATED' as const satisfies EmploymentStatus,
    isActive: false,
    matches: ['በጡረታ የተገለሉ', 'retired'],
  },
] as const;

export type SourceEmploymentStatusValue = (typeof SOURCE_EMPLOYMENT_STATUS_OPTIONS)[number]['value'];

function normalizeStatusText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function statusTextMatches(normalized: string, match: string) {
  const needle = normalizeStatusText(match);
  if (!needle) return false;
  if (/^[a-z]+(?: [a-z]+)*$/.test(needle)) {
    return normalized === needle
      || normalized.split(/[^a-z0-9]+/).filter(Boolean).join(' ') === needle;
  }
  return normalized.includes(needle);
}

export function matchSourceEmploymentStatus(value: string | null | undefined) {
  if (!value?.trim()) return null;
  const normalized = normalizeStatusText(value);
  return SOURCE_EMPLOYMENT_STATUS_OPTIONS.find((option) => (
    option.matches.some((match) => statusTextMatches(normalized, match))
  )) ?? null;
}

export function resolveEmploymentFields(value: string | null | undefined, employmentStatus?: EmploymentStatus | string | null) {
  const matched = matchSourceEmploymentStatus(value);
  if (matched) {
    return {
      sourceEmploymentStatus: matched.value,
      employmentStatus: matched.employmentStatus,
      isActive: matched.isActive,
    };
  }

  if (employmentStatus === 'INACTIVE') {
    return { sourceEmploymentStatus: SOURCE_EMPLOYMENT_STATUS.RESIGNED, employmentStatus: 'INACTIVE' as const, isActive: false };
  }
  if (employmentStatus === 'SUSPENDED') {
    return { sourceEmploymentStatus: SOURCE_EMPLOYMENT_STATUS.RESIGNED, employmentStatus: 'SUSPENDED' as const, isActive: false };
  }
  if (employmentStatus === 'TERMINATED') {
    return { sourceEmploymentStatus: SOURCE_EMPLOYMENT_STATUS.RESIGNED, employmentStatus: 'TERMINATED' as const, isActive: false };
  }

  return {
    sourceEmploymentStatus: SOURCE_EMPLOYMENT_STATUS.WORKING,
    employmentStatus: 'ACTIVE' as const,
    isActive: true,
  };
}

export function canonicalSourceEmploymentStatus(
  sourceEmploymentStatus: string | null | undefined,
  employmentStatus?: EmploymentStatus | string | null,
) {
  return resolveEmploymentFields(sourceEmploymentStatus, employmentStatus).sourceEmploymentStatus;
}

export function displayEmploymentStatus(
  sourceEmploymentStatus: string | null | undefined,
  employmentStatus?: EmploymentStatus | string | null,
) {
  return sourceEmploymentStatus?.trim() || canonicalSourceEmploymentStatus(sourceEmploymentStatus, employmentStatus);
}
