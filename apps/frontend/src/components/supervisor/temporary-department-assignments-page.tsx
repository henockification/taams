'use client';

import { type FormEvent, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarClock, Pencil, Plus, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCreateTemporaryDepartmentAssignment,
  useDeactivateTemporaryDepartmentAssignment,
  useDepartments,
  useEmployees,
  useTemporaryDepartmentAssignments,
  useUpdateTemporaryDepartmentAssignment,
} from '@/data/hooks/core.hooks';
import type { Employee, TemporaryDepartmentAssignment } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

type AssignmentFilter = 'active' | 'history' | 'all';

type FormState = {
  employeeId: string;
  targetDepartmentId: string;
  effectiveFrom: string;
  effectiveTo: string;
  reason: string;
};

const emptyForm = (): FormState => ({
  employeeId: '',
  targetDepartmentId: '',
  effectiveFrom: today(),
  effectiveTo: today(),
  reason: '',
});

export function TemporaryDepartmentAssignmentsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const assignmentsQuery = useTemporaryDepartmentAssignments();
  const employeesQuery = useEmployees();
  const departmentsQuery = useDepartments();
  const createAssignment = useCreateTemporaryDepartmentAssignment();
  const updateAssignment = useUpdateTemporaryDepartmentAssignment();
  const deactivateAssignment = useDeactivateTemporaryDepartmentAssignment();
  const [filter, setFilter] = useState<AssignmentFilter>('active');
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<TemporaryDepartmentAssignment | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm());

  const employees = employeesQuery.data?.employees ?? [];
  const departments = departmentsQuery.data?.departments ?? [];
  const assignments = assignmentsQuery.data?.temporaryDepartmentAssignments ?? [];
  const filteredAssignments = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return assignments.filter((assignment) => {
      const matchesStatus = filter === 'all'
        || (filter === 'active' && isCurrentOrFutureAssignment(assignment))
        || (filter === 'history' && !isCurrentOrFutureAssignment(assignment));
      const haystack = [
        employeeName(assignment.employee),
        assignment.employee?.employeeCode,
        assignment.sourceDepartment?.nameEn,
        assignment.targetDepartment?.nameEn,
        assignment.reason,
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!normalizedSearch || haystack.includes(normalizedSearch));
    });
  }, [assignments, filter, search]);

  function openCreateDialog() {
    setEditingAssignment(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEditDialog(assignment: TemporaryDepartmentAssignment) {
    setEditingAssignment(assignment);
    setForm({
      employeeId: assignment.employeeId,
      targetDepartmentId: assignment.targetDepartmentId,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo,
      reason: assignment.reason,
    });
    setDialogOpen(true);
  }

  async function submitAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.employeeId || !form.targetDepartmentId || !form.effectiveFrom || !form.effectiveTo || !form.reason.trim()) {
      notifications.show({ title: common('error'), message: t('temporaryAssignmentRequiredFields'), color: 'red' });
      return;
    }

    try {
      if (editingAssignment) {
        await updateAssignment.mutateAsync({
          temporaryDepartmentAssignmentId: editingAssignment.id,
          targetDepartmentId: form.targetDepartmentId,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo,
          reason: form.reason.trim(),
        });
      } else {
        await createAssignment.mutateAsync({
          employeeId: form.employeeId,
          targetDepartmentId: form.targetDepartmentId,
          effectiveFrom: form.effectiveFrom,
          effectiveTo: form.effectiveTo,
          reason: form.reason.trim(),
        });
      }
      setDialogOpen(false);
      setEditingAssignment(null);
      setForm(emptyForm());
      notifications.show({ title: common('success'), message: t('temporaryAssignmentSaved'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  async function deactivate(id: string) {
    try {
      await deactivateAssignment.mutateAsync(id);
      notifications.show({ title: common('success'), message: t('temporaryAssignmentDeactivated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{t('temporaryAssignments')}</h1>
          <p className="text-sm text-muted-foreground">{t('temporaryAssignmentsDescription')}</p>
        </div>
        <Button type="button" onClick={openCreateDialog}>
          <Plus className="size-4" />
          {t('addTemporaryAssignment')}
        </Button>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{t('temporaryAssignments')}</CardTitle>
          <CardDescription>{t('temporaryAssignmentsTableDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center">
            <Input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchTemporaryAssignments')}
              className="md:max-w-xs"
            />
            <Select value={filter} onValueChange={(value) => setFilter(value as AssignmentFilter)}>
              <SelectTrigger className="md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t('active')}</SelectItem>
                <SelectItem value="history">{t('history')}</SelectItem>
                <SelectItem value="all">{t('allStatuses')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {assignmentsQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : filteredAssignments.length === 0 ? (
            <EmptyState
              icon={ArrowRightLeft}
              title={t('noTemporaryAssignments')}
              description={t('noTemporaryAssignmentsDescription')}
            />
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table className="min-w-[72rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('employee')}</TableHead>
                    <TableHead>{t('homeDepartment')}</TableHead>
                    <TableHead>{t('temporaryDepartment')}</TableHead>
                    <TableHead>{t('period')}</TableHead>
                    <TableHead>{t('reason')}</TableHead>
                    <TableHead>{t('status')}</TableHead>
                    <TableHead className="text-right">{t('actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAssignments.map((assignment) => {
                    const currentOrFuture = isCurrentOrFutureAssignment(assignment);
                    return (
                      <TableRow key={assignment.id}>
                        <TableCell className="min-w-56">
                          <p className="truncate font-medium">{employeeName(assignment.employee) || t('unknown')}</p>
                          <p className="truncate text-xs text-muted-foreground">{assignment.employee?.employeeCode ?? '-'}</p>
                        </TableCell>
                        <TableCell>{assignment.sourceDepartment?.nameEn ?? '-'}</TableCell>
                        <TableCell>{assignment.targetDepartment?.nameEn ?? '-'}</TableCell>
                        <TableCell className="whitespace-nowrap">{assignment.effectiveFrom} - {assignment.effectiveTo}</TableCell>
                        <TableCell className="max-w-xs truncate">{assignment.reason}</TableCell>
                        <TableCell>
                          <Badge variant={assignment.isActive && currentOrFuture ? 'default' : 'secondary'}>
                            {assignment.isActive && currentOrFuture ? t('active') : t('inactive')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {assignment.isActive ? (
                              <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(assignment)}>
                                <Pencil className="size-4" />
                                {common('edit')}
                              </Button>
                            ) : null}
                            {assignment.isActive && currentOrFuture ? (
                              <Button type="button" size="sm" variant="destructive" onClick={() => deactivate(assignment.id)} disabled={deactivateAssignment.isPending}>
                                <XCircle className="size-4" />
                                {t('deactivate')}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) {
          setEditingAssignment(null);
          setForm(emptyForm());
        }
      }}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingAssignment ? t('editTemporaryAssignment') : t('addTemporaryAssignment')}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitAssignment}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('employee')}</Label>
                <Select
                  value={form.employeeId || undefined}
                  onValueChange={(value) => setForm((current) => ({ ...current, employeeId: value }))}
                  disabled={Boolean(editingAssignment)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectEmployee')} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.filter((employee) => employee.isActive).map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employeeName(employee)} - {employee.employeeCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('temporaryDepartment')}</Label>
                <Select
                  value={form.targetDepartmentId || undefined}
                  onValueChange={(value) => setForm((current) => ({ ...current, targetDepartmentId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('selectDepartment')} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.filter((department) => department.isActive).map((department) => (
                      <SelectItem key={department.id} value={department.id}>{department.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('startDate')}</Label>
                <Input
                  type="date"
                  value={form.effectiveFrom}
                  onChange={(event) => setForm((current) => ({ ...current, effectiveFrom: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('endDate')}</Label>
                <Input
                  type="date"
                  value={form.effectiveTo}
                  onChange={(event) => setForm((current) => ({ ...current, effectiveTo: event.target.value }))}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('reason')}</Label>
                <Textarea
                  value={form.reason}
                  onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={createAssignment.isPending || updateAssignment.isPending}>
                <CalendarClock className="size-4" />
                {createAssignment.isPending || updateAssignment.isPending ? t('saving') : t('saveTemporaryAssignment')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function employeeName(employee?: Employee | null) {
  if (!employee) return '';
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' ');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function isCurrentOrFutureAssignment(assignment: TemporaryDepartmentAssignment) {
  return assignment.isActive && assignment.effectiveTo >= today();
}
