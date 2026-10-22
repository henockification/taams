import { AttendanceApprovalsPage } from '@/components/attendance/attendance-approvals-page';

export default async function HrAttendanceApprovalsRoute({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; approval?: string; search?: string; exception?: string }>;
}) {
  const params = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date : undefined;
  const approval = params.approval === 'approved' || params.approval === 'unapproved' ? params.approval : undefined;
  const exception = params.exception === 'late' || params.exception === 'missing-checkout'
    || params.exception === 'early-departure' || params.exception === 'any'
    ? params.exception
    : undefined;

  return (
    <AttendanceApprovalsPage
      mode="hr"
      initialFilters={{ date, approval, exception, search: params.search?.trim() || undefined }}
    />
  );
}
