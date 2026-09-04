'use client';

import { FormEvent, useState } from 'react';
import { BriefcaseBusiness, Pencil, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import {
  useCreatePosition,
  usePositions,
  useUpdatePosition,
} from '@/data/hooks/core.hooks';
import type { Position } from '@/data/types/core.types';
import { notifications } from '@/lib/notifications';

const positionInitialForm = {
  nameEn: '',
  nameAm: '',
  code: '',
  isActive: true,
};

export default function PositionsPage() {
  const t = useTranslations('core');
  const common = useTranslations('common');
  const { data: positionsResponse, isLoading } = usePositions();
  const createPosition = useCreatePosition();
  const updatePosition = useUpdatePosition();

  const positions = positionsResponse?.positions ?? [];
  const [positionDialogOpen, setPositionDialogOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [positionForm, setPositionForm] = useState(positionInitialForm);

  const openCreatePosition = () => {
    setEditingPosition(null);
    setPositionForm(positionInitialForm);
    setPositionDialogOpen(true);
  };

  const openEditPosition = (position: Position) => {
    setEditingPosition(position);
    setPositionForm({
      nameEn: position.nameEn,
      nameAm: position.nameAm ?? '',
      code: position.code ?? '',
      isActive: position.isActive,
    });
    setPositionDialogOpen(true);
  };

  const savePosition = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const payload = {
        nameEn: positionForm.nameEn.trim(),
        nameAm: positionForm.nameAm.trim() || null,
        code: positionForm.code.trim() || null,
        isActive: positionForm.isActive,
      };

      if (editingPosition) {
        await updatePosition.mutateAsync({ positionId: editingPosition.id, ...payload });
      } else {
        await createPosition.mutateAsync(payload);
      }

      setPositionDialogOpen(false);
      notifications.show({
        title: common('success'),
        message: editingPosition ? t('positionUpdated') : t('positionCreated'),
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
    <div className="flex w-full flex-col gap-6">
      <div className="flex w-full justify-end">
        <Button onClick={openCreatePosition} className="w-full lg:w-auto">
          <Plus className="size-4" />
          {t('addPosition')}
        </Button>
      </div>

      <Card className="rounded-lg">
        <CardContent className="space-y-3">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">{t('loadingOrganization')}</p>
          ) : positions.length === 0 ? (
            <EmptyState
              icon={BriefcaseBusiness}
              title={t('noPositions')}
              description={t('noPositionsDescription')}
            />
          ) : (
            positions.map((position) => (
              <div
                key={position.id}
                className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{position.nameEn}</p>
                  <p className="text-xs text-muted-foreground">
                    {position.code || t('noCode')} {position.nameAm ? `- ${position.nameAm}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={position.isActive ? 'default' : 'secondary'}>
                    {position.isActive ? t('active') : t('inactive')}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEditPosition(position)}>
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={positionDialogOpen} onOpenChange={setPositionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPosition ? t('editPosition') : t('addPosition')}</DialogTitle>
            <DialogDescription>{t('positionFormDescription')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={savePosition}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="position-name-en">{t('nameEn')}</Label>
                <Input
                  id="position-name-en"
                  value={positionForm.nameEn}
                  onChange={(event) => setPositionForm((current) => ({ ...current, nameEn: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position-name-am">{t('nameAm')}</Label>
                <Input
                  id="position-name-am"
                  value={positionForm.nameAm}
                  onChange={(event) => setPositionForm((current) => ({ ...current, nameAm: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="position-code">{t('code')}</Label>
              <Input
                id="position-code"
                value={positionForm.code}
                onChange={(event) => setPositionForm((current) => ({ ...current, code: event.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border border-border p-3">
              <Label>{t('active')}</Label>
              <Switch
                checked={positionForm.isActive}
                onCheckedChange={(checked) => setPositionForm((current) => ({ ...current, isActive: checked }))}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPositionDialogOpen(false)}>
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={createPosition.isPending || updatePosition.isPending || !positionForm.nameEn.trim()}>
                {createPosition.isPending || updatePosition.isPending ? t('saving') : common('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
