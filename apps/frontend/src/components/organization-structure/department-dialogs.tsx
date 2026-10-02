'use client';

import { FormEvent, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Check, Loader2, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { DepartmentCombobox } from '@/components/employees/department-combobox';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  useCreateDepartment,
  useDepartmentHeadCandidates,
  useSetDepartmentHead,
  useUpdateDepartment,
} from '@/data/hooks/core.hooks';
import type { Department } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

import { collectSelfAndDescendantIds } from './department-tree';

function ParentDepartmentPicker({
  id,
  departments,
  isContract,
  departmentId,
  value,
  onChange,
}: {
  id?: string;
  departments: Department[];
  isContract: boolean;
  departmentId: string | null;
  value: string | null;
  onChange: (parentDepartmentId: string | null) => void;
}) {
  const t = useTranslations('core');
  const options = useMemo(() => {
    if (!departmentId) return departments;
    const blocked = collectSelfAndDescendantIds(departments, departmentId);
    return departments.filter((department) => !blocked.has(department.id));
  }, [departmentId, departments]);

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1">
        <DepartmentCombobox
          id={id}
          departments={options}
          isContract={isContract}
          value={value ?? ''}
          onChange={(parentDepartmentId) => onChange(parentDepartmentId || null)}
        />
      </div>
      <Button type="button" variant="outline" onClick={() => onChange(null)} disabled={!value}>
        {t('topLevel')}
      </Button>
    </div>
  );
}

type DepartmentFormState = {
  nameEn: string;
  nameAm: string;
  code: string;
  parentDepartmentId: string | null;
  isActive: boolean;
  isContract: boolean;
};

export function DepartmentFormDialog({
  open,
  onOpenChange,
  departments,
  isContract,
  department,
  defaultParentDepartmentId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  isContract: boolean;
  /** The department being edited, or null to create a new one. */
  department: Department | null;
  defaultParentDepartmentId: string | null;
  onSaved?: (department: Department) => void;
}) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();
  const [form, setForm] = useState<DepartmentFormState>({
    nameEn: '',
    nameAm: '',
    code: '',
    parentDepartmentId: null,
    isActive: true,
    isContract: false,
  });
  // Changing the type would split a branch across the permanent and contract trees, so it is locked while sub-departments exist.
  const hasSubDepartments = Boolean(
    department && departments.some((candidate) => candidate.parentDepartmentId === department.id),
  );

  useEffect(() => {
    if (!open) return;
    setForm({
      nameEn: department?.nameEn ?? '',
      nameAm: department?.nameAm ?? '',
      code: department?.code ?? '',
      parentDepartmentId: department ? department.parentDepartmentId : defaultParentDepartmentId,
      isActive: department?.isActive ?? true,
      isContract: department?.isContract ?? isContract,
    });
  }, [defaultParentDepartmentId, department, isContract, open]);

  const isSaving = createDepartment.isPending || updateDepartment.isPending;

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = {
        isContract: form.isContract,
        nameEn: form.nameEn.trim(),
        nameAm: form.nameAm.trim() || null,
        code: form.code.trim() || null,
        parentDepartmentId: form.parentDepartmentId,
        isActive: form.isActive,
      };

      const response = department
        ? await updateDepartment.mutateAsync({ departmentId: department.id, ...payload })
        : await createDepartment.mutateAsync(payload);

      onOpenChange(false);
      onSaved?.(response.department);
      notifications.show({
        title: common('success'),
        message: department ? t('departmentUpdated') : t('departmentCreated'),
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department ? t('editDepartment') : t('addDepartment')}</DialogTitle>
          <DialogDescription>{t('departmentFormDescription')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={save}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="department-name-en">{t('nameEn')}</Label>
              <Input
                id="department-name-en"
                value={form.nameEn}
                onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department-name-am">{t('nameAm')}</Label>
              <Input
                id="department-name-am"
                value={form.nameAm}
                onChange={(event) => setForm((current) => ({ ...current, nameAm: event.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="department-code">{t('code')}</Label>
            <Input
              id="department-code"
              value={form.code}
              onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="department-parent">{t('parentDepartment')}</Label>
            <ParentDepartmentPicker
              id="department-parent"
              departments={departments}
              isContract={form.isContract}
              departmentId={department?.id ?? null}
              value={form.parentDepartmentId}
              onChange={(parentDepartmentId) => setForm((current) => ({ ...current, parentDepartmentId }))}
            />
            {!form.parentDepartmentId ? (
              <p className="text-xs text-muted-foreground">{t('topLevelHint')}</p>
            ) : null}
          </div>
          <div className="space-y-1 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="department-is-contract">{t('contractDepartment')}</Label>
              <Switch
                id="department-is-contract"
                checked={form.isContract}
                disabled={hasSubDepartments}
                onCheckedChange={(checked) =>
                  // A parent always has the same type, so switching type detaches the department from its parent.
                  setForm((current) => ({ ...current, isContract: checked, parentDepartmentId: null }))}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {hasSubDepartments
                ? t('departmentTypeLockedHint')
                : form.isContract
                  ? t('contractDepartmentHint')
                  : t('permanentDepartmentHint')}
            </p>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <Label htmlFor="department-is-active">{t('active')}</Label>
            <Switch
              id="department-is-active"
              checked={form.isActive}
              onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {common('cancel')}
            </Button>
            <Button type="submit" disabled={isSaving || !form.nameEn.trim()}>
              {isSaving ? t('saving') : common('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveDepartmentDialog({
  department,
  departments,
  onOpenChange,
  onMove,
  isMoving,
}: {
  department: Department | null;
  departments: Department[];
  onOpenChange: (open: boolean) => void;
  onMove: (department: Department, parentDepartmentId: string | null) => Promise<boolean>;
  isMoving: boolean;
}) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const [parentDepartmentId, setParentDepartmentId] = useState<string | null>(null);

  useEffect(() => {
    setParentDepartmentId(department?.parentDepartmentId ?? null);
  }, [department]);

  return (
    <Dialog open={Boolean(department)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('moveDepartmentTitle', { name: department?.nameEn ?? '' })}</DialogTitle>
          <DialogDescription>{t('moveDepartmentDescription')}</DialogDescription>
        </DialogHeader>
        {department ? (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (await onMove(department, parentDepartmentId)) onOpenChange(false);
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="move-department-parent">{t('parentDepartment')}</Label>
              <ParentDepartmentPicker
                id="move-department-parent"
                departments={departments}
                isContract={department.isContract}
                departmentId={department.id}
                value={parentDepartmentId}
                onChange={setParentDepartmentId}
              />
              {!parentDepartmentId ? (
                <p className="text-xs text-muted-foreground">{t('topLevelHint')}</p>
              ) : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {common('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isMoving || parentDepartmentId === (department.parentDepartmentId ?? null)}
              >
                {isMoving ? t('saving') : t('move')}
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function DepartmentHeadDialog({
  department,
  onOpenChange,
}: {
  department: Department | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const setDepartmentHead = useSetDepartmentHead();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search.trim());
  const candidatesQuery = useDepartmentHeadCandidates(deferredSearch, Boolean(department));
  const candidates = candidatesQuery.data?.employees ?? [];
  const currentHead = department?.headEmployee ?? null;

  useEffect(() => {
    setSearch('');
  }, [department]);

  const save = async (headEmployeeId: string | null) => {
    if (!department) return;
    try {
      await setDepartmentHead.mutateAsync({ departmentId: department.id, headEmployeeId });
      notifications.show({ title: common('success'), message: t('departmentHeadUpdated'), color: 'green' });
      onOpenChange(false);
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  return (
    <Dialog open={Boolean(department)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('setDepartmentHeadTitle', { name: department?.nameEn ?? '' })}</DialogTitle>
          <DialogDescription>{t('setDepartmentHeadDescription')}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserRound className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">{t('departmentHead')}</span>
            <span className="block truncate font-medium">
              {currentHead ? `${currentHead.fullName} · ${currentHead.employeeCode}` : t('noHead')}
            </span>
          </span>
          {currentHead ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={setDepartmentHead.isPending}
              onClick={() => save(null)}
            >
              {t('removeHead')}
            </Button>
          ) : null}
        </div>
        <Command shouldFilter={false} className="rounded-md border border-border">
          <CommandInput placeholder={t('searchEmployees')} value={search} onValueChange={setSearch} />
          <CommandList className="max-h-72">
            {candidatesQuery.isFetching && candidates.length === 0 ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <CommandEmpty>{t('noEmployeesFound')}</CommandEmpty>
            )}
            {candidates.length > 0 ? (
              <CommandGroup>
                {candidates.map((employee) => (
                  <CommandItem
                    key={employee.id}
                    value={employee.id}
                    disabled={setDepartmentHead.isPending}
                    onSelect={() => save(employee.id)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{employee.fullName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[employee.employeeCode, employee.departmentName].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    {employee.id === currentHead?.id ? <Check className="size-4" /> : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
