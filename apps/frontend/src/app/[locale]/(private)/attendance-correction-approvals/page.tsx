import { ManualPunchRequestsPage } from '@/components/attendance/manual-punch-requests-page';

export default async function AttendanceCorrectionApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ requestId?: string }>;
}) {
  const params = await searchParams;

  return <ManualPunchRequestsPage mode="supervisor" focusRequestId={params.requestId || undefined} />;
}
