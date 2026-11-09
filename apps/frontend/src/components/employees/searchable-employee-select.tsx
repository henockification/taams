'use client';

import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useEmployeeDepartmentLabel } from '@/components/employees/employee-department';
import type { Employee } from '@/data/types/core.types';
import { useEmployeeName } from '@/lib/employee-name';
import { matchesEmployeePickerSearch } from '@/lib/employee-picker-search';
import { cn } from '@/lib/utils';

/** Employee picker with a search box (name in either language, code, IDs, department, email, phone). */
export function SearchableEmployeeSelect({
  id,
  value,
  onValueChange,
  employees,
  disabled,
  placeholder,
  searchPlaceholder,
  emptyMessage,
}: {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  employees: Employee[];
  disabled?: boolean;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
}) {
  const employeeName = useEmployeeName();
  const employeeDepartmentLabel = useEmployeeDepartmentLabel();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedEmployee = employees.find((employee) => employee.id === value);
  const matchingEmployees = employees.filter((employee) => matchesEmployeePickerSearch(employee, search));

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="h-10 w-full justify-between font-normal"
        >
          <span className="truncate">
            {selectedEmployee ? `${employeeName(selectedEmployee)} - ${selectedEmployee.employeeCode}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0" style={{ width: 'var(--radix-popover-trigger-width)' }}>
        <Command shouldFilter={false}>
          <CommandInput placeholder={searchPlaceholder} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <p className="px-2 py-1 text-xs text-muted-foreground">{matchingEmployees.length} / {employees.length}</p>
            <CommandGroup>
              {matchingEmployees.map((employee) => {
                const name = employeeName(employee);
                const description = [
                  employee.employeeCode,
                  employeeDepartmentLabel(employee.id, employee.department?.nameEn ?? employee.sourceDepartmentName),
                  employee.email,
                  employee.phoneNumber,
                ].filter(Boolean).join(' ');
                return (
                  <CommandItem
                    key={employee.id}
                    value={employee.id}
                    onSelect={() => {
                      onValueChange(employee.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn('size-4', value === employee.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{description}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
