import { redirect } from '@/i18n';

export default async function LeaveBalancesRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/leave-management/balances', locale });
}
