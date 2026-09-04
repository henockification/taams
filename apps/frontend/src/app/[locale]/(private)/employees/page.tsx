import { redirect } from '@/i18n';

export default async function EmployeesListRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect({ href: '/contract-employees', locale });
}
