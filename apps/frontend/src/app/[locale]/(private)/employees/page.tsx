'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, Eye, FileSpreadsheet, Pencil, Plus, UsersRound } from 'lucide-react';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useRouter } from '@/i18n';
import { notifications } from '@/lib/notifications';
import {
  useBiometricExemptions,
  useCreateEmployee,
  useDepartments,
  useEmployees,
  usePositions,
  useUpdateEmployee,
} from '@/data/hooks/core.hooks';
import { useCreateUser } from '@/data/hooks/users.hooks';
import { useRoles } from '@/data/hooks/rbac.hooks';
import type { Department, Employee, EmploymentStatus, EmploymentType } from '@/data/types/core.types';

const employmentStatuses: EmploymentStatus[] = ['ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED'];
const employmentTypes: EmploymentType[] = ['PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY'];
const manualEmploymentTypes = employmentTypes.filter((type) => type !== 'PERMANENT');
type DepartmentNode = Department & { children: DepartmentNode[] };

const initialForm = {
  employeeCode: '',
  payrollId: '',
  biometricId: '',
  firstNameEn: '',
  middleNameEn: '',
  lastNameEn: '',
  firstNameAm: '',
  middleNameAm: '',
  lastNameAm: '',
  gender: '',
  phoneNumber: '',
  email: '',
  departmentId: '',
  positionId: '',
  employmentStatus: 'ACTIVE' as EmploymentStatus,
  employmentType: 'CONTRACT' as EmploymentType,
  hireDate: '',
  terminationDate: '',
  isActive: true,
  createLoginUser: false,
  roleIds: [] as string[],
};

function buildDepartmentTree(departments: Department[]) {
  const nodeMap = new Map<string, DepartmentNode>();
  departments.forEach((department) => {
    nodeMap.set(department.id, { ...department, children: [] });
  });

  const roots: DepartmentNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parentDepartmentId && nodeMap.has(node.parentDepartmentId)) {
      nodeMap.get(node.parentDepartmentId)?.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortByCreatedAt = (a: DepartmentNode, b: DepartmentNode) => {
    const createdAtDiff = Date.parse(a.createdAt) - Date.parse(b.createdAt);
    return createdAtDiff || a.nameEn.localeCompare(b.nameEn);
  };

  const sortNodes = (nodes: DepartmentNode[]) => {
    nodes.sort(sortByCreatedAt);
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);

  return roots;
}

function DepartmentTreeItem({
  node,
  selectedDepartmentId,
  counts,
  onSelect,
  depth = 0,
}: {
  node: DepartmentNode;
  selectedDepartmentId: string;
  counts: Record<string, number>;
  onSelect: (departmentId: string) => void;
  depth?: number;
}) {
  const isSelected = selectedDepartmentId === node.id;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className="flex w-full items-center justify-between gap-3 rounded-md border border-transparent px-3 py-2 text-left text-sm transition-colors hover:bg-accent data-[active=true]:border-primary data-[active=true]:bg-primary/5"
        data-active={isSelected}
        style={{ paddingLeft: `${12 + depth * 18}px` }}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block truncate font-medium">{node.nameEn}</span>
            <span className="block truncate text-xs text-muted-foreground">{node.code || '-'}</span>
          </span>
        </span>
        <Badge variant={isSelected ? 'default' : 'secondary'}>{counts[node.id] ?? 0}</Badge>
      </button>
      {node.children.map((child) => (
        <DepartmentTreeItem
          key={child.id}
          node={child}
          selectedDepartmentId={selectedDepartmentId}
          counts={counts}
          onSelect={onSelect}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

export default function EmployeesPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const router = useRouter();
  const { data: employeesResponse, isLoading } = useEmployees();
  const { data: departmentsResponse } = useDepartments();
  const { data: positionsResponse } = usePositions();
  const { data: rolesResponse } = useRoles();
  const { data: biometricExemptionsResponse } = useBiometricExemptions();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const createUser = useCreateUser();

  const employees = employeesResponse?.employees ?? [];
  const departments = departmentsResponse?.departments ?? [];
  const positions = positionsResponse?.positions ?? [];
  const roles = rolesResponse?.roles ?? [];
  const biometricExemptions = biometricExemptionsResponse?.biometricExemptions ?? [];
  const [search, setSearch] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(initialForm);
  const departmentTree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const defaultDepartmentId = departmentTree[0]?.id ?? '';

  const employeeCountsByDepartment = useMemo(() => {
    const directCounts = employees.reduce<Record<string, number>>((counts, employee) => {
      counts[employee.departmentId] = (counts[employee.departmentId] ?? 0) + 1;
      return counts;
    }, {});
    const counts = { ...directCounts };

    const addDescendantCounts = (node: DepartmentNode): number => {
      const total = node.children.reduce(
        (sum, child) => sum + addDescendantCounts(child),
        directCounts[node.id] ?? 0
      );
      counts[node.id] = total;
      return total;
    };

    departmentTree.forEach(addDescendantCounts);
    return counts;
  }, [departmentTree, employees]);

  const selectedDepartment = departments.find((department) => department.id === selectedDepartmentId);
  const isRootDepartmentSelected = Boolean(selectedDepartment && !selectedDepartment.parentDepartmentId);
  const selectedDepartmentEmployeeCount = selectedDepartmentId
    ? isRootDepartmentSelected
      ? employees.length
      : employeeCountsByDepartment[selectedDepartmentId] ?? 0
    : 0;

  const filteredEmployees = useMemo(() => {
    const query = search.trim().toLowerCase();
    const departmentEmployees = selectedDepartmentId && !isRootDepartmentSelected
      ? employees.filter((employee) => employee.departmentId === selectedDepartmentId)
      : employees;

    if (!query) return departmentEmployees;

    return departmentEmployees.filter((employee) => {
      const haystack = [
        employee.employeeCode,
        employee.firstNameEn,
        employee.middleNameEn,
        employee.lastNameEn,
        employee.email,
        employee.phoneNumber,
        employee.department?.nameEn,
        employee.position?.nameEn,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [employees, isRootDepartmentSelected, search, selectedDepartmentId]);
  const exemptEmployeeIds = useMemo(
    () => new Set(biometricExemptions.filter((exemption) => exemption.isActive && exemption.employeeId).map((exemption) => exemption.employeeId as string)),
    [biometricExemptions],
  );
  const exemptPositionIds = useMemo(
    () => new Set(biometricExemptions.filter((exemption) => exemption.isActive && exemption.positionId).map((exemption) => exemption.positionId as string)),
    [biometricExemptions],
  );
  const isBiometricExempt = (employee: Employee) => Boolean(
    exemptEmployeeIds.has(employee.id) || (employee.positionId ? exemptPositionIds.has(employee.positionId) : false),
  );

  useEffect(() => {
    if (departments.length === 0) {
      if (selectedDepartmentId) {
        setSelectedDepartmentId('');
      }
      return;
    }

    const selectedDepartmentExists = departments.some((department) => department.id === selectedDepartmentId);
    if (!selectedDepartmentExists) {
      setSelectedDepartmentId(defaultDepartmentId);
    }
  }, [defaultDepartmentId, departments, selectedDepartmentId]);

  const openCreateEmployee = () => {
    if (!selectedDepartmentId) {
      notifications.show({
        title: common('error'),
        message: t('selectDepartmentFirst'),
        color: 'red',
      });
      return;
    }

    setEditingEmployee(null);
    setForm({ ...initialForm, departmentId: selectedDepartmentId });
    setDialogOpen(true);
  };

  const openEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setForm({
      employeeCode: employee.employeeCode,
      payrollId: employee.payrollId ?? '',
      biometricId: employee.biometricId ?? '',
      firstNameEn: employee.firstNameEn,
      middleNameEn: employee.middleNameEn ?? '',
      lastNameEn: employee.lastNameEn,
      firstNameAm: employee.firstNameAm ?? '',
      middleNameAm: employee.middleNameAm ?? '',
      lastNameAm: employee.lastNameAm ?? '',
      gender: employee.gender ?? '',
      phoneNumber: employee.phoneNumber ?? '',
      email: employee.email ?? '',
      departmentId: employee.departmentId,
      positionId: employee.positionId ?? '',
      employmentStatus: employee.employmentStatus,
      employmentType: employee.employmentType,
      hireDate: employee.hireDate ?? '',
      terminationDate: employee.terminationDate ?? '',
      isActive: employee.isActive,
      createLoginUser: false,
      roleIds: [],
    });
    setSelectedDepartmentId(employee.departmentId);
    setDialogOpen(true);
  };

  const toggleRole = (roleId: string) => {
    setForm((current) => ({
      ...current,
      roleIds: current.roleIds.includes(roleId)
        ? current.roleIds.filter((id) => id !== roleId)
        : [...current.roleIds, roleId],
    }));
  };

  const saveEmployee = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const isExistingPermanentEmployee = Boolean(editingEmployee && editingEmployee.employmentType === 'PERMANENT');
    if (!isExistingPermanentEmployee && form.employmentType === 'PERMANENT') {
      notifications.show({
        title: common('error'),
        message: t('permanentEmployeeManualCreateBlocked'),
        color: 'red',
      });
      return;
    }

    try {
      let userId = editingEmployee?.userId ?? null;

      if (!editingEmployee && form.createLoginUser) {
        const userResponse = await createUser.mutateAsync({
          name: [form.firstNameEn, form.middleNameEn, form.lastNameEn].filter(Boolean).join(' '),
          email: form.email.trim(),
          emailVerified: true,
          roleIds: form.roleIds,
        });
        userId = userResponse.user.id;
      }

      const payload = {
        userId,
        employeeCode: form.employeeCode.trim(),
        payrollId: form.payrollId.trim() || null,
        biometricId: form.biometricId.trim() || null,
        firstNameEn: form.firstNameEn.trim(),
        middleNameEn: form.middleNameEn.trim() || null,
        lastNameEn: form.lastNameEn.trim(),
        firstNameAm: form.firstNameAm.trim() || null,
        middleNameAm: form.middleNameAm.trim() || null,
        lastNameAm: form.lastNameAm.trim() || null,
        gender: form.gender.trim() || null,
        phoneNumber: form.phoneNumber.trim() || null,
        email: form.email.trim() || null,
        departmentId: form.departmentId,
        positionId: form.positionId || null,
        employmentStatus: form.employmentStatus,
        employmentType: form.employmentType,
        hireDate: form.hireDate || null,
        terminationDate: form.terminationDate || null,
        isActive: form.isActive,
      };

      if (editingEmployee) {
        await updateEmployee.mutateAsync({ employeeId: editingEmployee.id, ...payload });
      } else {
        try {
          await createEmployee.mutateAsync(payload);
        } catch (employeeError) {
          if (userId) {
            throw new Error(t('employeeCreateAfterUserFailed'));
          }
          throw employeeError;
        }
      }

      setDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: editingEmployee ? t('employeeUpdated') : t('employeeCreated'),
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
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={openCreateEmployee}>
            <Plus className="size-4" />
            {t('addEmployee')}
          </Button>
          <Button variant="outline" onClick={() => router.push('/permanent-employees')}>
            <FileSpreadsheet className="size-4" />
            {t('pullPermanentEmployees')}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
            <div>
              <p className="text-[11px] leading-none text-muted-foreground">{t('totalEmployees')}</p>
              <p className="text-base font-semibold">{employees.length}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
            <div>
              <p className="max-w-36 truncate text-[11px] leading-none text-muted-foreground">{selectedDepartment?.nameEn ?? t('department')}</p>
              <p className="text-base font-semibold">{selectedDepartmentEmployeeCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="rounded-lg">
          <CardHeader className="pb-3">
            <CardTitle>{t('departments')}</CardTitle>
            <CardDescription>{t('departmentEmployeeCounts')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {departments.length === 0 ? (
              <EmptyState
                icon={Building2}
                title={t('noDepartments')}
                description={t('noDepartmentsDescription')}
              />
            ) : (
              departmentTree.map((node) => (
                <DepartmentTreeItem
                  key={node.id}
                  node={node}
                  selectedDepartmentId={selectedDepartmentId}
                  counts={employeeCountsByDepartment}
                  onSelect={setSelectedDepartmentId}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="gap-4 lg:flex lg:flex-row lg:items-center lg:justify-between">
            <div>
              <CardTitle>{selectedDepartment?.nameEn ?? t('employeeDirectory')}</CardTitle>
              <CardDescription>{t('employeeDirectoryDescription')}</CardDescription>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('searchEmployees')}
              className="w-full lg:w-80"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('loadingEmployees')}</p>
            ) : filteredEmployees.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title={t('noEmployees')}
                description={t('noEmployeesDescription')}
                className="min-h-72"
              />
            ) : (
              <div className="overflow-hidden rounded-md border border-border">
                <div className="grid grid-cols-[1fr_1fr_120px_96px] gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground max-lg:hidden">
                  <span>{t('employee')}</span>
                  <span>{t('email')}</span>
                  <span>{t('status')}</span>
                  <span className="text-right">{t('actions')}</span>
                </div>
                {filteredEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="grid gap-3 border-b border-border px-4 py-4 last:border-0 lg:grid-cols-[1fr_1fr_120px_96px]"
                  >
                    <div>
                      <p className="font-medium">{employee.firstNameEn} {employee.middleNameEn} {employee.lastNameEn}</p>
                      <p className="text-xs text-muted-foreground">
                        {employee.employeeCode} · {employee.position?.nameEn ?? t('noPosition')}
                      </p>
                      {isBiometricExempt(employee) ? (
                        <Badge variant="outline" className="mt-1 border-emerald-500 text-emerald-700 dark:text-emerald-400">
                          {t('biometricExempt')}
                        </Badge>
                      ) : null}
                    </div>
                    <div className="text-sm">
                      <p>{employee.email ?? '-'}</p>
                      <p className="text-xs text-muted-foreground">{employee.phoneNumber ?? '-'}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={employee.employmentStatus === 'ACTIVE' ? 'default' : 'secondary'}>
                        {employee.employmentStatus}
                      </Badge>
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => router.push(`/employees/${employee.id}`)}>
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditEmployee(employee)}>
                        <Pencil className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? t('editEmployee') : t('addEmployee')}</DialogTitle>
            <DialogDescription>{t('employeeFormDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={saveEmployee}>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('employeeCode')}</Label>
                <Input value={form.employeeCode} onChange={(event) => setForm((current) => ({ ...current, employeeCode: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>{t('payrollId')}</Label>
                <Input value={form.payrollId} onChange={(event) => setForm((current) => ({ ...current, payrollId: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('biometricId')}</Label>
                <Input value={form.biometricId} onChange={(event) => setForm((current) => ({ ...current, biometricId: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('firstNameEn')}</Label>
                <Input value={form.firstNameEn} onChange={(event) => setForm((current) => ({ ...current, firstNameEn: event.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>{t('middleNameEn')}</Label>
                <Input value={form.middleNameEn} onChange={(event) => setForm((current) => ({ ...current, middleNameEn: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('lastNameEn')}</Label>
                <Input value={form.lastNameEn} onChange={(event) => setForm((current) => ({ ...current, lastNameEn: event.target.value }))} required />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('firstNameAm')}</Label>
                <Input value={form.firstNameAm} onChange={(event) => setForm((current) => ({ ...current, firstNameAm: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('middleNameAm')}</Label>
                <Input value={form.middleNameAm} onChange={(event) => setForm((current) => ({ ...current, middleNameAm: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('lastNameAm')}</Label>
                <Input value={form.lastNameAm} onChange={(event) => setForm((current) => ({ ...current, lastNameAm: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('department')}</Label>
                <div className="flex min-h-10 items-center rounded-md border border-border bg-muted/30 px-3 text-sm">
                  {departments.find((department) => department.id === form.departmentId)?.nameEn ?? '-'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('position')}</Label>
                <Select value={form.positionId || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, positionId: value === 'none' ? '' : value }))}>
                  <SelectTrigger><SelectValue placeholder={t('selectPosition')} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noPosition')}</SelectItem>
                    {positions.map((position) => (
                      <SelectItem key={position.id} value={position.id}>{position.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>{t('employmentStatus')}</Label>
                <Select value={form.employmentStatus} onValueChange={(value) => setForm((current) => ({ ...current, employmentStatus: value as EmploymentStatus }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{employmentStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('employmentType')}</Label>
                <Select
                  value={form.employmentType}
                  onValueChange={(value) => setForm((current) => ({ ...current, employmentType: value as EmploymentType }))}
                  disabled={Boolean(editingEmployee && editingEmployee.employmentType === 'PERMANENT')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(editingEmployee?.employmentType === 'PERMANENT' ? employmentTypes : manualEmploymentTypes).map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!editingEmployee ? (
                  <p className="text-xs leading-5 text-muted-foreground">
                    {t('permanentEmployeeExternalOnly')}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label>{t('hireDate')}</Label>
                <Input type="date" value={form.hireDate} onChange={(event) => setForm((current) => ({ ...current, hireDate: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('terminationDate')}</Label>
                <Input type="date" value={form.terminationDate} onChange={(event) => setForm((current) => ({ ...current, terminationDate: event.target.value }))} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>{t('gender')}</Label>
                <Input value={form.gender} onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('phoneNumber')}</Label>
                <Input value={form.phoneNumber} onChange={(event) => setForm((current) => ({ ...current, phoneNumber: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t('email')}</Label>
                <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required={form.createLoginUser} />
              </div>
            </div>

            {!editingEmployee ? (
              <div className="space-y-4 rounded-md border border-border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>{t('createLoginUser')}</Label>
                    <p className="mt-1 text-xs text-muted-foreground">{t('createLoginUserDescription')}</p>
                  </div>
                  <Switch checked={form.createLoginUser} onCheckedChange={(checked) => setForm((current) => ({ ...current, createLoginUser: checked }))} />
                </div>
                {form.createLoginUser ? (
                  <div className="space-y-2">
                    <Label>{t('roles')}</Label>
                    <div className="flex flex-wrap gap-2">
                      {roles.map((role) => (
                        <Button
                          key={role.id}
                          type="button"
                          variant={form.roleIds.includes(role.id) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => toggleRole(role.id)}
                        >
                          {role.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>{t('active')}</Label>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button
                type="submit"
                disabled={
                  createEmployee.isPending ||
                  updateEmployee.isPending ||
                  createUser.isPending ||
                  !form.employeeCode.trim() ||
                  !form.firstNameEn.trim() ||
                  !form.lastNameEn.trim() ||
                  !form.departmentId ||
                  (!(editingEmployee && editingEmployee.employmentType === 'PERMANENT') && form.employmentType === 'PERMANENT') ||
                  (form.createLoginUser && (!form.email.trim() || form.roleIds.length === 0))
                }
              >
                {createEmployee.isPending || updateEmployee.isPending || createUser.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
