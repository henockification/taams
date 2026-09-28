'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCreateDepartment } from '@/data/hooks/core.hooks';
import type { Department } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { cn } from '@/lib/utils';

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Searchable department picker for one employment type. When the search matches
 * no existing department, it offers to create one with that name.
 */
export function DepartmentCombobox({
  id,
  departments,
  isContract,
  value,
  onChange,
  disabled,
}: {
  id?: string;
  departments: Department[];
  isContract: boolean;
  value: string;
  onChange: (departmentId: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const createDepartment = useCreateDepartment();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const options = useMemo(
    () => departments.filter((department) => department.isActive && department.isContract === isContract),
    [departments, isContract],
  );
  const selected = departments.find((department) => department.id === value);
  const query = normalizeName(search);
  const lowerQuery = query.toLowerCase();
  const matches = lowerQuery
    ? options.filter((department) => [department.nameEn, department.nameAm, department.code]
      .some((name) => name?.toLowerCase().includes(lowerQuery)))
    : options;
  const exactMatch = options.some((department) => normalizeName(department.nameEn).toLowerCase() === lowerQuery);

  const select = (departmentId: string) => {
    onChange(departmentId);
    setOpen(false);
    setSearch('');
  };

  const create = async () => {
    try {
      const response = await createDepartment.mutateAsync({ nameEn: query, isContract, isActive: true });
      notifications.show({ title: common('success'), message: t('departmentCreated'), color: 'green' });
      select(response.department.id);
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected?.nameEn ?? t('selectDepartment')}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t('searchDepartments')} value={search} onValueChange={setSearch} />
          <CommandList>
            {matches.length === 0 && !query ? <CommandEmpty>{t('noDepartmentsFound')}</CommandEmpty> : null}
            {matches.length > 0 ? (
              <CommandGroup>
                {matches.map((department) => (
                  <CommandItem key={department.id} value={department.id} onSelect={() => select(department.id)}>
                    <span className="flex-1 truncate">{department.nameEn}</span>
                    {department.id === value ? <Check className="size-4" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            {query && !exactMatch ? (
              <CommandGroup>
                <CommandItem value={`create:${query}`} onSelect={create} disabled={createDepartment.isPending}>
                  {createDepartment.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                  <span className="truncate">{t('createDepartmentNamed', { name: query })}</span>
                </CommandItem>
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
