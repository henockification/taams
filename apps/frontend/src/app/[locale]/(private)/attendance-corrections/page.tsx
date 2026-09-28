import { ManualPunchRequestsPage } from '@/components/attendance/manual-punch-requests-page';
import type { PunchType } from '@/data/types/core.types';

const punchTypes = new Set<PunchType>(['IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN']);

export default async function AttendanceCorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; requestedPunchTime?: string; punchType?: string; open?: string }>;
}) {
  const params = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date : undefined;
  const requestedPunchTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(params.requestedPunchTime ?? '')
    ? params.requestedPunchTime
    : undefined;
  const punchType = punchTypes.has(params.punchType as PunchType) ? params.punchType as PunchType : undefined;

  return (
    <ManualPunchRequestsPage
      mode="employee"
      initialCorrection={{ date, requestedPunchTime, punchType, open: params.open === 'true' }}
    />
  );
}
