import { redirect } from '@/i18n';

export default async function EmployeesDetailRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { locale, id } = await params;
  const { from } = await searchParams;

  if (from === 'permanent-employees') {
    redirect({ href: `/permanent-employees/${id}`, locale });
  }

  redirect({ href: `/contract-employees/${id}`, locale });
}
