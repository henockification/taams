'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronRight, GitBranch, ListTree, Pencil, Plus } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { EmptyState } from '@/components/ui/empty-state';
import { notifications } from '@/lib/notifications';
import {
  useCreateDepartment,
  useDepartments,
  useUpdateDepartment,
} from '@/data/hooks/core.hooks';
import type { Department } from '@/data/types/core.types';

type DepartmentNode = Department & { children: DepartmentNode[] };
type OrganizationView = 'tree' | 'chart';

const departmentInitialForm = {
  nameEn: '',
  nameAm: '',
  code: '',
  parentDepartmentId: null as string | null,
  isActive: true,
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

function findDepartmentNode(nodes: DepartmentNode[], departmentId: string): DepartmentNode | undefined {
  for (const node of nodes) {
    if (node.id === departmentId) return node;
    const found = findDepartmentNode(node.children, departmentId);
    if (found) return found;
  }

  return undefined;
}

function DepartmentTreeItem({
  node,
  selectedDepartmentId,
  onSelect,
  onCreateChild,
  onEdit,
  addChildLabel,
  editLabel,
  depth = 0,
}: {
  node: DepartmentNode;
  selectedDepartmentId: string;
  onSelect: (department: Department) => void;
  onCreateChild: (departmentId: string) => void;
  onEdit: (department: Department) => void;
  addChildLabel: string;
  editLabel: string;
  depth?: number;
}) {
  const isSelected = selectedDepartmentId === node.id;

  return (
    <div className="space-y-1">
      <div
        className="group flex items-center gap-1 rounded-md border border-transparent pr-1 text-sm transition-colors hover:bg-accent data-[active=true]:border-primary data-[active=true]:bg-primary/5"
        data-active={isSelected}
      >
        <button
          type="button"
          onClick={() => onSelect(node)}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-3 py-2 text-left"
          style={{ paddingLeft: `${12 + depth * 18}px` }}
        >
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate font-medium">{node.nameEn}</span>
          {!node.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 opacity-70 transition-opacity hover:opacity-100"
          onClick={() => onCreateChild(node.id)}
          title={addChildLabel}
        >
          <Plus className="size-4" />
          <span className="sr-only">{addChildLabel}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 opacity-70 transition-opacity hover:opacity-100"
          onClick={() => onEdit(node)}
          title={editLabel}
        >
          <Pencil className="size-4" />
          <span className="sr-only">{editLabel}</span>
        </Button>
      </div>
      {node.children.map((child) => (
        <DepartmentTreeItem
          key={child.id}
          node={child}
          selectedDepartmentId={selectedDepartmentId}
          onSelect={onSelect}
          onCreateChild={onCreateChild}
          onEdit={onEdit}
          addChildLabel={addChildLabel}
          editLabel={editLabel}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

function OrganizationChartNode({
  node,
  selectedDepartmentId,
  onSelect,
}: {
  node: DepartmentNode;
  selectedDepartmentId: string;
  onSelect: (department: Department) => void;
}) {
  const isSelected = selectedDepartmentId === node.id;
  const hasChildren = node.children.length > 0;

  return (
    <li className="relative flex flex-col items-center px-4 pt-6 before:absolute before:left-0 before:top-6 before:h-px before:w-1/2 before:bg-border after:absolute after:right-0 after:top-6 after:h-px after:w-1/2 after:bg-border first:before:hidden last:after:hidden only:before:hidden only:after:hidden">
      <button
        type="button"
        onClick={() => onSelect(node)}
        className="relative z-10 flex min-h-24 w-56 flex-col justify-center rounded-md border bg-card px-4 py-3 text-center shadow-sm transition-colors hover:bg-accent data-[active=true]:border-primary data-[active=true]:bg-primary/5"
        data-active={isSelected}
      >
        <span className="line-clamp-2 text-sm font-semibold">{node.nameEn}</span>
        <span className="mt-1 truncate text-xs text-muted-foreground">{node.code || '-'}</span>
        {!node.isActive ? (
          <Badge variant="secondary" className="mx-auto mt-2 w-fit">
            Inactive
          </Badge>
        ) : null}
      </button>
      {hasChildren ? (
        <div className="relative mt-6 pt-6 before:absolute before:left-1/2 before:top-0 before:h-6 before:w-px before:bg-border">
          <ul className="relative flex items-start justify-center">
            {node.children.map((child) => (
              <OrganizationChartNode
                key={child.id}
                node={child}
                selectedDepartmentId={selectedDepartmentId}
                onSelect={onSelect}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </li>
  );
}

export default function OrganizationStructurePage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { data: departmentsResponse, isLoading: departmentsLoading } = useDepartments();
  const createDepartment = useCreateDepartment();
  const updateDepartment = useUpdateDepartment();

  const departments = departmentsResponse?.departments ?? [];
  const departmentTree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const defaultDepartmentId = departmentTree[0]?.id ?? '';
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('');
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentForm, setDepartmentForm] = useState(departmentInitialForm);
  const [organizationView, setOrganizationView] = useState<OrganizationView>('tree');
  const [chartDepartmentDialogOpen, setChartDepartmentDialogOpen] = useState(false);

  const selectedDepartment = departments.find((department) => department.id === selectedDepartmentId);
  const selectedDepartmentNode = selectedDepartmentId
    ? findDepartmentNode(departmentTree, selectedDepartmentId)
    : undefined;

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

  const openCreateDepartment = (parentDepartmentId: string | null = null) => {
    setEditingDepartment(null);
    setDepartmentForm({ ...departmentInitialForm, parentDepartmentId });
    setDepartmentDialogOpen(true);
  };

  const openEditDepartment = (department: Department) => {
    setEditingDepartment(department);
    setDepartmentForm({
      nameEn: department.nameEn,
      nameAm: department.nameAm ?? '',
      code: department.code ?? '',
      parentDepartmentId: department.parentDepartmentId,
      isActive: department.isActive,
    });
    setDepartmentDialogOpen(true);
  };

  const openChartDepartment = (department: Department) => {
    setSelectedDepartmentId(department.id);
    setChartDepartmentDialogOpen(true);
  };

  const openCreateDepartmentFromChart = (parentDepartmentId: string) => {
    setChartDepartmentDialogOpen(false);
    openCreateDepartment(parentDepartmentId);
  };

  const openEditDepartmentFromChart = (department: Department) => {
    setChartDepartmentDialogOpen(false);
    openEditDepartment(department);
  };

  const saveDepartment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = {
        nameEn: departmentForm.nameEn.trim(),
        nameAm: departmentForm.nameAm.trim() || null,
        code: departmentForm.code.trim() || null,
        parentDepartmentId: departmentForm.parentDepartmentId,
        isActive: departmentForm.isActive,
      };

      const response = editingDepartment
        ? await updateDepartment.mutateAsync({ departmentId: editingDepartment.id, ...payload })
        : await createDepartment.mutateAsync(payload);

      setSelectedDepartmentId(response.department.id);
      setDepartmentDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: editingDepartment ? t('departmentUpdated') : t('departmentCreated'),
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
        <Button onClick={() => openCreateDepartment()}>
          <Plus className="size-4" />
          {t('addRootDepartment')}
        </Button>
        <div className="flex w-fit rounded-md border border-border p-1">
          <Button
            type="button"
            variant={organizationView === 'tree' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setOrganizationView('tree')}
          >
            <ListTree className="size-4" />
            {t('treeView')}
          </Button>
          <Button
            type="button"
            variant={organizationView === 'chart' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setOrganizationView('chart')}
          >
            <GitBranch className="size-4" />
            {t('chartView')}
          </Button>
        </div>
      </div>

      {organizationView === 'tree' ? (
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>{t('departmentTree')}</CardTitle>
              <CardDescription>{t('departmentTreeDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {departmentsLoading ? (
                <p className="text-sm text-muted-foreground">{t('loadingOrganization')}</p>
              ) : departmentTree.length === 0 ? (
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
                    onSelect={(department) => setSelectedDepartmentId(department.id)}
                    onCreateChild={(departmentId) => openCreateDepartment(departmentId)}
                    onEdit={openEditDepartment}
                    addChildLabel={t('addChildDepartment')}
                    editLabel={common('edit')}
                  />
                ))
              )}
            </CardContent>
          </Card>

          <DepartmentChildrenCard
            selectedDepartmentNode={selectedDepartmentNode}
            onSelect={(department) => setSelectedDepartmentId(department.id)}
            onCreateChild={openCreateDepartment}
            onEdit={openEditDepartment}
            t={t}
            common={common}
          />
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="rounded-lg">
            <CardHeader>
              <CardTitle>{t('chartView')}</CardTitle>
              <CardDescription>{t('departmentTreeDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              {departmentsLoading ? (
                <p className="text-sm text-muted-foreground">{t('loadingOrganization')}</p>
              ) : departmentTree.length === 0 ? (
                <EmptyState
                  icon={GitBranch}
                  title={t('noDepartments')}
                  description={t('noDepartmentsDescription')}
                />
              ) : (
                <div className="overflow-x-auto rounded-md border border-border bg-muted/20 p-4">
                  <div className="inline-flex min-w-full justify-center pb-2">
                    <ul className="flex items-start justify-center">
                      {departmentTree.map((node) => (
                        <OrganizationChartNode
                          key={node.id}
                          node={node}
                          selectedDepartmentId={selectedDepartmentId}
                          onSelect={openChartDepartment}
                        />
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={departmentDialogOpen} onOpenChange={setDepartmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDepartment ? t('editDepartment') : t('addDepartment')}</DialogTitle>
            <DialogDescription>{t('departmentFormDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveDepartment}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="department-name-en">{t('nameEn')}</Label>
                <Input
                  id="department-name-en"
                  value={departmentForm.nameEn}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, nameEn: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-name-am">{t('nameAm')}</Label>
                <Input
                  id="department-name-am"
                  value={departmentForm.nameAm}
                  onChange={(event) => setDepartmentForm((current) => ({ ...current, nameAm: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department-code">{t('code')}</Label>
              <Input
                id="department-code"
                value={departmentForm.code}
                onChange={(event) => setDepartmentForm((current) => ({ ...current, code: event.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>{t('active')}</Label>
              <Switch
                checked={departmentForm.isActive}
                onCheckedChange={(checked) => setDepartmentForm((current) => ({ ...current, isActive: checked }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDepartmentDialogOpen(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={createDepartment.isPending || updateDepartment.isPending || !departmentForm.nameEn.trim()}>
                {createDepartment.isPending || updateDepartment.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={chartDepartmentDialogOpen} onOpenChange={setChartDepartmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedDepartment?.nameEn ?? t('departmentDetails')}</DialogTitle>
            <DialogDescription>{t('departmentDetailsDescription')}</DialogDescription>
          </DialogHeader>
          {selectedDepartment ? (
            <div className="space-y-5">
              <DepartmentDetailsGrid selectedDepartment={selectedDepartment} t={t} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => openCreateDepartmentFromChart(selectedDepartment.id)}>
                  <Plus className="size-4" />
                  {t('addChildDepartment')}
                </Button>
                <Button type="button" onClick={() => openEditDepartmentFromChart(selectedDepartment)}>
                  <Pencil className="size-4" />
                  {common('edit')}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DepartmentChildrenCard({
  selectedDepartmentNode,
  onSelect,
  onCreateChild,
  onEdit,
  t,
  common,
}: {
  selectedDepartmentNode: DepartmentNode | undefined;
  onSelect: (department: Department) => void;
  onCreateChild: (departmentId: string) => void;
  onEdit: (department: Department) => void;
  t: ReturnType<typeof useTranslations<'core'>>;
  common: ReturnType<typeof useTranslations<'common'>>;
}) {
  const children = selectedDepartmentNode?.children ?? [];

  return (
    <Card className="rounded-lg">
      <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <CardTitle>{selectedDepartmentNode?.nameEn ?? t('childDepartments')}</CardTitle>
          <CardDescription>
            {selectedDepartmentNode
              ? t('childDepartmentsDescription')
              : t('selectDepartment')}
          </CardDescription>
        </div>
        {selectedDepartmentNode ? (
          <Button variant="outline" onClick={() => onCreateChild(selectedDepartmentNode.id)}>
            <Plus className="size-4" />
            {t('addChildDepartment')}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {!selectedDepartmentNode ? (
          <p className="text-sm text-muted-foreground">{t('selectDepartment')}</p>
        ) : children.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={t('noChildDepartments')}
            description={t('noChildDepartmentsDescription')}
            className="min-h-72"
            action={
              <Button onClick={() => onCreateChild(selectedDepartmentNode.id)}>
                <Plus className="size-4" />
                {t('addChildDepartment')}
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/50"
              >
                <button
                  type="button"
                  onClick={() => onSelect(child)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Building2 className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{child.nameEn}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {child.code || t('noCode')} · {t('childDepartmentCount', { count: child.children.length })}
                    </span>
                  </span>
                </button>
                {!child.isActive ? <Badge variant="secondary">{t('inactive')}</Badge> : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onCreateChild(child.id)}
                  title={t('addChildDepartment')}
                >
                  <Plus className="size-4" />
                  <span className="sr-only">{t('addChildDepartment')}</span>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(child)}
                  title={common('edit')}
                >
                  <Pencil className="size-4" />
                  <span className="sr-only">{common('edit')}</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DepartmentDetailsGrid({
  selectedDepartment,
  t,
}: {
  selectedDepartment: Department;
  t: ReturnType<typeof useTranslations<'core'>>;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div>
        <p className="text-xs text-muted-foreground">{t('nameEn')}</p>
        <p className="font-medium">{selectedDepartment.nameEn}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t('nameAm')}</p>
        <p className="font-medium">{selectedDepartment.nameAm || '-'}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t('code')}</p>
        <p className="font-medium">{selectedDepartment.code || '-'}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t('status')}</p>
        <Badge variant={selectedDepartment.isActive ? 'default' : 'secondary'}>
          {selectedDepartment.isActive ? t('active') : t('inactive')}
        </Badge>
      </div>
    </div>
  );
}
