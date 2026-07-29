import { redirect } from '@/i18n';

export default async function LeaveManagementRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/leave-management/fiscal-years', locale });
}
