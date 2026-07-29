'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, ShieldCheck, SlidersHorizontal } from 'lucide-react';
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
import { notifications } from '@/lib/notifications';
import {
  useAssignRolePermissions,
  useCreateRole,
  usePermissions,
  useRoles,
  useUpdateRole,
} from '@/data/hooks/rbac.hooks';
import type { Permission, Role } from '@/data/types/rbac.types';

export default function RolesPage() {
  const t = useTranslations('rbac');
  const common = useTranslations('common');
  const { data: rolesResponse, isLoading: rolesLoading } = useRoles();
  const { data: permissionsResponse, isLoading: permissionsLoading } = usePermissions();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();
  const assignRolePermissions = useAssignRolePermissions();

  const roles = rolesResponse?.roles ?? [];
  const permissions = permissionsResponse?.permissions ?? [];
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [selectedPermissionIds, setSelectedPermissionIds] = useState<string[]>([]);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  const selectedRole = roles.find((role) => role.id === selectedRoleId);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  useEffect(() => {
    if (selectedRole) {
      setSelectedPermissionIds(selectedRole.permissions.map((permission) => permission.id));
    } else {
      setSelectedPermissionIds([]);
    }
  }, [selectedRole]);

  const permissionGroups = useMemo(() => {
    return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
      groups[permission.resource] = groups[permission.resource] ?? [];
      groups[permission.resource].push(permission);
      return groups;
    }, {});
  }, [permissions]);

  const handleOpenCreateRole = () => {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setRoleDialogOpen(true);
  };

  const handleOpenUpdateRole = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description ?? '');
    setRoleDialogOpen(true);
  };

  const handleSaveRole = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      if (editingRole) {
        const response = await updateRole.mutateAsync({
          roleId: editingRole.id,
          name: roleName.trim(),
          description: roleDescription.trim() || null,
        });
        setSelectedRoleId(response.role.id);
        notifications.show({
          title: common('success'),
          message: t('roleUpdated'),
          color: 'green',
        });
      } else {
        const response = await createRole.mutateAsync({
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
        });
        setSelectedRoleId(response.role.id);
        notifications.show({
          title: common('success'),
          message: t('roleCreated'),
          color: 'green',
        });
      }

      setRoleName('');
      setRoleDescription('');
      setEditingRole(null);
      setRoleDialogOpen(false);
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  const handlePermissionToggle = (permissionId: string, checked: boolean) => {
    setSelectedPermissionIds((current) => {
      if (checked) {
        return current.includes(permissionId) ? current : [...current, permissionId];
      }

      return current.filter((id) => id !== permissionId);
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedRoleId) return;

    try {
      await assignRolePermissions.mutateAsync({
        roleId: selectedRoleId,
        permissionIds: selectedPermissionIds,
      });
      notifications.show({
        title: common('success'),
        message: t('permissionsAssigned'),
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

  const isLoading = rolesLoading || permissionsLoading;
  const isSavingRole = createRole.isPending || updateRole.isPending;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button onClick={handleOpenCreateRole}>
          <Plus className="size-4" />
          {t('addRole')}
        </Button>
        <Badge variant="outline" className="gap-2 rounded-md px-3 py-1.5">
          <ShieldCheck className="size-3.5 text-primary" />
          {roles.length} {t('rolesCount')}
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="rounded-lg">
          <CardHeader className="gap-4 sm:flex sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle>{t('rolesTitle')}</CardTitle>
              <CardDescription>{t('rolesListDescription')}</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleOpenCreateRole}>
              <Plus className="size-4" />
              {t('addRole')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t('loadingSecurity')}</p>
            ) : roles.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('noRoles')}</p>
            ) : (
              roles.map((role) => (
                <div
                  key={role.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedRoleId(role.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedRoleId(role.id);
                    }
                  }}
                  className="group flex w-full items-start justify-between gap-3 rounded-md border border-border p-3 text-left transition-colors hover:bg-accent data-[active=true]:border-primary data-[active=true]:bg-primary/5"
                  data-active={role.id === selectedRoleId}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {role.name}
                    </span>
                    <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">
                      {role.description || t('noDescription')}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant={role.id === selectedRoleId ? 'default' : 'outline'}>
                      {role.permissions.length}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleOpenUpdateRole(role);
                      }}
                    >
                      <Pencil className="size-4" />
                      <span className="sr-only">{t('updateRole')}</span>
                    </Button>
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="rounded-lg">
          <CardHeader className="gap-4 lg:flex lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle>{t('assignPermissions')}</CardTitle>
              <CardDescription>{t('assignPermissionsDescription')}</CardDescription>
            </div>
            <Select
              value={selectedRoleId}
              onValueChange={setSelectedRoleId}
              disabled={roles.length === 0}
            >
              <SelectTrigger className="w-full lg:w-64">
                <SelectValue placeholder={t('selectRole')} />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedRole ? (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3">
                  <SlidersHorizontal className="size-4 text-primary" />
                  <span className="text-sm font-medium">{selectedRole.name}</span>
                  <Badge variant="outline">
                    {selectedPermissionIds.length} {t('permissionsSelected')}
                  </Badge>
                </div>

                <div className="space-y-5">
                  {Object.entries(permissionGroups).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('noPermissions')}</p>
                  ) : (
                    Object.entries(permissionGroups).map(([resource, group]) => (
                      <div key={resource} className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h2 className="text-sm font-semibold capitalize text-foreground">
                            {resource}
                          </h2>
                          <Separator className="flex-1" />
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          {group.map((permission) => (
                            <label
                              key={permission.id}
                              className="flex min-h-24 cursor-pointer gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent"
                            >
                              <Checkbox
                                checked={selectedPermissionIds.includes(permission.id)}
                                onCheckedChange={(checked) =>
                                  handlePermissionToggle(permission.id, checked === true)
                                }
                                className="mt-0.5"
                              />
                              <span className="min-w-0 space-y-1">
                                <span className="block text-sm font-medium text-foreground">
                                  {permission.name}
                                </span>
                                <span className="block text-xs uppercase text-primary">
                                  {permission.resource}:{permission.action}
                                </span>
                                {permission.description ? (
                                  <span className="line-clamp-2 block text-xs text-muted-foreground">
                                    {permission.description}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSavePermissions}
                    disabled={assignRolePermissions.isPending}
                  >
                    {assignRolePermissions.isPending ? t('saving') : t('savePermissions')}
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex min-h-72 items-center justify-center rounded-md border border-dashed border-border">
                <p className="text-sm text-muted-foreground">{t('selectRoleEmpty')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? t('updateRole') : t('createRole')}</DialogTitle>
            <DialogDescription>
              {editingRole ? t('updateRoleDescription') : t('createRoleDescription')}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleSaveRole}>
            <div className="space-y-2">
              <Label htmlFor="role-name">{t('roleName')}</Label>
              <Input
                id="role-name"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                placeholder={t('roleNamePlaceholder')}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-description">{t('roleDescription')}</Label>
              <Textarea
                id="role-description"
                value={roleDescription}
                onChange={(event) => setRoleDescription(event.target.value)}
                placeholder={t('roleDescriptionPlaceholder')}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRoleDialogOpen(false)}
              >
                {common('cancel')}
              </Button>
              <Button type="submit" disabled={isSavingRole || !roleName.trim()}>
                {isSavingRole ? t('saving') : editingRole ? t('updateRole') : t('createRole')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
