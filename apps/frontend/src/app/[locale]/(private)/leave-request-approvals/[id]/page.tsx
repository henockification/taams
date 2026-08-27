'use client';

import { useParams } from 'next/navigation';

import { LeaveRequestDetailPage } from '@/components/leave/leave-request-detail-page';

export default function LeaveRequestApprovalDetailRoute() {
  const params = useParams();
  return <LeaveRequestDetailPage requestId={params.id as string} backHref="/leave-request-approvals" approvalMode />;
}
