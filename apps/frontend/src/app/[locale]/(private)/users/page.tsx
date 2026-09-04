'use client';

import UsersTable from '@/components/users/UsersTable';

export default function UsersPage() {
  return (
    <div className="flex w-full flex-col gap-6">
      <UsersTable />
    </div>
  );
}
