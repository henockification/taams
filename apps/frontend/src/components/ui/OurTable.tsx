'use client';

import { useState } from 'react';
import {
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  ChevronDown,
  ArrowUp,
  ArrowDown,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Generic interfaces for the table component
export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex: string;
  width?: string | number;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  filterOptions?: Array<{ label: string; value: string }>;
}

export interface TableFilter {
  [key: string]: string | string[];
}

export interface TableSort {
  column: string;
  direction: 'asc' | 'desc';
}

export interface TablePagination {
  page: number;
  pageSize: number;
  total: number;
}

export interface OurTableProps<T = any> {
  // Data
  data: T[];
  columns: TableColumn<T>[];
  
  // Loading and error states
  loading?: boolean;
  error?: string | null;
  
  // Pagination
  pagination?: TablePagination;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  
  // Search and filtering
  searchable?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  
  filterable?: boolean;
  filters?: TableFilter;
  onFilterChange?: (filters: TableFilter) => void;
  
  // Sorting
  sortable?: boolean;
  sort?: TableSort;
  onSortChange?: (sort: TableSort) => void;
  
  // Actions
  onRefresh?: () => void;
  onRowClick?: (record: T) => void;
  
  // Styling
  striped?: boolean;
  stickyHeader?: boolean;
  
  // Customization
  emptyMessage?: string;
  pageSizeOptions?: number[];
  showTotal?: boolean;
  showPageSizeSelector?: boolean;
}

export function OurTable<T extends Record<string, any>>({
  data,
  columns,
  loading = false,
  error = null,
  pagination,
  onPageChange,
  onPageSizeChange,
  searchable = true,
  searchPlaceholder = 'Search...',
  searchValue = '',
  onSearchChange,
  filterable = true,
  filters = {},
  onFilterChange,
  sortable = true,
  sort,
  onSortChange,
  onRefresh,
  onRowClick,
  striped = true,
  stickyHeader = false,
  emptyMessage = 'No data available',
  pageSizeOptions = [5, 10, 20, 50],
  showTotal = true,
  showPageSizeSelector = true,
}: OurTableProps<T>) {
  // Local state for search and filters
  const [localSearch, setLocalSearch] = useState(searchValue);
  const [localFilters, setLocalFilters] = useState<TableFilter>(filters);
  const [localSort, setLocalSort] = useState<TableSort | null>(sort || null);

  // Handle search
  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    onSearchChange?.(value);
  };

  // Handle filter changes
  const handleFilterChange = (column: string, value: string | string[]) => {
    const newFilters = { ...localFilters, [column]: value };
    setLocalFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  // Handle sort changes
  const handleSortChange = (column: string) => {
    const currentSort = localSort?.column === column ? localSort.direction : null;
    const newDirection: 'asc' | 'desc' = currentSort === 'asc' ? 'desc' : 'asc';
    const newSort = { column, direction: newDirection };
    
    setLocalSort(newSort);
    onSortChange?.(newSort);
  };

  // Clear all filters
  const clearFilters = () => {
    setLocalFilters({});
    onFilterChange?.({});
  };

  // Get sort icon for column
  const getSortIcon = (columnKey: string) => {
    if (!localSort || localSort.column !== columnKey) {
      return <ChevronDown className="size-3.5" />;
    }
    return localSort.direction === 'asc' 
      ? <ArrowUp className="size-3.5" /> 
      : <ArrowDown className="size-3.5" />;
  };

  // Check if any filters are active
  const hasActiveFilters = Object.values(localFilters).some(value => 
    value && (Array.isArray(value) ? value.length > 0 : value !== '')
  );

  // Render loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Spinner className="size-8" />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        {onRefresh && (
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="size-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter Controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-4 flex-wrap">
          {/* Search Input */}
          {searchable && (
            <div className="relative min-w-[250px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 pr-9"
              />
              {localSearch && (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          )}

          {/* Filter Menu */}
          {filterable && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={hasActiveFilters ? 'default' : 'outline'}
                >
                  <Filter className="size-4 mr-2" />
                  Filters
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-2">
                      {Object.keys(localFilters).length}
                    </Badge>
                  )}
                  <ChevronDown className="size-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[200px]">
                {columns
                  .filter(col => col.filterable && col.filterOptions)
                  .map(column => (
                    <div key={column.key} className="p-2">
                      <p className="text-sm font-semibold mb-2">
                        {column.title}
                      </p>
                      {column.filterOptions?.map(option => (
                        <div key={option.value} className="flex items-center gap-2 mb-2">
                          <Checkbox
                            id={`${column.key}-${option.value}`}
                            checked={
                              Array.isArray(localFilters[column.key])
                                ? (localFilters[column.key] as string[]).includes(option.value)
                                : localFilters[column.key] === option.value
                            }
                            onCheckedChange={(checked) => {
                              if (Array.isArray(localFilters[column.key])) {
                                const currentValues = localFilters[column.key] as string[];
                                const newValues = checked
                                  ? [...currentValues, option.value]
                                  : currentValues.filter(v => v !== option.value);
                                handleFilterChange(column.key, newValues);
                              } else {
                                handleFilterChange(
                                  column.key,
                                  checked ? option.value : ''
                                );
                              }
                            }}
                          />
                          <label htmlFor={`${column.key}-${option.value}`} className="text-sm cursor-pointer">
                            {option.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                >
                  <X className="size-4 mr-2" />
                  Clear All Filters
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader className={stickyHeader ? 'sticky top-0 z-10 bg-background' : ''}>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  style={{ 
                    width: column.width,
                  }}
                  className={sortable && column.sortable ? 'cursor-pointer' : ''}
                  onClick={() => {
                    if (sortable && column.sortable) {
                      handleSortChange(column.key);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{column.title}</span>
                    {sortable && column.sortable && getSortIcon(column.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center py-12">
                  <p className="text-muted-foreground">{emptyMessage}</p>
                </TableCell>
              </TableRow>
            ) : (
              data.map((record, index) => (
                <TableRow
                  key={record.id || index}
                  className={`${onRowClick ? 'cursor-pointer hover:bg-muted' : ''} ${striped && index % 2 === 1 ? 'bg-muted/50' : ''}`}
                  onClick={() => onRowClick?.(record)}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key}>
                      {column.render
                        ? column.render(record[column.dataIndex], record, index)
                        : record[column.dataIndex]
                      }
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination and Controls */}
      {pagination && onPageChange && (
        <div className="flex items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-4">
            {showTotal && (
              <p className="text-sm text-muted-foreground">
                Showing {data.length} of {pagination.total} entries
              </p>
            )}
            {showPageSizeSelector && onPageSizeChange && (
              <div className="flex items-center gap-2">
                <p className="text-sm">Rows per page:</p>
                <Select
                  value={pagination.pageSize.toString()}
                  onValueChange={(value) => onPageSizeChange(parseInt(value || '10'))}
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pageSizeOptions.map(size => (
                      <SelectItem key={size} value={size.toString()}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {pagination.total > pagination.pageSize && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                >
                  Previous
                </Button>
                <p className="text-sm px-3">
                  {pagination.page} / {Math.ceil(pagination.total / pagination.pageSize)}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize)}
                >
                  Next
                </Button>
              </div>
            )}
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
