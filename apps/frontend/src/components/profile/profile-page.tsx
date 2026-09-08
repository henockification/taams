'use client';

import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, Loader2, Save, UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useProfile, useUpdateProfile } from '@/data/hooks/users.hooks';
import type { UserProfileUpdate } from '@/data/types/users.types';
import { notifications } from '@/lib/notifications';

const emptyForm: UserProfileUpdate = {
  firstNameEn: '',
  middleNameEn: '',
  lastNameEn: '',
  firstNameAm: '',
  middleNameAm: '',
  lastNameAm: '',
  phoneNumber: '',
};

function inputValue(value: string | null | undefined) {
  return value ?? '';
}

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export function ProfilePage() {
  const t = useTranslations('profile');
  const core = useTranslations('core');
  const common = useTranslations('common');
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState<UserProfileUpdate>(emptyForm);

  useEffect(() => {
    const employee = profileQuery.data?.employee;
    if (!employee) return;
    setForm({
      firstNameEn: employee.firstNameEn,
      middleNameEn: inputValue(employee.middleNameEn),
      lastNameEn: employee.lastNameEn,
      firstNameAm: inputValue(employee.firstNameAm),
      middleNameAm: inputValue(employee.middleNameAm),
      lastNameAm: inputValue(employee.lastNameAm),
      phoneNumber: inputValue(employee.phoneNumber),
    });
  }, [profileQuery.data?.employee]);

  const patchForm = (patch: Partial<UserProfileUpdate>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await updateProfile.mutateAsync({
        ...form,
        firstNameEn: form.firstNameEn.trim(),
        middleNameEn: form.middleNameEn?.trim() || null,
        lastNameEn: form.lastNameEn.trim(),
        firstNameAm: form.firstNameAm?.trim() || null,
        middleNameAm: form.middleNameAm?.trim() || null,
        lastNameAm: form.lastNameAm?.trim() || null,
        phoneNumber: form.phoneNumber.trim(),
      });
      notifications.show({ title: common('success'), message: t('saved'), color: 'green' });
    } catch (error) {
      notifications.show({
        title: common('error'),
        message: error instanceof Error ? error.message : t('saveFailed'),
        color: 'red',
      });
    }
  };

  if (profileQuery.isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  if (profileQuery.error) {
    return (
      <Alert variant="destructive" className="mx-auto max-w-4xl">
        <AlertCircle className="size-4" />
        <AlertTitle>{common('error')}</AlertTitle>
        <AlertDescription>
          {profileQuery.error instanceof Error ? profileQuery.error.message : t('loadFailed')}
        </AlertDescription>
      </Alert>
    );
  }

  if (!profileQuery.data?.employee) {
    return (
      <Alert className="mx-auto max-w-4xl">
        <AlertCircle className="size-4" />
        <AlertTitle>{t('employeeProfileRequired')}</AlertTitle>
        <AlertDescription>{t('employeeProfileRequiredDescription')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserRound className="size-5" />
            </div>
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={saveProfile}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field id="profile-first-name-en" label={core('firstNameEn')}>
                <Input
                  id="profile-first-name-en"
                  value={form.firstNameEn}
                  onChange={(event) => patchForm({ firstNameEn: event.target.value })}
                  required
                  maxLength={100}
                />
              </Field>
              <Field id="profile-middle-name-en" label={core('middleNameEn')}>
                <Input
                  id="profile-middle-name-en"
                  value={inputValue(form.middleNameEn)}
                  onChange={(event) => patchForm({ middleNameEn: event.target.value })}
                  maxLength={100}
                />
              </Field>
              <Field id="profile-last-name-en" label={core('lastNameEn')}>
                <Input
                  id="profile-last-name-en"
                  value={form.lastNameEn}
                  onChange={(event) => patchForm({ lastNameEn: event.target.value })}
                  required
                  maxLength={100}
                />
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field id="profile-first-name-am" label={core('firstNameAm')}>
                <Input
                  id="profile-first-name-am"
                  value={inputValue(form.firstNameAm)}
                  onChange={(event) => patchForm({ firstNameAm: event.target.value })}
                  maxLength={100}
                />
              </Field>
              <Field id="profile-middle-name-am" label={core('middleNameAm')}>
                <Input
                  id="profile-middle-name-am"
                  value={inputValue(form.middleNameAm)}
                  onChange={(event) => patchForm({ middleNameAm: event.target.value })}
                  maxLength={100}
                />
              </Field>
              <Field id="profile-last-name-am" label={core('lastNameAm')}>
                <Input
                  id="profile-last-name-am"
                  value={inputValue(form.lastNameAm)}
                  onChange={(event) => patchForm({ lastNameAm: event.target.value })}
                  maxLength={100}
                />
              </Field>
            </div>

            <Field id="profile-phone-number" label={core('phoneNumber')}>
              <Input
                id="profile-phone-number"
                type="tel"
                value={form.phoneNumber}
                onChange={(event) => patchForm({ phoneNumber: event.target.value })}
                required
                maxLength={50}
                className="md:max-w-sm"
              />
            </Field>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={updateProfile.isPending || !form.firstNameEn.trim() || !form.lastNameEn.trim() || !form.phoneNumber.trim()}
              >
                {updateProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {updateProfile.isPending ? t('saving') : common('save')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
