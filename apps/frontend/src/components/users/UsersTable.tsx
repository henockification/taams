'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifications } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { useUsers } from '../../data/hooks/users.hooks';
import { OurTable, TableColumn, TableFilter, TableSort, TablePagination } from '../ui';
import type { User } from '../../data/types/api';

export default function UsersTable() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [searchValue, setSearchValue] = useState('');
  const [filters, setFilters] = useState<TableFilter>({});
  const [sort, setSort] = useState<TableSort | null>(null);

  // Fetch all users once; search/filter/sort/paginate client-side (same pattern as permanent employees)
  const {
    data: usersResponse,
    isLoading,
    error,
    refetch,
  } = useUsers({}, { page: 1, pageSize: 10000 });

  const allUsers = usersResponse?.users || [];

  const filteredUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    const emailVerifiedFilter = filters.emailVerified;

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

      if (!query) return true;

      const haystack = [user.name, user.email, ...(user.role ?? [])]
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
  }, [allUsers, filters, searchValue, sort]);

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
    },
    {
      key: 'createdAt',
      title: 'Created',
      dataIndex: 'createdAt',
      render: (value) => (
        <span className="text-sm text-muted-foreground">
          {new Date(value).toLocaleDateString()}
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
  );
}
