'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { notifications } from '@/lib/notifications';
import { AlertCircle } from 'lucide-react';
import { useEmailSignIn } from '@/data/hooks/auth.hooks';

interface SignInFormData {
  email: string;
  password: string;
}

export function SignInForm() {
  const t = useTranslations('auth');
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const signInMutation = useEmailSignIn();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (formData: SignInFormData) => {
    setError(null);

    try {
      await signInMutation.mutateAsync({
        email: formData.email,
        password: formData.password,
        callbackURL: '/dashboard',
      });

      notifications.show({
        title: t('signInSuccessTitle'),
        message: t('signInSuccessMessage'),
        color: 'green',
      });

      await new Promise((resolve) => setTimeout(resolve, 250));

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      console.error('Sign in error:', err);
      const message =
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message?: string }).message === 'string'
          ? (err as { message: string }).message
          : t('loginFailed');

      setError(message);
    }
  };

  return (
    <Card className="border-border/80 shadow-sm">
      <CardContent className="pt-6">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t('emailPlaceholder')}
              {...register('email', {
                required: t('validation.emailRequired'),
                pattern: {
                  value: /^\S+@\S+$/,
                  message: t('validation.invalidEmail'),
                },
              })}
            />
            {errors.email && (
              <p className="text-sm text-error-600 mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t('password')}</Label>
            <PasswordInput
              id="password"
              placeholder={t('passwordPlaceholder')}
              {...register('password', {
                required: t('validation.passwordRequired'),
                minLength: {
                  value: 6,
                  message: t('validation.passwordTooShort'),
                },
              })}
            />
            {errors.password && (
              <p className="text-sm text-error-600 mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={signInMutation.isPending || isSubmitting}>
            {signInMutation.isPending || isSubmitting ? t('signingIn') : t('signIn')}
          </Button>
        </form>

        <div className="flex justify-center mt-4">
          <Button variant="link" type="button" onClick={() => router.push('/auth/forgot-password')}>
            {t('forgotPassword')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
