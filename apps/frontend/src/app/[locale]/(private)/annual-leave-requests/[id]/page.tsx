'use client';

import { useParams } from 'next/navigation';

import { LeaveRequestDetailPage } from '@/components/leave/leave-request-detail-page';

export default function AnnualLeaveRequestDetailRoute() {
  const params = useParams();
  return <LeaveRequestDetailPage requestId={params.id as string} backHref="/annual-leave-requests" />;
}
