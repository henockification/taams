'use client';

import UsersTable from '@/components/users/UsersTable';

export default function UsersPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <UsersTable />
    </div>
  );
}
