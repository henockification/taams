'use client';

import type { FormEvent } from 'react';
import { useMemo, useState } from 'react';
import { Building2, Check, ChevronsUpDown, Search } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useDepartments,
  useHrDepartmentAssignmentUsers,
  useReplaceHrDepartmentAssignments,
} from '@/data/hooks/core.hooks';
import type { Department, HrDepartmentAssignmentUser } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { cn } from '@/lib/utils';

export function DepartmentAssignmentsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { data: usersResponse, isLoading: usersLoading } = useHrDepartmentAssignmentUsers();
  const { data: departmentsResponse, isLoading: departmentsLoading } = useDepartments();
  const replaceAssignments = useReplaceHrDepartmentAssignments();

  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState<HrDepartmentAssignmentUser | null>(null);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<Set<string>>(new Set());
  const [departmentPickerOpen, setDepartmentPickerOpen] = useState(false);

  const users = usersResponse?.users ?? [];
  const departments = departmentsResponse?.departments ?? [];
  const departmentsById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments]);
  const departmentOptions = useMemo(() => buildDepartmentOptions(departments), [departments]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;

    return users.filter((user) => {
      const departmentText = user.departmentAssignments
        .map((assignment) => assignment.department?.nameEn ?? departmentsById.get(assignment.departmentId)?.nameEn)
        .filter(Boolean)
        .join(' ');
      return [
        user.name,
        user.email,
        user.phone,
        user.roles.join(' '),
        departmentText,
      ].filter(Boolean).join(' ').toLowerCase().includes(query);
    });
  }, [departmentsById, search, users]);

  const openEditDialog = (user: HrDepartmentAssignmentUser) => {
    setEditingUser(user);
    setSelectedDepartmentIds(new Set(user.departmentAssignments.map((assignment) => assignment.departmentId)));
    setDepartmentPickerOpen(false);
  };

  const toggleDepartment = (departmentId: string) => {
    setSelectedDepartmentIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  };

  const saveAssignments = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUser) return;

    try {
      await replaceAssignments.mutateAsync({
        userId: editingUser.id,
        departmentIds: [...selectedDepartmentIds],
      });
      notifications.show({
        title: common('success'),
        message: selectedDepartmentIds.size === 0 ? t('departmentAssignmentsCleared') : t('departmentAssignmentsSaved'),
        color: 'green',
      });
      setEditingUser(null);
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  const selectedDepartments = [...selectedDepartmentIds]
    .map((departmentId) => departmentsById.get(departmentId))
    .filter(Boolean) as Department[];
  const loading = usersLoading || departmentsLoading;

  return (
    <div className="flex w-full flex-col gap-6">
      <Card className="rounded-lg">
        <CardHeader className="gap-2">
          <div>
            <CardTitle>{t('departmentAssignments')}</CardTitle>
            <CardDescription>{t('departmentAssignmentsDescription')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('searchHrUsers')}
                className="pl-9"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {t('showingRecords', { from: filteredUsers.length === 0 ? 0 : 1, to: filteredUsers.length, total: filteredUsers.length })}
            </p>
          </div>

          {loading ? (
            <p className="py-8 text-sm text-muted-foreground">{common('loading')}</p>
          ) : filteredUsers.length === 0 ? (
            <EmptyState icon={Building2} title={t('noHrUsersFound')} description={t('noHrUsersFoundDescription')} />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('user')}</TableHead>
                    <TableHead>{t('contact')}</TableHead>
                    <TableHead>{t('assignedDepartments')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="min-w-48">
                          <p className="font-medium text-foreground">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.roles.join(', ')}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="min-w-52 text-sm">
                          <p>{user.email ?? '-'}</p>
                          <p className="text-muted-foreground">{user.phone ?? '-'}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <DepartmentAssignmentBadges user={user} departmentsById={departmentsById} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button type="button" variant="outline" size="sm" onClick={() => openEditDialog(user)}>
                          {common('edit')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(editingUser)} onOpenChange={(open) => {
        if (!open) setEditingUser(null);
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t('editDepartmentAssignments')}</DialogTitle>
            <DialogDescription>
              {editingUser ? t('editDepartmentAssignmentsDescription', { user: editingUser.name }) : ''}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={saveAssignments}>
            <div className="space-y-2">
              <Label>{t('departments')}</Label>
              <Popover open={departmentPickerOpen} onOpenChange={setDepartmentPickerOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" className="h-auto min-h-10 w-full justify-between">
                    <span className="line-clamp-2 text-left">
                      {selectedDepartmentIds.size === 0
                        ? t('allDepartments')
                        : t('selectedDepartments', { count: selectedDepartmentIds.size })}
                    </span>
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(36rem,calc(100vw-2rem))] p-0" align="start">
                  <Command>
                    <CommandInput placeholder={t('searchDepartments')} />
                    <CommandList>
                      <CommandEmpty>{t('noDepartmentsFound')}</CommandEmpty>
                      <CommandGroup>
                        {departmentOptions.map((option) => {
                          const selected = selectedDepartmentIds.has(option.department.id);
                          return (
                            <CommandItem
                              key={option.department.id}
                              value={`${option.department.nameEn} ${option.department.nameAm ?? ''} ${option.department.code ?? ''}`}
                              onSelect={() => toggleDepartment(option.department.id)}
                              className="gap-2"
                            >
                              <Checkbox checked={selected} aria-hidden />
                              <span className={cn('flex-1', option.depth > 0 && 'text-muted-foreground')}>
                                {option.depth > 0 ? `${'— '.repeat(option.depth)}` : ''}
                                {option.department.nameEn}
                              </span>
                              {selected ? <Check className="size-4" /> : null}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">{t('departmentAssignmentsInheritanceNote')}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {selectedDepartments.length === 0 ? (
                <Badge variant="secondary">{t('allDepartments')}</Badge>
              ) : selectedDepartments.map((department) => (
                <Badge key={department.id} variant="secondary">{department.nameEn}</Badge>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>{common('cancel')}</Button>
              <Button type="button" variant="ghost" onClick={() => setSelectedDepartmentIds(new Set())}>
                {t('clearAssignments')}
              </Button>
              <Button type="submit" disabled={replaceAssignments.isPending}>
                {replaceAssignments.isPending ? common('loading') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DepartmentAssignmentBadges({
  user,
  departmentsById,
}: {
  user: HrDepartmentAssignmentUser;
  departmentsById: Map<string, Department>;
}) {
  const t = useTranslations('core');
  const assignments = user.departmentAssignments ?? [];

  if (assignments.length === 0) {
    return <Badge variant="default">{t('allDepartments')}</Badge>;
  }

  return (
    <div className="flex max-w-xl flex-wrap gap-2">
      {assignments.map((assignment) => (
        <Badge key={assignment.id} variant="secondary">
          {assignment.department?.nameEn ?? departmentsById.get(assignment.departmentId)?.nameEn ?? assignment.departmentId}
        </Badge>
      ))}
    </div>
  );
}

function buildDepartmentOptions(departments: Department[]) {
  const childrenByParent = new Map<string | null, Department[]>();
  for (const department of departments) {
    const key = department.parentDepartmentId ?? null;
    const children = childrenByParent.get(key) ?? [];
    children.push(department);
    childrenByParent.set(key, children);
  }

  for (const children of childrenByParent.values()) {
    children.sort((left, right) => left.nameEn.localeCompare(right.nameEn));
  }

  const options: Array<{ department: Department; depth: number }> = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const department of childrenByParent.get(parentId) ?? []) {
      options.push({ department, depth });
      visit(department.id, depth + 1);
    }
  };

  visit(null, 0);
  return options;
}
