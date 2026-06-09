import * as React from "react";
import { Table } from "@tanstack/react-table";
import { Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchKey?: string;
  searchPlaceholder?: string;
  filterKey?: string;
  filterLabel?: string;
  filterOptions?: Array<{ label: string; value: string }>;
}

export function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder = "Search...",
  filterKey,
  filterLabel = "Filter",
  filterOptions,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0;
  const searchValue = searchKey
    ? (table.getColumn(searchKey)?.getFilterValue() as string) ?? ""
    : "";

  const handleSearchChange = (value: string) => {
    if (searchKey) {
      table.getColumn(searchKey)?.setFilterValue(value);
    }
  };

  const handleFilterChange = (value: string) => {
    if (filterKey) {
      if (value === "all") {
        table.getColumn(filterKey)?.setFilterValue(undefined);
      } else {
        table.getColumn(filterKey)?.setFilterValue(value);
      }
    }
  };

  const clearFilters = () => {
    if (searchKey) {
      table.getColumn(searchKey)?.setFilterValue("");
    }
    if (filterKey) {
      table.getColumn(filterKey)?.setFilterValue(undefined);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {searchKey && (
        <div className="relative min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="h-9 pl-8 pr-8"
          />
          {searchValue && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {filterKey && filterOptions && (
        <Select
          value={
            (table.getColumn(filterKey)?.getFilterValue() as string) ?? "all"
          }
          onValueChange={handleFilterChange}
        >
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder={filterLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {filterOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {isFiltered && (
        <Button
          variant="ghost"
          onClick={clearFilters}
          className="h-9 px-2 lg:px-3"
        >
          Reset
          <X className="ml-2 h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

