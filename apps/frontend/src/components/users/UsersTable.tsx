'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { notifications } from '@/lib/notifications';
import { Badge } from '@/components/ui/badge';
import { useUsers } from '../../data/hooks/users.hooks';
import { OurTable, TableColumn, TableFilter, TableSort, TablePagination } from '../ui';
import type { User } from '../../data/types/api';

export default function UsersTable() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchValue, setSearchValue] = useState('');
  const [filters, setFilters] = useState<TableFilter>({});
  const [sort, setSort] = useState<TableSort | null>(null);

  // Use React Query hook for data fetching
  const {
    data: usersResponse,
    isLoading,
    error,
    refetch,
  } = useUsers(
    { 
      search: searchValue,
      ...filters 
    }, 
    { 
      page: currentPage, 
      pageSize,
      sort: sort?.column,
      order: sort?.direction
    }
  );

  // Extract data from React Query response
  const users = usersResponse?.users || [];
  const totalUsers = usersResponse?.pagination?.total || 0;

  // Handle error notifications
  if (error && !isLoading) {
    notifications.show({
      title: 'Error',
      message: `Failed to fetch users: ${error instanceof Error ? error.message : 'Unknown error'}`,
      color: 'red',
    });
  }

  // Pagination configuration
  const pagination: TablePagination = {
    page: currentPage,
    pageSize,
    total: totalUsers,
  };

  // Table columns configuration
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

  // Event handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    setCurrentPage(1);
  };

  const handleFilterChange = (newFilters: TableFilter) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handleSortChange = (newSort: TableSort) => {
    setSort(newSort);
    setCurrentPage(1);
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleUserClick = (user: User) => {
    router.push(`/users/${user.id}`);
  };

  return (
    <OurTable<User>
      data={users}
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