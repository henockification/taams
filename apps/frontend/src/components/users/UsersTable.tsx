'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { notifications } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { useUsers } from '../../data/hooks/users.hooks';
import { OurTable, TableColumn, TableFilter, TableSort, TablePagination } from '../ui';
import type { User } from '../../data/types/api';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

const NO_ROLE_VALUE = '__none';

export default function UsersTable() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('users');
  const { formatDate } = useCalendarPreference();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchValue, setSearchValue] = useState('');
  const [filters, setFilters] = useState<TableFilter>(() => {
    const role = searchParams.get('role');
    const initial: TableFilter = role ? { role: [role] } : {};
    return initial;
  });
  const [sort, setSort] = useState<TableSort | null>(null);

  // Fetch all users once; search/filter/sort/paginate client-side (same pattern as permanent employees)
  const {
    data: usersResponse,
    isLoading,
    error,
    refetch,
  } = useUsers({}, { page: 1, pageSize: 10000 });

  const allUsers = useMemo(() => usersResponse?.users || [], [usersResponse]);

  // Headcount per role; a user with several roles counts under each of them.
  const roleCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const user of allUsers) {
      const roles = user.role?.length ? user.role : [NO_ROLE_VALUE];
      for (const role of new Set(roles)) counts.set(role, (counts.get(role) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([role, count]) => ({ role, count }))
      .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role));
  }, [allUsers]);

  const roleFilterValues = useMemo(() => {
    const value = filters.role;
    if (value === undefined || value === '') return [];
    return Array.isArray(value) ? value : [value];
  }, [filters.role]);

  const roleLabel = (role: string) => (role === NO_ROLE_VALUE ? t('noRole') : role);

  const toggleRoleFilter = (role: string | null) => {
    setFilters((current) => ({
      ...current,
      role: role === null || (roleFilterValues.length === 1 && roleFilterValues[0] === role) ? [] : [role],
    }));
  };

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const emailVerifiedFilter = filters.emailVerified;
    const lockedFilter = filters.locked;

    let result = allUsers.filter((user) => {
      if (emailVerifiedFilter !== undefined && emailVerifiedFilter !== '') {
        const values = Array.isArray(emailVerifiedFilter)
          ? emailVerifiedFilter
          : [emailVerifiedFilter];
        const matchesStatus = values.some(
          (value) => String(user.emailVerified) === String(value)
        );
        if (!matchesStatus) return false;
      }

      if (lockedFilter !== undefined && lockedFilter !== '') {
        const values = Array.isArray(lockedFilter) ? lockedFilter : [lockedFilter];
        const status = user.accessRevoked ? 'revoked' : String(Boolean(user.locked));
        const matchesLock = values.some((value) => status === String(value));
        if (!matchesLock) return false;
      }

      if (roleFilterValues.length > 0) {
        const roles = user.role?.length ? user.role : [NO_ROLE_VALUE];
        if (!roleFilterValues.some((role) => roles.includes(role))) return false;
      }

      if (!query) return true;

      const haystack = [user.name, user.email, user.phone, ...(user.role ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });

    if (sort) {
      const { column, direction } = sort;
      result = [...result].sort((a, b) => {
        const aValue = a[column as keyof User];
        const bValue = b[column as keyof User];

        if (aValue == null && bValue == null) return 0;
        if (aValue == null) return direction === 'asc' ? -1 : 1;
        if (bValue == null) return direction === 'asc' ? 1 : -1;

        if (typeof aValue === 'string' && typeof bValue === 'string') {
          const comparison = aValue.localeCompare(bValue);
          return direction === 'asc' ? comparison : -comparison;
        }

        if (aValue instanceof Date || bValue instanceof Date || column === 'createdAt') {
          const aTime = new Date(aValue as string).getTime();
          const bTime = new Date(bValue as string).getTime();
          return direction === 'asc' ? aTime - bTime : bTime - aTime;
        }

        if (aValue < bValue) return direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [allUsers, filters, roleFilterValues, searchValue, sort]);

  const totalUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedUsers = filteredUsers.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  useEffect(() => {
    if (safePage !== currentPage) {
      setCurrentPage(safePage);
    }
  }, [currentPage, safePage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters, pageSize, searchValue, sort]);

  if (error && !isLoading) {
    notifications.show({
      title: 'Error',
      message: `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      color: 'red',
    });
  }

  const pagination: TablePagination = {
    page: safePage,
    pageSize,
    total: totalUsers,
  };

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      render: (value) => (
        <span className="font-medium">
          {value || 'N/A'}
        </span>
      ),
      sortable: true,
    },
    {
      key: 'email',
      title: 'Email',
      dataIndex: 'email',
      sortable: true,
      render: (value) => value || '—',
    },
    {
      key: 'phone',
      title: 'Phone',
      dataIndex: 'phone',
      sortable: true,
      render: (value) => value || '—',
    },
    {
      key: 'locked',
      title: t('loginStatus'),
      dataIndex: 'locked',
      render: (value, record) => (
        <Badge variant={record.accessRevoked || value ? 'destructive' : 'outline'}>
          {record.accessRevoked ? t('accessRevoked') : value ? t('locked') : t('active')}
        </Badge>
      ),
      filterable: true,
      filterOptions: [
        { label: t('accessRevoked'), value: 'revoked' },
        { label: t('locked'), value: 'true' },
        { label: t('active'), value: 'false' },
      ],
    },
    {
      key: 'emailVerified',
      title: 'Status',
      dataIndex: 'emailVerified',
      render: (value) => (
        <Badge variant={value ? 'default' : 'secondary'}>
          {value ? 'Verified' : 'Unverified'}
        </Badge>
      ),
      filterable: true,
      filterOptions: [
        { label: 'Verified', value: 'true' },
        { label: 'Unverified', value: 'false' },
      ],
    },
    {
      key: 'role',
      title: 'Roles',
      dataIndex: 'role',
      render: (value: string[]) => (
        <div className="flex items-center gap-2">
          {value?.map((role, index) => (
            <Badge key={index} variant="outline">
              {role}
            </Badge>
          )) || <span className="text-muted-foreground">No roles</span>}
        </div>
      ),
      filterable: true,
      filterOptions: roleCounts.map(({ role, count }) => ({
        label: `${roleLabel(role)} (${count})`,
        value: role,
      })),
    },
    {
      key: 'createdAt',
      title: 'Created',
      dataIndex: 'createdAt',
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(value)}
        </span>
      ),
      sortable: true,
    },
  ];

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };

  const handleFilterChange = (newFilters: TableFilter) => {
    setFilters(newFilters);
  };

  const handleSortChange = (newSort: TableSort) => {
    setSort(newSort);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleUserClick = (user: User) => {
    router.push(`/users/${user.id}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2" aria-label={t('usersByRole')}>
        <RoleCountChip
          label={t('allUsers')}
          count={allUsers.length}
          active={roleFilterValues.length === 0}
          onClick={() => toggleRoleFilter(null)}
        />
        {roleCounts.map(({ role, count }) => (
          <RoleCountChip
            key={role}
            label={roleLabel(role)}
            count={count}
            active={roleFilterValues.includes(role)}
            onClick={() => toggleRoleFilter(role)}
          />
        ))}
      </div>
      <OurTable<User>
        data={paginatedUsers}
        columns={columns}
        loading={isLoading}
        error={error ? (error instanceof Error ? error.message : 'An unexpected error occurred') : null}
        pagination={pagination}
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        searchable={true}
        searchPlaceholder="Search users..."
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        filterable={true}
        filters={filters}
        onFilterChange={handleFilterChange}
        sortable={true}
        sort={sort || undefined}
        onSortChange={handleSortChange}
        onRefresh={handleRefresh}
        onRowClick={handleUserClick}
        striped={true}
        emptyMessage="No users found"
        pageSizeOptions={[5, 10, 20, 50]}
        showTotal={true}
        showPageSizeSelector={true}
      />
    </div>
  );
}

function RoleCountChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-background text-foreground hover:bg-muted',
      )}
    >
      <span>{label}</span>
      <span className={cn('font-semibold tabular-nums', active ? '' : 'text-muted-foreground')}>{count}</span>
    </button>
  );
}
