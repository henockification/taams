import { AttendanceApprovalsPage } from '@/components/attendance/attendance-approvals-page';

export default async function HrAttendanceApprovalsRoute({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; approval?: string; search?: string }>;
}) {
  const params = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? '') ? params.date : undefined;
  const approval = params.approval === 'approved' || params.approval === 'unapproved' ? params.approval : undefined;

  return (
    <AttendanceApprovalsPage
      mode="hr"
      initialFilters={{ date, approval, search: params.search?.trim() || undefined }}
    />
  );
}
