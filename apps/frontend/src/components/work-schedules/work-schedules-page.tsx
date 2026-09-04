'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Pencil, Plus, Timer, Trash2, UserRoundCog } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { CalendarDateField } from '@/components/calendar/calendar-date-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  useAllEmployeeWorkSchedules,
  useBulkCreateEmployeeWorkSchedules,
  useCreateShift,
  useCreateShiftSegment,
  useCreateWorkSchedule,
  useCreateWorkScheduleDay,
  useDeleteEmployeeWorkSchedule,
  useDepartments,
  useEmployees,
  useShiftSegments,
  useShifts,
  useUpdateShift,
  useUpdateShiftSegment,
  useUpdateEmployeeWorkSchedule,
  useUpdateWorkSchedule,
  useUpdateWorkScheduleDay,
  useWorkScheduleDays,
  useWorkSchedules,
} from '@/data/hooks/core.hooks';
import type { DayOfWeek, Employee, EmployeeWorkSchedule, Shift, ShiftSegment, WorkSchedule, WorkScheduleDay } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';
import { useCalendarPreference } from '@/providers/CalendarPreferenceProvider';

const dayOptions: DayOfWeek[] = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const shiftInitialForm = {
  nameEn: '',
  nameAm: '',
  gracePeriodMinutes: 0,
  lateAfterMinutes: 0,
  earlyOutBeforeMinutes: 0,
  isOvernight: false,
  isActive: true,
};

const shiftSegmentInitialForm = {
  nameEn: '',
  nameAm: '',
  startTime: '08:30',
  endTime: '12:00',
  sortOrder: 1,
  isActive: true,
};

const workScheduleInitialForm = {
  nameEn: '',
  nameAm: '',
  description: '',
  isDefault: false,
  isActive: true,
};

const workScheduleDayInitialForm = {
  dayOfWeek: 'MONDAY' as DayOfWeek,
  shiftId: 'none',
  isOffDay: false,
  isActive: true,
};

const employeeWorkScheduleInitialForm = {
  employeeId: '',
  workScheduleId: '',
  effectiveFrom: '',
  effectiveTo: '',
  isActive: true,
};

const allDepartmentsValue = '__all_departments';

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function toTimeInput(value: string) {
  return value.slice(0, 5);
}

function formatTime(value: string) {
  return toTimeInput(value);
}

function numberValue(value: FormDataEntryValue | null) {
  return Number(value ?? 0) || 0;
}

type WorkScheduleSection = 'shifts' | 'work-schedules' | 'assignments';

type WorkSchedulesPageProps = {
  initialSection?: WorkScheduleSection;
  hideTabs?: boolean;
};

export function WorkSchedulesPage({
  initialSection = 'work-schedules',
  hideTabs = false,
}: WorkSchedulesPageProps = {}) {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { formatDate } = useCalendarPreference();
  const { data: shiftsResponse, isLoading: shiftsLoading } = useShifts();
  const { data: workSchedulesResponse, isLoading: workSchedulesLoading } = useWorkSchedules();
  const { data: employeesResponse, isLoading: employeesLoading } = useEmployees();
  const { data: departmentsResponse } = useDepartments();

  const shifts = shiftsResponse?.shifts ?? [];
  const workSchedules = workSchedulesResponse?.workSchedules ?? [];
  const employees = employeesResponse?.employees ?? [];
  const departments = departmentsResponse?.departments ?? [];

  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedWorkScheduleId, setSelectedWorkScheduleId] = useState('');
  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId);
  const selectedWorkSchedule = workSchedules.find((schedule) => schedule.id === selectedWorkScheduleId);

  const { data: shiftSegmentsResponse, isLoading: shiftSegmentsLoading } = useShiftSegments(selectedShiftId);
  const { data: workScheduleDaysResponse, isLoading: workScheduleDaysLoading } = useWorkScheduleDays(selectedWorkScheduleId);
  const [employeeWorkScheduleForm, setEmployeeWorkScheduleForm] = useState({
    ...employeeWorkScheduleInitialForm,
    effectiveFrom: todayInput(),
  });
  const { data: allEmployeeWorkSchedulesResponse, isLoading: allEmployeeWorkSchedulesLoading } = useAllEmployeeWorkSchedules();
  const shiftSegments = shiftSegmentsResponse?.shiftSegments ?? [];
  const workScheduleDays = workScheduleDaysResponse?.days ?? [];
  const allEmployeeWorkSchedules = allEmployeeWorkSchedulesResponse?.employeeWorkSchedules ?? [];

  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const createShiftSegment = useCreateShiftSegment();
  const updateShiftSegment = useUpdateShiftSegment();
  const bulkCreateEmployeeWorkSchedules = useBulkCreateEmployeeWorkSchedules();
  const updateEmployeeWorkSchedule = useUpdateEmployeeWorkSchedule();
  const deleteEmployeeWorkSchedule = useDeleteEmployeeWorkSchedule();
  const createWorkSchedule = useCreateWorkSchedule();
  const updateWorkSchedule = useUpdateWorkSchedule();
  const createWorkScheduleDay = useCreateWorkScheduleDay();
  const updateWorkScheduleDay = useUpdateWorkScheduleDay();

  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftSegmentDialogOpen, setShiftSegmentDialogOpen] = useState(false);
  const [workScheduleDialogOpen, setWorkScheduleDialogOpen] = useState(false);
  const [workScheduleDayDialogOpen, setWorkScheduleDayDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState(allDepartmentsValue);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentPageSize, setAssignmentPageSize] = useState(50);
  const [editingEmployeeWorkSchedule, setEditingEmployeeWorkSchedule] = useState<EmployeeWorkSchedule | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editingShiftSegment, setEditingShiftSegment] = useState<ShiftSegment | null>(null);
  const [editingWorkSchedule, setEditingWorkSchedule] = useState<WorkSchedule | null>(null);
  const [editingWorkScheduleDay, setEditingWorkScheduleDay] = useState<WorkScheduleDay | null>(null);
  const [shiftForm, setShiftForm] = useState(shiftInitialForm);
  const [shiftSegmentForm, setShiftSegmentForm] = useState(shiftSegmentInitialForm);
  const [workScheduleForm, setWorkScheduleForm] = useState(workScheduleInitialForm);
  const [workScheduleDayForm, setWorkScheduleDayForm] = useState(workScheduleDayInitialForm);

  const assignmentByEmployeeId = useMemo(() => {
    const map = new Map<string, EmployeeWorkSchedule>();
    const sorted = [...allEmployeeWorkSchedules].sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom));
    for (const assignment of sorted) {
      if (!assignment.isActive) continue;
      if (!map.has(assignment.employeeId)) map.set(assignment.employeeId, assignment);
    }
    return map;
  }, [allEmployeeWorkSchedules]);

  const filteredEmployees = useMemo(() => {
    const query = assignmentSearch.trim().toLowerCase();
    return employees.filter((employee) => {
      if (departmentFilter !== allDepartmentsValue) {
        const departmentId = employee.department?.id ?? employee.departmentId;
        if (departmentId !== departmentFilter) return false;
      }

      if (!query) return true;

      const haystack = [
        employee.firstNameEn,
        employee.middleNameEn,
        employee.lastNameEn,
        employee.employeeCode,
        employee.department?.nameEn,
        employee.sourceDepartmentName,
        employee.position?.nameEn,
        employee.positionName,
        employee.sourcePositionName,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(query);
    });
  }, [assignmentSearch, departmentFilter, employees]);

  const assignmentTotal = filteredEmployees.length;
  const assignmentTotalPages = Math.max(1, Math.ceil(assignmentTotal / assignmentPageSize));
  const assignmentCurrentPage = Math.min(assignmentPage, assignmentTotalPages);
  const assignmentStartIndex = (assignmentCurrentPage - 1) * assignmentPageSize;
  const paginatedEmployees = filteredEmployees.slice(assignmentStartIndex, assignmentStartIndex + assignmentPageSize);
  const filteredEmployeeIds = useMemo(() => filteredEmployees.map((employee) => employee.id), [filteredEmployees]);
  const selectedFilteredCount = filteredEmployeeIds.filter((id) => selectedEmployeeIds.has(id)).length;
  const allFilteredSelected = filteredEmployeeIds.length > 0 && selectedFilteredCount === filteredEmployeeIds.length;
  const editingAssignmentEmployee = employees.find((employee) => employee.id === (editingEmployeeWorkSchedule?.employeeId ?? employeeWorkScheduleForm.employeeId));

  useEffect(() => {
    if (shifts.length === 0) {
      if (selectedShiftId) setSelectedShiftId('');
      return;
    }
    if (!shifts.some((shift) => shift.id === selectedShiftId)) {
      setSelectedShiftId(shifts[0].id);
    }
  }, [selectedShiftId, shifts]);

  useEffect(() => {
    if (workSchedules.length === 0) {
      if (selectedWorkScheduleId) setSelectedWorkScheduleId('');
      return;
    }
    if (!workSchedules.some((schedule) => schedule.id === selectedWorkScheduleId)) {
      setSelectedWorkScheduleId(workSchedules[0].id);
    }
  }, [selectedWorkScheduleId, workSchedules]);

  useEffect(() => {
    setEmployeeWorkScheduleForm((current) => {
      if (current.workScheduleId || !workSchedules[0]) return current;
      return { ...current, workScheduleId: workSchedules[0].id };
    });
  }, [workSchedules]);

  useEffect(() => {
    setAssignmentPage(1);
  }, [assignmentPageSize, assignmentSearch, departmentFilter]);

  useEffect(() => {
    if (assignmentCurrentPage !== assignmentPage) {
      setAssignmentPage(assignmentCurrentPage);
    }
  }, [assignmentCurrentPage, assignmentPage]);

  const openCreateShift = () => {
    setEditingShift(null);
    setShiftForm(shiftInitialForm);
    setShiftDialogOpen(true);
  };

  const openEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftForm({
      nameEn: shift.nameEn,
      nameAm: shift.nameAm ?? '',
      gracePeriodMinutes: shift.gracePeriodMinutes,
      lateAfterMinutes: shift.lateAfterMinutes,
      earlyOutBeforeMinutes: shift.earlyOutBeforeMinutes,
      isOvernight: shift.isOvernight,
      isActive: shift.isActive,
    });
    setShiftDialogOpen(true);
  };

  const openCreateShiftSegment = () => {
    setEditingShiftSegment(null);
    setShiftSegmentForm(shiftSegmentInitialForm);
    setShiftSegmentDialogOpen(true);
  };

  const openEditShiftSegment = (segment: ShiftSegment) => {
    setEditingShiftSegment(segment);
    setShiftSegmentForm({
      nameEn: segment.nameEn,
      nameAm: segment.nameAm ?? '',
      startTime: toTimeInput(segment.startTime),
      endTime: toTimeInput(segment.endTime),
      sortOrder: segment.sortOrder,
      isActive: segment.isActive,
    });
    setShiftSegmentDialogOpen(true);
  };

  const openCreateWorkSchedule = () => {
    setEditingWorkSchedule(null);
    setWorkScheduleForm(workScheduleInitialForm);
    setWorkScheduleDialogOpen(true);
  };

  const openEditWorkSchedule = (workSchedule: WorkSchedule) => {
    setEditingWorkSchedule(workSchedule);
    setWorkScheduleForm({
      nameEn: workSchedule.nameEn,
      nameAm: workSchedule.nameAm ?? '',
      description: workSchedule.description ?? '',
      isDefault: workSchedule.isDefault,
      isActive: workSchedule.isActive,
    });
    setWorkScheduleDialogOpen(true);
  };

  const openCreateWorkScheduleDay = () => {
    setEditingWorkScheduleDay(null);
    setWorkScheduleDayForm(workScheduleDayInitialForm);
    setWorkScheduleDayDialogOpen(true);
  };

  const openAssignmentDialog = () => {
    if (selectedEmployeeIds.size === 0) return;
    setEditingEmployeeWorkSchedule(null);
    setEmployeeWorkScheduleForm((current) => ({
      ...employeeWorkScheduleInitialForm,
      workScheduleId: current.workScheduleId || workSchedules[0]?.id || '',
      effectiveFrom: todayInput(),
      isActive: true,
    }));
    setAssignmentDialogOpen(true);
  };

  const openEditEmployeeWorkSchedule = (assignment: EmployeeWorkSchedule) => {
    setEditingEmployeeWorkSchedule(assignment);
    setEmployeeWorkScheduleForm({
      employeeId: assignment.employeeId,
      workScheduleId: assignment.workScheduleId,
      effectiveFrom: assignment.effectiveFrom,
      effectiveTo: assignment.effectiveTo ?? '',
      isActive: assignment.isActive,
    });
    setAssignmentDialogOpen(true);
  };

  const toggleEmployeeSelection = (employeeId: string, checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      if (checked) next.add(employeeId);
      else next.delete(employeeId);
      return next;
    });
  };

  const toggleFilteredSelection = (checked: boolean) => {
    setSelectedEmployeeIds((current) => {
      const next = new Set(current);
      for (const employeeId of filteredEmployeeIds) {
        if (checked) next.add(employeeId);
        else next.delete(employeeId);
      }
      return next;
    });
  };

  const removeEmployeeWorkSchedule = async (assignment: EmployeeWorkSchedule) => {
    if (!window.confirm(t('confirmRemoveWorkScheduleAssignment'))) return;

    try {
      await deleteEmployeeWorkSchedule.mutateAsync(assignment.id);
      notifications.show({ title: common('success'), message: t('employeeWorkScheduleRemoved'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const openEditWorkScheduleDay = (day: WorkScheduleDay) => {
    setEditingWorkScheduleDay(day);
    setWorkScheduleDayForm({
      dayOfWeek: day.dayOfWeek,
      shiftId: day.shiftId ?? 'none',
      isOffDay: day.isOffDay,
      isActive: day.isActive,
    });
    setWorkScheduleDayDialogOpen(true);
  };

  const saveShift = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const payload = {
      nameEn: shiftForm.nameEn.trim(),
      nameAm: shiftForm.nameAm.trim() || null,
      gracePeriodMinutes: numberValue(formData.get('gracePeriodMinutes')),
      lateAfterMinutes: numberValue(formData.get('lateAfterMinutes')),
      earlyOutBeforeMinutes: numberValue(formData.get('earlyOutBeforeMinutes')),
      isOvernight: shiftForm.isOvernight,
      isActive: shiftForm.isActive,
    };

    try {
      const response = editingShift
        ? await updateShift.mutateAsync({ shiftId: editingShift.id, ...payload })
        : await createShift.mutateAsync(payload);
      setSelectedShiftId(response.shift.id);
      setShiftDialogOpen(false);
      notifications.show({ title: common('success'), message: editingShift ? t('shiftUpdated') : t('shiftCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const saveShiftSegment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedShiftId) return;
    const formData = new FormData(event.currentTarget);
    const payload = {
      shiftId: selectedShiftId,
      nameEn: shiftSegmentForm.nameEn.trim(),
      nameAm: shiftSegmentForm.nameAm.trim() || null,
      startTime: shiftSegmentForm.startTime,
      endTime: shiftSegmentForm.endTime,
      sortOrder: Math.max(1, numberValue(formData.get('sortOrder'))),
      isActive: shiftSegmentForm.isActive,
    };

    try {
      if (editingShiftSegment) {
        await updateShiftSegment.mutateAsync({ shiftSegmentId: editingShiftSegment.id, ...payload });
      } else {
        await createShiftSegment.mutateAsync(payload);
      }
      setShiftSegmentDialogOpen(false);
      notifications.show({ title: common('success'), message: editingShiftSegment ? t('shiftSegmentUpdated') : t('shiftSegmentCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const saveWorkSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      nameEn: workScheduleForm.nameEn.trim(),
      nameAm: workScheduleForm.nameAm.trim() || null,
      description: workScheduleForm.description.trim() || null,
      isDefault: workScheduleForm.isDefault,
      isActive: workScheduleForm.isActive,
    };

    try {
      const response = editingWorkSchedule
        ? await updateWorkSchedule.mutateAsync({ workScheduleId: editingWorkSchedule.id, ...payload })
        : await createWorkSchedule.mutateAsync(payload);
      setSelectedWorkScheduleId(response.workSchedule.id);
      setWorkScheduleDialogOpen(false);
      notifications.show({ title: common('success'), message: editingWorkSchedule ? t('workScheduleUpdated') : t('workScheduleCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const saveWorkScheduleDay = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWorkScheduleId) return;
    const isOffDay = workScheduleDayForm.isOffDay;
    const payload = {
      workScheduleId: selectedWorkScheduleId,
      dayOfWeek: workScheduleDayForm.dayOfWeek,
      shiftId: isOffDay || workScheduleDayForm.shiftId === 'none' ? null : workScheduleDayForm.shiftId,
      isOffDay,
      isActive: workScheduleDayForm.isActive,
    };

    try {
      if (editingWorkScheduleDay) {
        await updateWorkScheduleDay.mutateAsync({ workScheduleDayId: editingWorkScheduleDay.id, ...payload });
      } else {
        await createWorkScheduleDay.mutateAsync(payload);
      }
      setWorkScheduleDayDialogOpen(false);
      notifications.show({ title: common('success'), message: editingWorkScheduleDay ? t('workScheduleDayUpdated') : t('workScheduleDayCreated'), color: 'green' });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const saveEmployeeWorkSchedule = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = {
      workScheduleId: employeeWorkScheduleForm.workScheduleId,
      effectiveFrom: employeeWorkScheduleForm.effectiveFrom,
      effectiveTo: employeeWorkScheduleForm.effectiveTo || null,
      isActive: employeeWorkScheduleForm.isActive,
    };

    try {
      if (editingEmployeeWorkSchedule) {
        await updateEmployeeWorkSchedule.mutateAsync({
          employeeWorkScheduleId: editingEmployeeWorkSchedule.id,
          employeeId: employeeWorkScheduleForm.employeeId,
          ...payload,
        });
        setAssignmentDialogOpen(false);
        setEditingEmployeeWorkSchedule(null);
        notifications.show({ title: common('success'), message: t('employeeWorkScheduleUpdated'), color: 'green' });
        return;
      }

      const employeeIds = [...selectedEmployeeIds];
      if (employeeIds.length === 0) return;

      const result = await bulkCreateEmployeeWorkSchedules.mutateAsync({
        employeeIds,
        ...payload,
      });
      setAssignmentDialogOpen(false);
      setSelectedEmployeeIds(new Set());
      notifications.show({
        title: result.failed > 0 ? common('error') : common('success'),
        message: result.failed > 0
          ? t('positionWorkSchedulePartiallyAssigned', { assignedCount: result.created, failedCount: result.failed })
          : t('positionWorkScheduleAssigned', { count: result.created }),
        color: result.failed > 0 ? 'yellow' : 'green',
      });
    } catch (error) {
      notifications.show({ title: common('error'), message: error instanceof Error ? error.message : t('saveFailed'), color: 'red' });
    }
  };

  const shiftSaving = createShift.isPending || updateShift.isPending;
  const shiftSegmentSaving = createShiftSegment.isPending || updateShiftSegment.isPending;
  const workScheduleSaving = createWorkSchedule.isPending || updateWorkSchedule.isPending;
  const workScheduleDaySaving = createWorkScheduleDay.isPending || updateWorkScheduleDay.isPending;
  const employeeWorkScheduleSaving = bulkCreateEmployeeWorkSchedules.isPending || updateEmployeeWorkSchedule.isPending || deleteEmployeeWorkSchedule.isPending;

  return (
    <div className="flex w-full flex-col gap-6">
      <Tabs defaultValue={initialSection} className="gap-4">
        {!hideTabs ? (
        <TabsList>
          <TabsTrigger value="shifts"><Timer className="size-4" />{t('shifts')}</TabsTrigger>
          <TabsTrigger value="work-schedules"><CalendarDays className="size-4" />{t('workSchedules')}</TabsTrigger>
          <TabsTrigger value="assignments"><UserRoundCog className="size-4" />{t('employeeScheduleAssignments')}</TabsTrigger>
        </TabsList>
        ) : null}

        <TabsContent value="shifts" className="space-y-4">
          <div className="flex w-full justify-end">
            <Button onClick={openCreateShift} className="w-full lg:w-auto">
              <Plus className="size-4" />
              {t('addShift')}
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="rounded-lg">
            <CardContent className="space-y-3 pt-6">
              {shiftsLoading ? (
                <p className="text-sm text-muted-foreground">{common('loading')}</p>
              ) : shifts.length === 0 ? (
                <EmptyState icon={Timer} title={t('noShifts')} description={t('noShiftsDescription')} />
              ) : shifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex w-full items-start justify-between gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-accent data-[active=true]:border-primary data-[active=true]:bg-primary/5"
                  data-active={selectedShiftId === shift.id}
                >
                  <button type="button" onClick={() => setSelectedShiftId(shift.id)} className="min-w-0 flex-1 text-left">
                    <span className="block font-medium">{shift.nameEn}</span>
                    <span className="block text-xs text-muted-foreground">
                      {shift.gracePeriodMinutes} {t('gracePeriodMinutes').toLowerCase()}
                    </span>
                  </button>
                  <span className="flex items-center gap-2">
                    <Badge variant={shift.isActive ? 'default' : 'secondary'}>{shift.isActive ? t('active') : t('inactive')}</Badge>
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEditShift(shift)}>
                      <Pencil className="size-4" />
                    </Button>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div>
            <Card className="rounded-lg">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{t('shiftSegments')}</CardTitle>
                  <CardDescription>{selectedShift ? selectedShift.nameEn : t('selectShiftForSegments')}</CardDescription>
                </div>
                <Button size="sm" onClick={openCreateShiftSegment} disabled={!selectedShiftId}><Plus className="size-4" />{t('addSegment')}</Button>
              </CardHeader>
              <CardContent className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
                {!selectedShiftId ? (
                  <EmptyState icon={Timer} title={t('selectShift')} description={t('selectShiftForSegments')} />
                ) : shiftSegmentsLoading ? (
                  <p className="text-sm text-muted-foreground">{common('loading')}</p>
                ) : shiftSegments.length === 0 ? (
                  <EmptyState icon={Timer} title={t('noShiftSegments')} description={t('noShiftSegmentsDescription')} />
                ) : shiftSegments.map((segment) => (
                  <div key={segment.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{segment.nameEn}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(segment.startTime)} - {formatTime(segment.endTime)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">#{segment.sortOrder}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEditShiftSegment(segment)}><Pencil className="size-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
          </div>
        </TabsContent>

        <TabsContent value="work-schedules" className="space-y-4">
          <div className="flex w-full justify-end">
            <Button onClick={openCreateWorkSchedule} className="w-full lg:w-auto">
              <Plus className="size-4" />
              {t('addWorkSchedule')}
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="rounded-lg">
            <CardContent className="space-y-3 pt-6">
              {workSchedulesLoading ? (
                <p className="text-sm text-muted-foreground">{common('loading')}</p>
              ) : workSchedules.length === 0 ? (
                <EmptyState icon={CalendarDays} title={t('noWorkSchedules')} description={t('noWorkSchedulesDescription')} />
              ) : workSchedules.map((workSchedule) => (
                <div
                  key={workSchedule.id}
                  className="flex w-full items-start justify-between gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-accent data-[active=true]:border-primary data-[active=true]:bg-primary/5"
                  data-active={selectedWorkScheduleId === workSchedule.id}
                >
                  <button type="button" onClick={() => setSelectedWorkScheduleId(workSchedule.id)} className="min-w-0 flex-1 text-left">
                    <span className="block font-medium">{workSchedule.nameEn}</span>
                    <span className="line-clamp-1 text-xs text-muted-foreground">{workSchedule.description || t('noDescription')}</span>
                  </button>
                  <span className="flex items-center gap-2">
                    {workSchedule.isDefault ? <Badge>{t('default')}</Badge> : null}
                    <Button type="button" variant="ghost" size="icon" onClick={() => openEditWorkSchedule(workSchedule)}>
                      <Pencil className="size-4" />
                    </Button>
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{t('workScheduleDays')}</CardTitle>
                <CardDescription>{selectedWorkSchedule ? selectedWorkSchedule.nameEn : t('selectWorkScheduleForDays')}</CardDescription>
              </div>
              <Button size="sm" onClick={openCreateWorkScheduleDay} disabled={!selectedWorkScheduleId}><Plus className="size-4" />{t('addDay')}</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selectedWorkScheduleId ? (
                <EmptyState icon={CalendarDays} title={t('selectWorkSchedule')} description={t('selectWorkScheduleForDays')} />
              ) : workScheduleDaysLoading ? (
                <p className="text-sm text-muted-foreground">{common('loading')}</p>
              ) : workScheduleDays.length === 0 ? (
                <EmptyState icon={CalendarDays} title={t('noWorkScheduleDays')} description={t('noWorkScheduleDaysDescription')} />
              ) : workScheduleDays.map((day) => {
                const shift = shifts.find((item) => item.id === day.shiftId);
                return (
                  <div key={day.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{t(`day${day.dayOfWeek}`)}</p>
                      <p className="text-xs text-muted-foreground">{day.isOffDay ? t('offDay') : shift?.nameEn ?? t('noShift')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={day.isActive ? 'default' : 'secondary'}>{day.isActive ? t('active') : t('inactive')}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEditWorkScheduleDay(day)}><Pencil className="size-4" /></Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="assignments" className="space-y-4">
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-1 flex-wrap items-end gap-2">
              <Field label={t('employeeSearch')} id="assignment-search">
                <Input
                  id="assignment-search"
                  value={assignmentSearch}
                  onChange={(event) => setAssignmentSearch(event.target.value)}
                  placeholder={t('searchEmployees')}
                  className="min-w-64 md:max-w-sm"
                />
              </Field>
              <Field label={t('department')} id="assignment-department">
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger id="assignment-department" className="w-full sm:w-64">
                    <SelectValue placeholder={t('selectDepartment')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allDepartmentsValue}>{t('allDepartments')}</SelectItem>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>{department.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Button onClick={openAssignmentDialog} disabled={selectedEmployeeIds.size === 0}>
              <Plus className="size-4" />
              {t('assignWorkSchedule')}
              {selectedEmployeeIds.size > 0 ? ` (${selectedEmployeeIds.size})` : ''}
            </Button>
          </div>

          <Card className="rounded-lg">
            <CardContent className="p-0">
              {employeesLoading || allEmployeeWorkSchedulesLoading ? (
                <p className="p-6 text-sm text-muted-foreground">{common('loading')}</p>
              ) : filteredEmployees.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={UserRoundCog}
                    title={employees.length === 0 ? t('noEmployees') : t('noMatchingEmployees')}
                    description={employees.length === 0 ? t('noEmployeesDescription') : t('noMatchingEmployeesDescription')}
                  />
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  <div className="overflow-x-auto rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allFilteredSelected ? true : selectedFilteredCount > 0 ? 'indeterminate' : false}
                              onCheckedChange={(checked) => toggleFilteredSelection(checked === true)}
                              aria-label={t('selectAll')}
                            />
                          </TableHead>
                          <TableHead>{t('employee')}</TableHead>
                          <TableHead>{t('department')}</TableHead>
                          <TableHead>{t('position')}</TableHead>
                          <TableHead>{t('workSchedule')}</TableHead>
                          <TableHead>{t('effectiveFrom')}</TableHead>
                          <TableHead>{t('effectiveTo')}</TableHead>
                          <TableHead>{t('status')}</TableHead>
                          <TableHead className="text-right">{t('actions')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedEmployees.map((employee) => {
                          const assignment = assignmentByEmployeeId.get(employee.id) ?? null;
                          const employeeName = `${employee.firstNameEn} ${employee.middleNameEn ?? ''} ${employee.lastNameEn}`.replace(/\s+/g, ' ').trim();

                          return (
                            <TableRow key={employee.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedEmployeeIds.has(employee.id)}
                                  onCheckedChange={(checked) => toggleEmployeeSelection(employee.id, checked === true)}
                                  aria-label={employeeName}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="min-w-48">
                                  <p className="font-medium text-foreground">{employeeName}</p>
                                  <p className="text-xs text-muted-foreground">{employee.employeeCode}</p>
                                </div>
                              </TableCell>
                              <TableCell>{employee.department?.nameEn ?? employee.sourceDepartmentName ?? '-'}</TableCell>
                              <TableCell>{employee.position?.nameEn ?? employee.positionName ?? employee.sourcePositionName ?? '-'}</TableCell>
                              <TableCell className="font-medium">{assignment?.workSchedule?.nameEn ?? '-'}</TableCell>
                              <TableCell className="whitespace-nowrap">{assignment ? formatDate(assignment.effectiveFrom) : '-'}</TableCell>
                              <TableCell className="whitespace-nowrap">{assignment ? (assignment.effectiveTo ? formatDate(assignment.effectiveTo) : t('openEnded')) : '-'}</TableCell>
                              <TableCell>
                                {assignment ? (
                                  <Badge variant={assignment.isActive ? 'default' : 'secondary'}>
                                    {assignment.isActive ? t('active') : t('inactive')}
                                  </Badge>
                                ) : (
                                  <span className="text-sm text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-end gap-1">
                                  <Button type="button" variant="ghost" size="icon" disabled={!assignment} onClick={() => assignment && openEditEmployeeWorkSchedule(assignment)}>
                                    <Pencil className="size-4" />
                                  </Button>
                                  <Button type="button" variant="ghost" size="icon" disabled={!assignment || deleteEmployeeWorkSchedule.isPending} onClick={() => assignment && removeEmployeeWorkSchedule(assignment)}>
                                    <Trash2 className="size-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-muted-foreground">
                      {assignmentTotal === 0
                        ? t('noEmployees')
                        : `Showing ${assignmentStartIndex + 1}-${Math.min(assignmentStartIndex + assignmentPageSize, assignmentTotal)} of ${assignmentTotal}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <Select value={String(assignmentPageSize)} onValueChange={(value) => setAssignmentPageSize(Number(value))}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[25, 50, 100].map((size) => (
                            <SelectItem key={size} value={String(size)}>{size}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" onClick={() => setAssignmentPage((current) => Math.max(1, current - 1))} disabled={assignmentCurrentPage <= 1}>
                        {common('previous')}
                      </Button>
                      <span className="min-w-20 text-center text-sm text-muted-foreground">
                        {assignmentCurrentPage} / {assignmentTotalPages}
                      </span>
                      <Button type="button" variant="outline" onClick={() => setAssignmentPage((current) => Math.min(assignmentTotalPages, current + 1))} disabled={assignmentCurrentPage >= assignmentTotalPages}>
                        {common('next')}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog
        open={assignmentDialogOpen}
        onOpenChange={(open) => {
          setAssignmentDialogOpen(open);
          if (!open) setEditingEmployeeWorkSchedule(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEmployeeWorkSchedule ? t('editWorkScheduleAssignment') : t('assignWorkSchedule')}</DialogTitle>
            <DialogDescription>
              {editingEmployeeWorkSchedule
                ? t('assignWorkScheduleDescription')
                : t('selectedEmployeesPreview', { count: selectedEmployeeIds.size })}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-5" onSubmit={saveEmployeeWorkSchedule}>
            <div className="grid gap-4">
              {editingEmployeeWorkSchedule ? (
                <Field label={t('employee')} id="assignment-employee">
                  <Input
                    id="assignment-employee"
                    value={editingAssignmentEmployee
                      ? `${editingAssignmentEmployee.firstNameEn} ${editingAssignmentEmployee.middleNameEn ?? ''} ${editingAssignmentEmployee.lastNameEn}`.replace(/\s+/g, ' ').trim()
                      : editingEmployeeWorkSchedule.employeeId}
                    disabled
                  />
                </Field>
              ) : null}

              <Field label={t('workSchedule')} id="assignment-work-schedule">
                <Select
                  value={employeeWorkScheduleForm.workScheduleId}
                  onValueChange={(value) => setEmployeeWorkScheduleForm((current) => ({ ...current, workScheduleId: value }))}
                  disabled={workSchedulesLoading}
                >
                  <SelectTrigger id="assignment-work-schedule" className="w-full"><SelectValue placeholder={t('selectWorkSchedule')} /></SelectTrigger>
                  <SelectContent>
                    {workSchedules.map((workSchedule) => (
                      <SelectItem key={workSchedule.id} value={workSchedule.id}>{workSchedule.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label={t('effectiveFrom')} id="assignment-effective-from">
                <CalendarDateField
                  id="assignment-effective-from"
                  value={employeeWorkScheduleForm.effectiveFrom}
                  onChange={(effectiveFrom) => setEmployeeWorkScheduleForm((current) => ({ ...current, effectiveFrom }))}
                  required
                />
              </Field>

              <Field label={t('effectiveTo')} id="assignment-effective-to">
                <CalendarDateField
                  id="assignment-effective-to"
                  value={employeeWorkScheduleForm.effectiveTo}
                  onChange={(effectiveTo) => setEmployeeWorkScheduleForm((current) => ({ ...current, effectiveTo }))}
                />
              </Field>
            </div>

            <SwitchRow label={t('active')} checked={employeeWorkScheduleForm.isActive} onCheckedChange={(checked) => setEmployeeWorkScheduleForm((current) => ({ ...current, isActive: checked }))} />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAssignmentDialogOpen(false)}>{common('cancel')}</Button>
              <Button
                type="submit"
                disabled={
                  employeeWorkScheduleSaving ||
                  !employeeWorkScheduleForm.workScheduleId ||
                  !employeeWorkScheduleForm.effectiveFrom ||
                  (!editingEmployeeWorkSchedule && selectedEmployeeIds.size === 0)
                }
              >
                {employeeWorkScheduleSaving
                  ? t('saving')
                  : editingEmployeeWorkSchedule
                    ? common('save')
                    : t('assignWorkSchedule')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingShift ? t('editShift') : t('addShift')}</DialogTitle>
            <DialogDescription>{t('shiftFormDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveShift}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('nameEn')} id="shift-name-en"><Input id="shift-name-en" value={shiftForm.nameEn} onChange={(event) => setShiftForm((current) => ({ ...current, nameEn: event.target.value }))} required /></Field>
              <Field label={t('nameAm')} id="shift-name-am"><Input id="shift-name-am" value={shiftForm.nameAm} onChange={(event) => setShiftForm((current) => ({ ...current, nameAm: event.target.value }))} /></Field>
              <Field label={t('gracePeriodMinutes')} id="shift-grace"><Input id="shift-grace" name="gracePeriodMinutes" type="number" min={0} value={shiftForm.gracePeriodMinutes} onChange={(event) => setShiftForm((current) => ({ ...current, gracePeriodMinutes: Number(event.target.value) }))} /></Field>
              <Field label={t('lateAfterMinutes')} id="shift-late"><Input id="shift-late" name="lateAfterMinutes" type="number" min={0} value={shiftForm.lateAfterMinutes} onChange={(event) => setShiftForm((current) => ({ ...current, lateAfterMinutes: Number(event.target.value) }))} /></Field>
              <Field label={t('earlyOutBeforeMinutes')} id="shift-early"><Input id="shift-early" name="earlyOutBeforeMinutes" type="number" min={0} value={shiftForm.earlyOutBeforeMinutes} onChange={(event) => setShiftForm((current) => ({ ...current, earlyOutBeforeMinutes: Number(event.target.value) }))} /></Field>
            </div>
            <SwitchRow label={t('overnightShift')} checked={shiftForm.isOvernight} onCheckedChange={(checked) => setShiftForm((current) => ({ ...current, isOvernight: checked }))} />
            <SwitchRow label={t('active')} checked={shiftForm.isActive} onCheckedChange={(checked) => setShiftForm((current) => ({ ...current, isActive: checked }))} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShiftDialogOpen(false)}>{common('cancel')}</Button><Button type="submit" disabled={shiftSaving || !shiftForm.nameEn.trim()}>{shiftSaving ? t('saving') : common('save')}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={shiftSegmentDialogOpen} onOpenChange={setShiftSegmentDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingShiftSegment ? t('editSegment') : t('addSegment')}</DialogTitle><DialogDescription>{t('shiftSegmentFormDescription')}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={saveShiftSegment}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('nameEn')} id="segment-name-en"><Input id="segment-name-en" value={shiftSegmentForm.nameEn} onChange={(event) => setShiftSegmentForm((current) => ({ ...current, nameEn: event.target.value }))} required /></Field>
              <Field label={t('nameAm')} id="segment-name-am"><Input id="segment-name-am" value={shiftSegmentForm.nameAm} onChange={(event) => setShiftSegmentForm((current) => ({ ...current, nameAm: event.target.value }))} /></Field>
              <Field label={t('startTime')} id="segment-start"><Input id="segment-start" type="time" value={shiftSegmentForm.startTime} onChange={(event) => setShiftSegmentForm((current) => ({ ...current, startTime: event.target.value }))} required /></Field>
              <Field label={t('endTime')} id="segment-end"><Input id="segment-end" type="time" value={shiftSegmentForm.endTime} onChange={(event) => setShiftSegmentForm((current) => ({ ...current, endTime: event.target.value }))} required /></Field>
              <Field label={t('sortOrder')} id="segment-sort-order"><Input id="segment-sort-order" name="sortOrder" type="number" min={1} value={shiftSegmentForm.sortOrder} onChange={(event) => setShiftSegmentForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))} /></Field>
            </div>
            <SwitchRow label={t('active')} checked={shiftSegmentForm.isActive} onCheckedChange={(checked) => setShiftSegmentForm((current) => ({ ...current, isActive: checked }))} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShiftSegmentDialogOpen(false)}>{common('cancel')}</Button><Button type="submit" disabled={shiftSegmentSaving || !shiftSegmentForm.nameEn.trim()}>{shiftSegmentSaving ? t('saving') : common('save')}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={workScheduleDialogOpen} onOpenChange={setWorkScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingWorkSchedule ? t('editWorkSchedule') : t('addWorkSchedule')}</DialogTitle><DialogDescription>{t('workScheduleFormDescription')}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={saveWorkSchedule}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('nameEn')} id="schedule-name-en"><Input id="schedule-name-en" value={workScheduleForm.nameEn} onChange={(event) => setWorkScheduleForm((current) => ({ ...current, nameEn: event.target.value }))} required /></Field>
              <Field label={t('nameAm')} id="schedule-name-am"><Input id="schedule-name-am" value={workScheduleForm.nameAm} onChange={(event) => setWorkScheduleForm((current) => ({ ...current, nameAm: event.target.value }))} /></Field>
            </div>
            <Field label={t('description')} id="schedule-description"><Textarea id="schedule-description" value={workScheduleForm.description} onChange={(event) => setWorkScheduleForm((current) => ({ ...current, description: event.target.value }))} /></Field>
            <SwitchRow label={t('defaultSchedule')} checked={workScheduleForm.isDefault} onCheckedChange={(checked) => setWorkScheduleForm((current) => ({ ...current, isDefault: checked }))} />
            <SwitchRow label={t('active')} checked={workScheduleForm.isActive} onCheckedChange={(checked) => setWorkScheduleForm((current) => ({ ...current, isActive: checked }))} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setWorkScheduleDialogOpen(false)}>{common('cancel')}</Button><Button type="submit" disabled={workScheduleSaving || !workScheduleForm.nameEn.trim()}>{workScheduleSaving ? t('saving') : common('save')}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={workScheduleDayDialogOpen} onOpenChange={setWorkScheduleDayDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingWorkScheduleDay ? t('editDay') : t('addDay')}</DialogTitle><DialogDescription>{t('workScheduleDayFormDescription')}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={saveWorkScheduleDay}>
            <Field label={t('dayOfWeek')} id="schedule-day">
              <Select value={workScheduleDayForm.dayOfWeek} onValueChange={(value) => setWorkScheduleDayForm((current) => ({ ...current, dayOfWeek: value as DayOfWeek }))}>
                <SelectTrigger id="schedule-day" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{dayOptions.map((day) => <SelectItem key={day} value={day}>{t(`day${day}`)}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label={t('shift')} id="schedule-day-shift">
              <Select value={workScheduleDayForm.shiftId} onValueChange={(value) => setWorkScheduleDayForm((current) => ({ ...current, shiftId: value }))} disabled={workScheduleDayForm.isOffDay}>
                <SelectTrigger id="schedule-day-shift" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t('noShift')}</SelectItem>
                  {shifts.map((shift) => <SelectItem key={shift.id} value={shift.id}>{shift.nameEn}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <SwitchRow label={t('offDay')} checked={workScheduleDayForm.isOffDay} onCheckedChange={(checked) => setWorkScheduleDayForm((current) => ({ ...current, isOffDay: checked, shiftId: checked ? 'none' : current.shiftId }))} />
            <SwitchRow label={t('active')} checked={workScheduleDayForm.isActive} onCheckedChange={(checked) => setWorkScheduleDayForm((current) => ({ ...current, isActive: checked }))} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setWorkScheduleDayDialogOpen(false)}>{common('cancel')}</Button><Button type="submit" disabled={workScheduleDaySaving}>{workScheduleDaySaving ? t('saving') : common('save')}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
