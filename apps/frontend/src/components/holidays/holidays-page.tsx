'use client';

import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { CalendarDays, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useCreateHoliday, useHolidays, useUpdateHoliday } from '@/data/hooks/core.hooks';
import type { Holiday, HolidayType } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

type HolidayForm = {
  nameEn: string;
  nameAm: string;
  type: HolidayType;
  durationDays: '1.00' | '0.50';
  startDate: string;
  endDate: string;
  description: string;
  isActive: boolean;
};

const initialForm: HolidayForm = {
  nameEn: '',
  nameAm: '',
  type: 'PUBLIC_HOLIDAY',
  durationDays: '1.00',
  startDate: '',
  endDate: '',
  description: '',
  isActive: true,
};

export default function HolidaysPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const holidaysQuery = useHolidays();
  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();

  const holidays = holidaysQuery.data?.holidays ?? [];
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | HolidayType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [form, setForm] = useState<HolidayForm>(initialForm);

  const filteredHolidays = useMemo(() => {
    const query = search.trim().toLowerCase();

    return holidays.filter((holiday) => {
      const matchesType = typeFilter === 'all' || holiday.type === typeFilter;
      const matchesStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'active'
          ? holiday.isActive
          : !holiday.isActive;
      const matchesSearch = query
        ? [
            holiday.nameEn,
            holiday.nameAm,
            holiday.description,
            holiday.durationDays,
            holiday.startDate,
            holiday.endDate,
          ].filter(Boolean).join(' ').toLowerCase().includes(query)
        : true;

      return matchesType && matchesStatus && matchesSearch;
    });
  }, [holidays, search, statusFilter, typeFilter]);

  const openCreateDialog = () => {
    setEditingHoliday(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEditDialog = (holiday: Holiday) => {
    setEditingHoliday(holiday);
    setForm({
      nameEn: holiday.nameEn,
      nameAm: holiday.nameAm ?? '',
      type: holiday.type,
      durationDays: holiday.durationDays === '0.50' ? '0.50' : '1.00',
      startDate: holiday.startDate,
      endDate: holiday.endDate,
      description: holiday.description ?? '',
      isActive: holiday.isActive,
    });
    setDialogOpen(true);
  };

  const saveHoliday = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = {
        nameEn: form.nameEn.trim(),
        nameAm: form.nameAm.trim() || null,
        type: form.type,
        durationDays: form.durationDays,
        startDate: form.startDate,
        endDate: form.endDate,
        description: form.description.trim() || null,
        isActive: form.isActive,
      };

      if (editingHoliday) {
        await updateHoliday.mutateAsync({ holidayId: editingHoliday.id, ...payload });
      } else {
        await createHoliday.mutateAsync(payload);
      }

      setDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: editingHoliday ? t('holidayUpdated') : t('holidayCreated'),
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

  const isSaving = createHoliday.isPending || updateHoliday.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('searchHolidays')}
            className="w-full md:max-w-sm"
          />
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as 'all' | HolidayType)}>
            <SelectTrigger className="w-full md:w-56">
              <SelectValue placeholder={t('holidayType')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allTypes')}</SelectItem>
              <SelectItem value="PUBLIC_HOLIDAY">{t('publicHoliday')}</SelectItem>
              <SelectItem value="INSTITUTION_OFF_DAY">{t('institutionOffDay')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="w-full md:w-40">
              <SelectValue placeholder={t('status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('allStatuses')}</SelectItem>
              <SelectItem value="active">{t('active')}</SelectItem>
              <SelectItem value="inactive">{t('inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreateDialog} className="w-full lg:w-auto">
          <Plus className="size-4" />
          {t('addHoliday')}
        </Button>
      </div>

      {holidaysQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">{common('loading')}</p>
      ) : filteredHolidays.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={t('noHolidays')}
          description={t('noHolidaysDescription')}
          className="min-h-72"
        />
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('holidayName')}</TableHead>
                <TableHead>{t('holidayType')}</TableHead>
                <TableHead>{t('dayCoverage')}</TableHead>
                <TableHead>{t('dateRange')}</TableHead>
                <TableHead>{t('status')}</TableHead>
                <TableHead>{t('description')}</TableHead>
                <TableHead className="text-right">{t('actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHolidays.map((holiday) => (
                <TableRow key={holiday.id}>
                  <TableCell>
                    <div className="font-medium">{holiday.nameEn}</div>
                    {holiday.nameAm ? <div className="text-xs text-muted-foreground">{holiday.nameAm}</div> : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant={holiday.type === 'PUBLIC_HOLIDAY' ? 'default' : 'secondary'}>
                      {holiday.type === 'PUBLIC_HOLIDAY' ? t('publicHoliday') : t('institutionOffDay')}
                    </Badge>
                  </TableCell>
                  <TableCell>{holiday.durationDays === '0.50' ? t('halfDay') : t('fullDay')}</TableCell>
                  <TableCell>{holiday.startDate === holiday.endDate ? holiday.startDate : `${holiday.startDate} - ${holiday.endDate}`}</TableCell>
                  <TableCell>
                    <Badge variant={holiday.isActive ? 'default' : 'secondary'}>
                      {holiday.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate">{holiday.description ?? '-'}</TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(holiday)}>
                      <Pencil className="size-4" />
                      {common('edit')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingHoliday ? t('editHoliday') : t('addHoliday')}</DialogTitle>
            <DialogDescription>{t('holidaysDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveHoliday}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label={t('nameEn')} id="holiday-name-en">
                <Input
                  id="holiday-name-en"
                  value={form.nameEn}
                  onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))}
                  required
                />
              </Field>
              <Field label={t('nameAm')} id="holiday-name-am">
                <Input
                  id="holiday-name-am"
                  value={form.nameAm}
                  onChange={(event) => setForm((current) => ({ ...current, nameAm: event.target.value }))}
                />
              </Field>
              <Field label={t('holidayType')} id="holiday-type">
                <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value as HolidayType }))}>
                  <SelectTrigger id="holiday-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PUBLIC_HOLIDAY">{t('publicHoliday')}</SelectItem>
                    <SelectItem value="INSTITUTION_OFF_DAY">{t('institutionOffDay')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('dayCoverage')} id="holiday-duration">
                <Select value={form.durationDays} onValueChange={(value) => setForm((current) => ({ ...current, durationDays: value as '1.00' | '0.50' }))}>
                  <SelectTrigger id="holiday-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1.00">{t('fullDay')}</SelectItem>
                    <SelectItem value="0.50">{t('halfDay')}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                <Switch
                  id="holiday-active"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked === true }))}
                />
                <Label htmlFor="holiday-active" className="text-sm">{t('active')}</Label>
              </div>
              <Field label={t('startDate')} id="holiday-start-date">
                <Input
                  id="holiday-start-date"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))}
                  required
                />
              </Field>
              <Field label={t('endDate')} id="holiday-end-date">
                <Input
                  id="holiday-end-date"
                  type="date"
                  value={form.endDate}
                  onChange={(event) => setForm((current) => ({ ...current, endDate: event.target.value }))}
                  required
                />
              </Field>
            </div>
            <Field label={t('description')} id="holiday-description">
              <Textarea
                id="holiday-description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}
