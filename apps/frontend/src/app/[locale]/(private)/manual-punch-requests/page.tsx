import { redirect } from '@/i18n';

export default async function ManualPunchRequestsRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/attendance-corrections', locale });
}
