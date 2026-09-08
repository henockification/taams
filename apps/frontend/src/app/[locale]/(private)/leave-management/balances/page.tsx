import { redirect } from '@/i18n';

export default async function LeaveBalancesRoute({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/leave-balances', locale });
}
