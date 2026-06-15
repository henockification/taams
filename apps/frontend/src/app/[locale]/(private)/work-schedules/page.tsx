'use client';

import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { CalendarDays, Coffee, Pencil, Plus, Timer } from 'lucide-react';
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
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  useCreateShift,
  useCreateShiftBreak,
  useCreateShiftSegment,
  useCreateWorkSchedule,
  useCreateWorkScheduleDay,
  useShiftBreaks,
  useShiftSegments,
  useShifts,
  useUpdateShift,
  useUpdateShiftBreak,
  useUpdateShiftSegment,
  useUpdateWorkSchedule,
  useUpdateWorkScheduleDay,
  useWorkScheduleDays,
  useWorkSchedules,
} from '@/data/hooks/core.hooks';
import type { DayOfWeek, Shift, ShiftBreak, ShiftSegment, WorkSchedule, WorkScheduleDay } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

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

const shiftBreakInitialForm = {
  nameEn: '',
  nameAm: '',
  startTime: '12:00',
  endTime: '13:00',
  isPaid: false,
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

function toTimeInput(value: string) {
  return value.slice(0, 5);
}

function formatTime(value: string) {
  return toTimeInput(value);
}

function numberValue(value: FormDataEntryValue | null) {
  return Number(value ?? 0) || 0;
}

export default function WorkSchedulesPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { data: shiftsResponse, isLoading: shiftsLoading } = useShifts();
  const { data: workSchedulesResponse, isLoading: workSchedulesLoading } = useWorkSchedules();

  const shifts = shiftsResponse?.shifts ?? [];
  const workSchedules = workSchedulesResponse?.workSchedules ?? [];

  const [selectedShiftId, setSelectedShiftId] = useState('');
  const [selectedWorkScheduleId, setSelectedWorkScheduleId] = useState('');
  const selectedShift = shifts.find((shift) => shift.id === selectedShiftId);
  const selectedWorkSchedule = workSchedules.find((schedule) => schedule.id === selectedWorkScheduleId);

  const { data: shiftSegmentsResponse, isLoading: shiftSegmentsLoading } = useShiftSegments(selectedShiftId);
  const { data: shiftBreaksResponse, isLoading: shiftBreaksLoading } = useShiftBreaks(selectedShiftId);
  const { data: workScheduleDaysResponse, isLoading: workScheduleDaysLoading } = useWorkScheduleDays(selectedWorkScheduleId);
  const shiftSegments = shiftSegmentsResponse?.shiftSegments ?? [];
  const shiftBreaks = shiftBreaksResponse?.shiftBreaks ?? [];
  const workScheduleDays = workScheduleDaysResponse?.days ?? [];

  const createShift = useCreateShift();
  const updateShift = useUpdateShift();
  const createShiftSegment = useCreateShiftSegment();
  const updateShiftSegment = useUpdateShiftSegment();
  const createShiftBreak = useCreateShiftBreak();
  const updateShiftBreak = useUpdateShiftBreak();
  const createWorkSchedule = useCreateWorkSchedule();
  const updateWorkSchedule = useUpdateWorkSchedule();
  const createWorkScheduleDay = useCreateWorkScheduleDay();
  const updateWorkScheduleDay = useUpdateWorkScheduleDay();

  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [shiftSegmentDialogOpen, setShiftSegmentDialogOpen] = useState(false);
  const [shiftBreakDialogOpen, setShiftBreakDialogOpen] = useState(false);
  const [workScheduleDialogOpen, setWorkScheduleDialogOpen] = useState(false);
  const [workScheduleDayDialogOpen, setWorkScheduleDayDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editingShiftSegment, setEditingShiftSegment] = useState<ShiftSegment | null>(null);
  const [editingShiftBreak, setEditingShiftBreak] = useState<ShiftBreak | null>(null);
  const [editingWorkSchedule, setEditingWorkSchedule] = useState<WorkSchedule | null>(null);
  const [editingWorkScheduleDay, setEditingWorkScheduleDay] = useState<WorkScheduleDay | null>(null);
  const [shiftForm, setShiftForm] = useState(shiftInitialForm);
  const [shiftSegmentForm, setShiftSegmentForm] = useState(shiftSegmentInitialForm);
  const [shiftBreakForm, setShiftBreakForm] = useState(shiftBreakInitialForm);
  const [workScheduleForm, setWorkScheduleForm] = useState(workScheduleInitialForm);
  const [workScheduleDayForm, setWorkScheduleDayForm] = useState(workScheduleDayInitialForm);

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

  const openCreateShiftBreak = () => {
    setEditingShiftBreak(null);
    setShiftBreakForm(shiftBreakInitialForm);
    setShiftBreakDialogOpen(true);
  };

  const openEditShiftBreak = (shiftBreak: ShiftBreak) => {
    setEditingShiftBreak(shiftBreak);
    setShiftBreakForm({
      nameEn: shiftBreak.nameEn,
      nameAm: shiftBreak.nameAm ?? '',
      startTime: toTimeInput(shiftBreak.startTime),
      endTime: toTimeInput(shiftBreak.endTime),
      isPaid: shiftBreak.isPaid,
      isActive: shiftBreak.isActive,
    });
    setShiftBreakDialogOpen(true);
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

  const saveShiftBreak = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedShiftId) return;
    const payload = {
      shiftId: selectedShiftId,
      nameEn: shiftBreakForm.nameEn.trim(),
      nameAm: shiftBreakForm.nameAm.trim() || null,
      startTime: shiftBreakForm.startTime,
      endTime: shiftBreakForm.endTime,
      isPaid: shiftBreakForm.isPaid,
      isActive: shiftBreakForm.isActive,
    };

    try {
      if (editingShiftBreak) {
        await updateShiftBreak.mutateAsync({ shiftBreakId: editingShiftBreak.id, ...payload });
      } else {
        await createShiftBreak.mutateAsync(payload);
      }
      setShiftBreakDialogOpen(false);
      notifications.show({ title: common('success'), message: editingShiftBreak ? t('shiftBreakUpdated') : t('shiftBreakCreated'), color: 'green' });
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

  const shiftSaving = createShift.isPending || updateShift.isPending;
  const shiftSegmentSaving = createShiftSegment.isPending || updateShiftSegment.isPending;
  const shiftBreakSaving = createShiftBreak.isPending || updateShiftBreak.isPending;
  const workScheduleSaving = createWorkSchedule.isPending || updateWorkSchedule.isPending;
  const workScheduleDaySaving = createWorkScheduleDay.isPending || updateWorkScheduleDay.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">{t('workScheduleShiftEyebrow')}</p>
          <h1 className="text-2xl font-semibold tracking-normal">{t('workSchedulesAndShifts')}</h1>
          <p className="max-w-3xl text-sm text-muted-foreground">{t('workSchedulesAndShiftsDescription')}</p>
        </div>
      </div>

      <Tabs defaultValue="shifts" className="gap-4">
        <TabsList>
          <TabsTrigger value="shifts"><Timer className="size-4" />{t('shifts')}</TabsTrigger>
          <TabsTrigger value="work-schedules"><CalendarDays className="size-4" />{t('workSchedules')}</TabsTrigger>
        </TabsList>

        <TabsContent value="shifts" className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{t('shifts')}</CardTitle>
                <CardDescription>{t('shiftsDescription')}</CardDescription>
              </div>
              <Button size="sm" onClick={openCreateShift}><Plus className="size-4" />{t('addShift')}</Button>
            </CardHeader>
            <CardContent className="space-y-3">
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

          <div className="grid items-start gap-6 lg:grid-cols-2">
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

            <Card className="rounded-lg">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{t('shiftBreaks')}</CardTitle>
                  <CardDescription>{selectedShift ? selectedShift.nameEn : t('selectShiftForBreaks')}</CardDescription>
                </div>
                <Button size="sm" onClick={openCreateShiftBreak} disabled={!selectedShiftId}><Plus className="size-4" />{t('addBreak')}</Button>
              </CardHeader>
              <CardContent className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
                {!selectedShiftId ? (
                  <EmptyState icon={Coffee} title={t('selectShift')} description={t('selectShiftForBreaks')} />
                ) : shiftBreaksLoading ? (
                  <p className="text-sm text-muted-foreground">{common('loading')}</p>
                ) : shiftBreaks.length === 0 ? (
                  <EmptyState icon={Coffee} title={t('noShiftBreaks')} description={t('noShiftBreaksDescription')} />
                ) : shiftBreaks.map((shiftBreak) => (
                  <div key={shiftBreak.id} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                    <div className="min-w-0">
                      <p className="font-medium">{shiftBreak.nameEn}</p>
                      <p className="text-xs text-muted-foreground">{formatTime(shiftBreak.startTime)} - {formatTime(shiftBreak.endTime)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={shiftBreak.isPaid ? 'default' : 'secondary'}>{shiftBreak.isPaid ? t('paid') : t('unpaid')}</Badge>
                      <Button variant="ghost" size="icon" onClick={() => openEditShiftBreak(shiftBreak)}><Pencil className="size-4" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="work-schedules" className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card className="rounded-lg">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>{t('workSchedules')}</CardTitle>
                <CardDescription>{t('workSchedulesDescription')}</CardDescription>
              </div>
              <Button size="sm" onClick={openCreateWorkSchedule}><Plus className="size-4" />{t('addWorkSchedule')}</Button>
            </CardHeader>
            <CardContent className="space-y-3">
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
        </TabsContent>
      </Tabs>

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

      <Dialog open={shiftBreakDialogOpen} onOpenChange={setShiftBreakDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingShiftBreak ? t('editBreak') : t('addBreak')}</DialogTitle><DialogDescription>{t('shiftBreakFormDescription')}</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={saveShiftBreak}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('nameEn')} id="break-name-en"><Input id="break-name-en" value={shiftBreakForm.nameEn} onChange={(event) => setShiftBreakForm((current) => ({ ...current, nameEn: event.target.value }))} required /></Field>
              <Field label={t('nameAm')} id="break-name-am"><Input id="break-name-am" value={shiftBreakForm.nameAm} onChange={(event) => setShiftBreakForm((current) => ({ ...current, nameAm: event.target.value }))} /></Field>
              <Field label={t('startTime')} id="break-start"><Input id="break-start" type="time" value={shiftBreakForm.startTime} onChange={(event) => setShiftBreakForm((current) => ({ ...current, startTime: event.target.value }))} required /></Field>
              <Field label={t('endTime')} id="break-end"><Input id="break-end" type="time" value={shiftBreakForm.endTime} onChange={(event) => setShiftBreakForm((current) => ({ ...current, endTime: event.target.value }))} required /></Field>
            </div>
            <SwitchRow label={t('paidBreak')} checked={shiftBreakForm.isPaid} onCheckedChange={(checked) => setShiftBreakForm((current) => ({ ...current, isPaid: checked }))} />
            <SwitchRow label={t('active')} checked={shiftBreakForm.isActive} onCheckedChange={(checked) => setShiftBreakForm((current) => ({ ...current, isActive: checked }))} />
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShiftBreakDialogOpen(false)}>{common('cancel')}</Button><Button type="submit" disabled={shiftBreakSaving || !shiftBreakForm.nameEn.trim()}>{shiftBreakSaving ? t('saving') : common('save')}</Button></DialogFooter>
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
