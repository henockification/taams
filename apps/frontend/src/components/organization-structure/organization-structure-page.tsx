'use client';

import { createContext, useContext, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  ArrowUpToLine,
  Building2,
  ChevronRight,
  CornerDownRight,
  GitBranch,
  GripVertical,
  ListTree,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

import { userHasPermission } from '@/config/app-navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useDepartments, useMoveDepartment } from '@/data/hooks/core.hooks';
import type { Department } from '@/data/types/core.types';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { cn } from '@/lib/utils';

import { DepartmentFormDialog, MoveDepartmentDialog } from './department-dialogs';
import {
  buildDepartmentTree,
  collectSelfAndDescendantIds,
  isNotPlaced,
  type DepartmentNode,
} from './department-tree';
import { OrganizationChart } from './organization-chart';

type StructureType = 'permanent' | 'contract';
type OrganizationView = 'tree' | 'chart';
type PoolFilter = 'all' | 'notPlaced';
type DragData = { departmentId: string };
type DropData = { parentDepartmentId: string | null };

const ROOT_DROP_ID = 'drop:root';

type StructureContextValue = {
  canEdit: boolean;
  draggingDepartment: Department | null;
  blockedIds: Set<string>;
  collapsedIds: Set<string>;
  toggleCollapsed: (departmentId: string) => void;
  onAddChild: (parentDepartmentId: string) => void;
  onEdit: (department: Department) => void;
  onMoveTo: (department: Department) => void;
  onMakeTopLevel: (department: Department) => void;
};

const StructureContext = createContext<StructureContextValue | null>(null);

function useStructure() {
  const value = useContext(StructureContext);
  if (!value) throw new Error('useStructure must be used inside OrganizationStructurePage');
  return value;
}

/** A drop target is pointless when it is the dragged department, one of its descendants, or its current parent. */
function isDropDisabled(context: StructureContextValue, parentDepartmentId: string | null) {
  const dragging = context.draggingDepartment;
  if (!context.canEdit) return true;
  if (!dragging) return false;
  if (parentDepartmentId && context.blockedIds.has(parentDepartmentId)) return true;
  return (dragging.parentDepartmentId ?? null) === parentDepartmentId;
}

function DepartmentActionsMenu({ department }: { department: Department }) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { onAddChild, onEdit, onMoveTo, onMakeTopLevel } = useStructure();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" title={t('departmentActions')}>
          <MoreHorizontal className="size-4" />
          <span className="sr-only">{t('departmentActions')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onAddChild(department.id)}>
          <Plus className="size-4" />
          {t('addChildDepartment')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onEdit(department)}>
          <Pencil className="size-4" />
          {common('edit')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onMoveTo(department)}>
          <CornerDownRight className="size-4" />
          {t('moveTo')}
        </DropdownMenuItem>
        {department.parentDepartmentId ? (
          <DropdownMenuItem onSelect={() => onMakeTopLevel(department)}>
            <ArrowUpToLine className="size-4" />
            {t('makeTopLevel')}
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function StructureNode({ node }: { node: DepartmentNode }) {
  const t = useTranslations('core');
  const context = useStructure();
  const { canEdit, draggingDepartment, blockedIds, collapsedIds, toggleCollapsed } = context;
  const hasChildren = node.children.length > 0;
  const isCollapsed = collapsedIds.has(node.id);
  const dropDisabled = isDropDisabled(context, node.id);

  const draggable = useDraggable({
    id: `tree:${node.id}`,
    data: { departmentId: node.id } satisfies DragData,
    disabled: !canEdit,
  });
  const droppable = useDroppable({
    id: `drop:${node.id}`,
    data: { parentDepartmentId: node.id } satisfies DropData,
    disabled: dropDisabled,
  });

  return (
    <li>
      <div
        ref={droppable.setNodeRef}
        className={cn(
          'flex items-center gap-1 rounded-md border border-transparent py-1 pr-1 text-sm transition-colors hover:bg-accent/60',
          draggable.isDragging && 'opacity-40',
          draggingDepartment && blockedIds.has(node.id) && 'opacity-40',
          droppable.isOver && !dropDisabled && 'border-primary bg-primary/10 ring-2 ring-primary/30',
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn('size-7 shrink-0', !hasChildren && 'invisible')}
          onClick={() => toggleCollapsed(node.id)}
          aria-expanded={!isCollapsed}
          title={t('toggleSubDepartments')}
        >
          <ChevronRight className={cn('size-4 transition-transform', !isCollapsed && 'rotate-90')} />
          <span className="sr-only">{t('toggleSubDepartments')}</span>
        </Button>
        {canEdit ? (
          <button
            type="button"
            ref={draggable.setNodeRef}
            {...draggable.listeners}
            {...draggable.attributes}
            className="flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground active:cursor-grabbing"
            title={t('dragToMove')}
          >
            <GripVertical className="size-4" />
            <span className="sr-only">{t('dragToMove')}</span>
          </button>
        ) : null}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Building2 className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate px-1 font-medium">
          {node.nameEn}
          {node.code ? <span className="ml-2 text-xs font-normal text-muted-foreground">{node.code}</span> : null}
        </span>
        {hasChildren ? (
          <Badge variant="outline" className="shrink-0">
            {node.children.length}
          </Badge>
        ) : null}
        {!node.isActive ? (
          <Badge variant="secondary" className="shrink-0">
            {t('inactive')}
          </Badge>
        ) : null}
        {canEdit ? <DepartmentActionsMenu department={node} /> : null}
      </div>
      {hasChildren && !isCollapsed ? (
        <ul className="ml-[13px] space-y-1 border-l border-border pl-4 pt-1">
          {node.children.map((child) => (
            <StructureNode key={child.id} node={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function RootDropZone() {
  const t = useTranslations('core');
  const context = useStructure();
  const dropDisabled = isDropDisabled(context, null);
  const { setNodeRef, isOver } = useDroppable({
    id: ROOT_DROP_ID,
    data: { parentDepartmentId: null } satisfies DropData,
    disabled: dropDisabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs text-muted-foreground transition-colors',
        context.draggingDepartment && !dropDisabled && 'border-primary/60 text-foreground',
        isOver && !dropDisabled && 'border-primary bg-primary/10',
        context.draggingDepartment && dropDisabled && 'opacity-40',
      )}
    >
      <ArrowUpToLine className="size-4" />
      {t('dropToTopLevel')}
    </div>
  );
}

function PoolItem({
  department,
  parentName,
  notPlaced,
}: {
  department: Department;
  parentName: string | undefined;
  notPlaced: boolean;
}) {
  const t = useTranslations('core');
  const { onMoveTo } = useStructure();
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `pool:${department.id}`,
    data: { departmentId: department.id } satisfies DragData,
  });

  return (
    <li
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex cursor-grab touch-none items-center gap-2 rounded-md border border-border bg-card px-2 py-2 text-sm shadow-xs transition-colors hover:border-primary/50 hover:bg-accent/40 active:cursor-grabbing',
        isDragging && 'opacity-40',
      )}
    >
      <GripVertical className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{department.nameEn}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {parentName ? t('underDepartment', { name: parentName }) : t('topLevel')}
        </span>
      </span>
      {notPlaced ? (
        <Badge variant="outline" className="shrink-0 border-amber-500/50 text-amber-700 dark:text-amber-400">
          {t('notPlaced')}
        </Badge>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-7 shrink-0"
        title={t('moveTo')}
        onPointerDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onClick={() => onMoveTo(department)}
      >
        <CornerDownRight className="size-4" />
        <span className="sr-only">{t('moveTo')}</span>
      </Button>
    </li>
  );
}

export function OrganizationStructurePage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const session = useSession();
  const canEdit = userHasPermission(session.data?.user, 'organization-structure:edit');
  const { data: departmentsResponse, isLoading } = useDepartments();
  const moveDepartmentMutation = useMoveDepartment();

  const [structureType, setStructureType] = useState<StructureType>('permanent');
  const [view, setView] = useState<OrganizationView>('tree');
  const [search, setSearch] = useState('');
  const [poolFilter, setPoolFilter] = useState<PoolFilter>('all');
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(() => new Set());
  const [draggingDepartmentId, setDraggingDepartmentId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [defaultParentDepartmentId, setDefaultParentDepartmentId] = useState<string | null>(null);
  const [movingDepartment, setMovingDepartment] = useState<Department | null>(null);

  const isContract = structureType === 'contract';
  const departments = useMemo(
    () => (departmentsResponse?.departments ?? []).filter((department) => department.isContract === isContract),
    [departmentsResponse, isContract],
  );
  const departmentById = useMemo(
    () => new Map(departments.map((department) => [department.id, department])),
    [departments],
  );
  const tree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const draggingDepartment = draggingDepartmentId ? departmentById.get(draggingDepartmentId) ?? null : null;
  const blockedIds = useMemo(
    () => (draggingDepartmentId ? collectSelfAndDescendantIds(departments, draggingDepartmentId) : new Set<string>()),
    [departments, draggingDepartmentId],
  );

  const poolDepartments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return departments
      .filter((department) => poolFilter === 'all' || isNotPlaced(department, departments))
      .filter((department) => !query || [department.nameEn, department.nameAm, department.code]
        .some((value) => value?.toLowerCase().includes(query)))
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  }, [departments, poolFilter, search]);
  const notPlacedCount = useMemo(
    () => departments.filter((department) => isNotPlaced(department, departments)).length,
    [departments],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const moveDepartment = async (department: Department, parentDepartmentId: string | null) => {
    if ((department.parentDepartmentId ?? null) === parentDepartmentId) return true;

    try {
      await moveDepartmentMutation.mutateAsync({ departmentId: department.id, parentDepartmentId });
      if (parentDepartmentId) {
        setCollapsedIds((current) => {
          if (!current.has(parentDepartmentId)) return current;
          const next = new Set(current);
          next.delete(parentDepartmentId);
          return next;
        });
      }
      notifications.show({
        title: common('success'),
        message: parentDepartmentId
          ? t('departmentMovedUnder', {
            name: department.nameEn,
            parent: departmentById.get(parentDepartmentId)?.nameEn ?? '',
          })
          : t('departmentMovedToTop', { name: department.nameEn }),
        color: 'green',
      });
      return true;
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('moveFailed'),
        color: 'red',
      });
      return false;
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingDepartmentId((event.active.data.current as DragData | undefined)?.departmentId ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingDepartmentId(null);
    const departmentId = (event.active.data.current as DragData | undefined)?.departmentId;
    const drop = event.over?.data.current as DropData | undefined;
    const department = departmentId ? departmentById.get(departmentId) : undefined;
    if (!department || !drop) return;
    void moveDepartment(department, drop.parentDepartmentId);
  };

  const openCreate = (parentDepartmentId: string | null = null) => {
    setEditingDepartment(null);
    setDefaultParentDepartmentId(parentDepartmentId);
    setFormOpen(true);
  };

  const openEdit = (department: Department) => {
    setEditingDepartment(department);
    setDefaultParentDepartmentId(null);
    setFormOpen(true);
  };

  const contextValue: StructureContextValue = {
    canEdit,
    draggingDepartment,
    blockedIds,
    collapsedIds,
    toggleCollapsed: (departmentId) =>
      setCollapsedIds((current) => {
        const next = new Set(current);
        if (next.has(departmentId)) next.delete(departmentId);
        else next.add(departmentId);
        return next;
      }),
    onAddChild: (parentDepartmentId) => openCreate(parentDepartmentId),
    onEdit: openEdit,
    onMoveTo: setMovingDepartment,
    onMakeTopLevel: (department) => void moveDepartment(department, null),
  };

  const emptyState = (
    <EmptyState
      icon={Building2}
      title={t('noDepartments')}
      description={t('noDepartmentsDescription')}
      action={canEdit ? (
        <Button onClick={() => openCreate()}>
          <Plus className="size-4" />
          {t('newDepartment')}
        </Button>
      ) : undefined}
    />
  );

  return (
    <StructureContext.Provider value={contextValue}>
      <div className="flex w-full flex-col gap-6">
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={structureType} onValueChange={(value) => setStructureType(value as StructureType)}>
            <TabsList>
              <TabsTrigger value="permanent">{t('permanentStructure')}</TabsTrigger>
              <TabsTrigger value="contract">{t('contractStructure')}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex w-fit rounded-md border border-border p-1">
              <Button
                type="button"
                variant={view === 'tree' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('tree')}
              >
                <ListTree className="size-4" />
                {t('treeView')}
              </Button>
              <Button
                type="button"
                variant={view === 'chart' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setView('chart')}
              >
                <GitBranch className="size-4" />
                {t('chartView')}
              </Button>
            </div>
            {canEdit ? (
              <Button onClick={() => openCreate()}>
                <Plus className="size-4" />
                {t('newDepartment')}
              </Button>
            ) : null}
          </div>
        </div>

        {view === 'chart' ? (
          <Card className="rounded-lg">
            <CardContent className="pt-6">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">{t('loadingOrganization')}</p>
              ) : tree.length === 0 ? (
                emptyState
              ) : (
                <OrganizationChart tree={tree} inactiveLabel={t('inactive')} onSelect={canEdit ? openEdit : undefined} />
              )}
            </CardContent>
          </Card>
        ) : (
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggingDepartmentId(null)}
          >
            <div className={cn('grid gap-6', canEdit && 'lg:grid-cols-[340px_minmax(0,1fr)]')}>
              {canEdit ? (
                <Card className="rounded-lg lg:sticky lg:top-4 lg:self-start">
                  <CardHeader className="space-y-3">
                    <div className="space-y-1">
                      <CardTitle className="text-base">{t('departmentsPool')}</CardTitle>
                      <CardDescription>{t('departmentsPoolDescription')}</CardDescription>
                    </div>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder={t('searchDepartments')}
                        className="pl-8"
                      />
                    </div>
                    <div className="flex w-fit rounded-md border border-border p-1">
                      <Button
                        type="button"
                        variant={poolFilter === 'all' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setPoolFilter('all')}
                      >
                        {t('allDepartments')}
                      </Button>
                      <Button
                        type="button"
                        variant={poolFilter === 'notPlaced' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setPoolFilter('notPlaced')}
                      >
                        {t('notPlaced')}
                        <Badge variant="outline" className="ml-1">{notPlacedCount}</Badge>
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {poolDepartments.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">{t('noDepartmentsFound')}</p>
                    ) : (
                      <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                        {poolDepartments.map((department) => (
                          <PoolItem
                            key={department.id}
                            department={department}
                            parentName={department.parentDepartmentId
                              ? departmentById.get(department.parentDepartmentId)?.nameEn
                              : undefined}
                            notPlaced={isNotPlaced(department, departments)}
                          />
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              <Card className="rounded-lg">
                <CardHeader>
                  <CardTitle className="text-base">{t('structure')}</CardTitle>
                  <CardDescription>{canEdit ? t('structureDescription') : t('structureReadOnlyDescription')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isLoading ? (
                    <p className="text-sm text-muted-foreground">{t('loadingOrganization')}</p>
                  ) : tree.length === 0 ? (
                    emptyState
                  ) : (
                    <>
                      {canEdit ? <RootDropZone /> : null}
                      <ul className="space-y-1">
                        {tree.map((node) => (
                          <StructureNode key={node.id} node={node} />
                        ))}
                      </ul>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            <DragOverlay dropAnimation={null}>
              {draggingDepartment ? (
                <div className="flex w-72 cursor-grabbing items-center gap-2 rounded-md border border-primary bg-card px-3 py-2 text-sm font-medium shadow-lg">
                  <Building2 className="size-4 shrink-0 text-primary" />
                  <span className="truncate">{draggingDepartment.nameEn}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        <DepartmentFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          departments={departments}
          isContract={isContract}
          department={editingDepartment}
          defaultParentDepartmentId={defaultParentDepartmentId}
        />
        <MoveDepartmentDialog
          department={movingDepartment}
          departments={departments}
          onOpenChange={(open) => {
            if (!open) setMovingDepartment(null);
          }}
          onMove={moveDepartment}
          isMoving={moveDepartmentMutation.isPending}
        />
      </div>
    </StructureContext.Provider>
  );
}
