'use client';

import { FormEvent, useState } from 'react';
import { IdCard, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateHrUnit, useHrUnits, useUpdateHrUnit } from '@/data/hooks/core.hooks';
import type { HrUnit } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

const initialForm = {
  nameEn: '',
  nameAm: '',
  code: '',
  isActive: true,
};

export default function HrUnitsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { data, isLoading } = useHrUnits();
  const createHrUnit = useCreateHrUnit();
  const updateHrUnit = useUpdateHrUnit();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingHrUnit, setEditingHrUnit] = useState<HrUnit | null>(null);
  const [form, setForm] = useState(initialForm);
  const hrUnits = data?.hrUnits ?? [];

  const openCreate = () => {
    setEditingHrUnit(null);
    setForm(initialForm);
    setDialogOpen(true);
  };

  const openEdit = (hrUnit: HrUnit) => {
    setEditingHrUnit(hrUnit);
    setForm({
      nameEn: hrUnit.nameEn,
      nameAm: hrUnit.nameAm ?? '',
      code: hrUnit.code ?? '',
      isActive: hrUnit.isActive,
    });
    setDialogOpen(true);
  };

  const saveHrUnit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = {
        nameEn: form.nameEn.trim(),
        nameAm: form.nameAm.trim() || null,
        code: form.code.trim() || null,
        isActive: form.isActive,
      };

      if (editingHrUnit) {
        await updateHrUnit.mutateAsync({ hrUnitId: editingHrUnit.id, ...payload });
      } else {
        await createHrUnit.mutateAsync(payload);
      }

      setDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: editingHrUnit ? t('hrUnitUpdated') : t('hrUnitCreated'),
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
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{t('hrUnits')}</h1>
          <p className="text-sm text-muted-foreground">{t('hrUnitsDescription')}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          {t('addHrUnit')}
        </Button>
      </div>

      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle>{t('hrUnits')}</CardTitle>
          <CardDescription>{t('hrUnitsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{common('loading')}</p>
          ) : hrUnits.length === 0 ? (
            <EmptyState icon={IdCard} title={t('noHrUnits')} description={t('noHrUnitsDescription')} className="min-h-72" />
          ) : (
            <div className="overflow-hidden rounded-md border border-border">
              <div className="grid grid-cols-[1fr_160px_120px_64px] gap-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-medium text-muted-foreground max-md:hidden">
                <span>{t('nameEn')}</span>
                <span>{t('code')}</span>
                <span>{t('status')}</span>
                <span className="text-right">{t('actions')}</span>
              </div>
              {hrUnits.map((hrUnit) => (
                <div key={hrUnit.id} className="grid gap-3 border-b border-border px-4 py-4 last:border-0 md:grid-cols-[1fr_160px_120px_64px]">
                  <div>
                    <p className="font-medium">{hrUnit.nameEn}</p>
                    <p className="text-xs text-muted-foreground">{hrUnit.nameAm || '-'}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{hrUnit.code || '-'}</p>
                  <div>
                    <Badge variant={hrUnit.isActive ? 'default' : 'secondary'}>
                      {hrUnit.isActive ? t('active') : t('inactive')}
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(hrUnit)}>
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingHrUnit ? t('editHrUnit') : t('addHrUnit')}</DialogTitle>
            <DialogDescription>{t('hrUnitFormDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={saveHrUnit}>
            <div className="space-y-2">
              <Label>{t('nameEn')}</Label>
              <Input value={form.nameEn} onChange={(event) => setForm((current) => ({ ...current, nameEn: event.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>{t('nameAm')}</Label>
              <Input value={form.nameAm} onChange={(event) => setForm((current) => ({ ...current, nameAm: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>{t('code')}</Label>
              <Input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>{t('active')}</Label>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>{common('cancel')}</Button>
              <Button type="submit" disabled={createHrUnit.isPending || updateHrUnit.isPending || !form.nameEn.trim()}>
                {createHrUnit.isPending || updateHrUnit.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
