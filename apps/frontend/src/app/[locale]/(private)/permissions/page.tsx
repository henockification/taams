'use client';

import { FormEvent, useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { permissionActions, permissionResourceOptions } from '@/config/app-navigation';
import { notifications } from '@/lib/notifications';
import {
  useCreatePermission,
  usePermissions,
  useUpdatePermission,
} from '@/data/hooks/rbac.hooks';
import type { Permission } from '@/data/types/rbac.types';

const initialForm = {
  name: '',
  resource: '',
  action: '',
  description: '',
};

export default function PermissionsPage() {
  const t = useTranslations('rbac');
  const navigation = useTranslations('navigation');
  const common = useTranslations('common');
  const { data: permissionsResponse, isLoading } = usePermissions();
  const createPermission = useCreatePermission();
  const updatePermission = useUpdatePermission();
  const [form, setForm] = useState(initialForm);
  const [selectedResourceOptionUrl, setSelectedResourceOptionUrl] = useState('');
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [editingPermission, setEditingPermission] = useState<Permission | null>(null);

  const permissions = permissionsResponse?.permissions ?? [];

  const permissionGroups = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      groups[permission.resource] = groups[permission.resource] ?? [];
      groups[permission.resource].push(permission);
      return groups;
    }, {});
  }, [permissions]);

  const actionLabels: Record<(typeof permissionActions)[number], string> = {
    read: t('permissionActionRead'),
    add: t('permissionActionAdd'),
    edit: t('permissionActionEdit'),
    approve: t('permissionActionApprove'),
    reject: t('permissionActionReject'),
    push: t('permissionActionPush'),
  };

  const getResourceLabel = (resource: string) => {
    const resourceOption = permissionResourceOptions.find(
      (option) => option.permissionResource === resource
    );

    return resourceOption ? navigation(resourceOption.titleKey) : resource;
  };

  const isKnownAction = (action: string): action is (typeof permissionActions)[number] =>
    permissionActions.includes(action as (typeof permissionActions)[number]);

  const getPermissionName = (resource: string, action: string) =>
    resource && action ? `${resource}:${action}` : '';

  const handleOpenCreatePermission = () => {
    setEditingPermission(null);
    setForm(initialForm);
    setSelectedResourceOptionUrl('');
    setPermissionDialogOpen(true);
  };

  const handleOpenUpdatePermission = (permission: Permission) => {
    const resourceOption = permissionResourceOptions.find(
      (option) => option.permissionResource === permission.resource
    );
    const resource = resourceOption ? permission.resource : '';
    const action = isKnownAction(permission.action) ? permission.action : '';

    setEditingPermission(permission);
    setSelectedResourceOptionUrl(resourceOption?.url ?? '');
    setForm({
      name: getPermissionName(resource, action) || permission.name,
      resource,
      action,
      description: permission.description ?? '',
    });
    setPermissionDialogOpen(true);
  };

  const handleSavePermission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const name = getPermissionName(form.resource.trim(), form.action.trim());

      if (editingPermission) {
        await updatePermission.mutateAsync({
          permissionId: editingPermission.id,
          name,
          resource: form.resource.trim(),
          action: form.action.trim(),
          description: form.description.trim() || null,
        });
        notifications.show({
          title: common('success'),
          message: t('permissionUpdated'),
          color: 'green',
        });
      } else {
        await createPermission.mutateAsync({
          name,
          resource: form.resource.trim(),
          action: form.action.trim(),
          description: form.description.trim() || undefined,
        });
        notifications.show({
          title: common('success'),
          message: t('permissionCreated'),
          color: 'green',
        });
      }

      setForm(initialForm);
      setSelectedResourceOptionUrl('');
      setEditingPermission(null);
      setPermissionDialogOpen(false);
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  const updateForm = (field: keyof typeof form, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === 'resource' || field === 'action') {
        next.name = getPermissionName(next.resource, next.action);
      }

      return next;
    });
  };

  const handleResourceChange = (value: string) => {
    const selectedOption = permissionResourceOptions.find((option) => option.url === value);
    setSelectedResourceOptionUrl(value);
    updateForm('resource', selectedOption?.permissionResource ?? '');
  };

  const isSavingPermission = createPermission.isPending || updatePermission.isPending;
  const canSavePermission =
    form.resource.trim() &&
    form.action.trim() &&
    isKnownAction(form.action) &&
    getPermissionName(form.resource.trim(), form.action.trim());

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={handleOpenCreatePermission}>
          <Plus className="size-4" />
          {t('addPermission')}
        </Button>
        <Badge variant="outline" className="gap-2 rounded-md px-3 py-1.5">
          <KeyRound className="size-3.5 text-primary" />
          {permissions.length} {t('permissionsCount')}
        </Badge>
      </div>

      <Card className="rounded-lg">
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
            <CardTitle>{t('permissionsCatalog')}</CardTitle>
            <CardDescription>{t('permissionsCatalogDescription')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenCreatePermission}>
              <Plus className="size-4" />
              {t('addPermission')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('loadingSecurity')}</p>
            ) : Object.entries(permissionGroups).length === 0 ? (
              <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed border-border">
                <p className="text-sm text-muted-foreground">{t('noPermissions')}</p>
              </div>
            ) : (
              Object.entries(permissionGroups).map(([resource, group]) => (
                <div key={resource} className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      {getResourceLabel(resource)}
                    </h2>
                    <Separator className="flex-1" />
                    <Badge variant="outline">{group.length}</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {group.map((permission) => (
                      <div
                        key={permission.id}
                        className="group min-h-24 rounded-md border border-border p-3 transition-colors hover:bg-accent"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {permission.name}
                            </p>
                            <p className="mt-1 text-xs uppercase text-primary">
                              {permission.resource}:{permission.action}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge variant="secondary">{permission.action}</Badge>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                              onClick={() => handleOpenUpdatePermission(permission)}
                            >
                              <Pencil className="size-4" />
                              <span className="sr-only">{t('updatePermission')}</span>
                            </Button>
                          </div>
                        </div>
                        {permission.description ? (
                          <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted-foreground">
                            {permission.description}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPermission ? t('updatePermission') : t('createPermission')}
            </DialogTitle>
            <DialogDescription>
              {editingPermission
                ? t('updatePermissionDescription')
                : t('createPermissionDescription')}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSavePermission}>
            <div className="space-y-2">
              <Label htmlFor="permission-name">{t('permissionName')}</Label>
              <Input
                id="permission-name"
                value={form.name}
                placeholder={t('permissionNamePlaceholder')}
                readOnly
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>{t('resource')}</Label>
                <Select
                  value={selectedResourceOptionUrl}
                  onValueChange={handleResourceChange}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('resourcePlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {permissionResourceOptions.map((option) => (
                      <SelectItem key={option.url} value={option.url}>
                        {navigation(option.titleKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('action')}</Label>
                <Select
                  value={form.action}
                  onValueChange={(value) => updateForm('action', value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('actionPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {permissionActions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {actionLabels[action]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="permission-description">{t('description')}</Label>
              <Textarea
                id="permission-description"
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
                placeholder={t('descriptionPlaceholder')}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setPermissionDialogOpen(false)}
              >
                {common('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={
                  isSavingPermission ||
                  !canSavePermission
                }
              >
                {isSavingPermission
                  ? t('saving')
                  : editingPermission
                    ? t('updatePermission')
                    : t('createPermission')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
