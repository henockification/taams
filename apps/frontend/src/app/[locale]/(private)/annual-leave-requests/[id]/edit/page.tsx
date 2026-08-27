'use client';

import { useParams } from 'next/navigation';

import { AnnualLeaveRequestFormPage } from '@/components/leave/annual-leave-request-form-page';

export default function EditAnnualLeaveRequestRoute() {
  const params = useParams();
  return <AnnualLeaveRequestFormPage mode="edit" requestId={params.id as string} />;
}
