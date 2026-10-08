import { UserManualPage } from '@/components/help/user-manual-page';

export default async function HelpRoute({ searchParams }: { searchParams: Promise<{ manual?: string }> }) {
  const params = await searchParams;
  return <UserManualPage initialManual={params.manual} />;
}
