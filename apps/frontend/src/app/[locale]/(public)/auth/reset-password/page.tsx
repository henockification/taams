'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { notifications } from '@/lib/notifications';
import { AlertCircle, Check } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

interface ResetPasswordFormData {
  email: string;
  otp: string;
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const email = searchParams.get('email') || '';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    mode: 'onChange',
    defaultValues: {
      email,
      otp: '',
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    setError(null);
  }, []);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!data.email || !data.otp) {
      setError(t('emailAndOtpRequired'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await authClient.resetPassword({
        email: data.email,
        otp: data.otp,
        newPassword: data.password,
      });

      if (error) {
        setError(error.message || t('resetPasswordFailed'));
      } else {
        setSuccess(true);
        notifications.show({
          title: t('resetPasswordSuccessTitle'),
          message: t('resetPasswordSuccessMessage'),
          color: 'green',
          icon: <Check size={16} />,
        });
        
        // Redirect to sign in page after 2 seconds
        setTimeout(() => {
          router.push('/auth/signin');
        }, 2000);
      }
    } catch (err) {
      setError(t('resetPasswordFailed'));
      console.error('Reset password error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow={t('brandEyebrow')}
      title={success ? t('resetPasswordSuccessTitle') : t('resetPasswordTitle')}
      description={success ? t('redirectingToSignIn') : t('resetPasswordDescription')}
    >
      {success ? (
        <Card className="border-border/80 shadow-sm">
          <CardContent className="space-y-4 pt-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Check size={28} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">
              {t('resetPasswordSuccessMessage')}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
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
                    })}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="otp">{t('verificationCode')}</Label>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder={t('otpPlaceholder')}
                    {...register('otp', {
                      required: t('validation.otpRequired'),
                      minLength: {
                        value: 6,
                        message: t('validation.otpTooShort'),
                      },
                    })}
                  />
                  {errors.otp && (
                    <p className="text-sm text-destructive">{errors.otp.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t('newPassword')}</Label>
                  <PasswordInput
                    id="password"
                    placeholder={t('newPasswordPlaceholder')}
                    {...register('password', {
                      required: t('validation.passwordRequired'),
                      minLength: {
                        value: 6,
                        message: t('validation.passwordTooShort'),
                      },
                    })}
                  />
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('confirmNewPassword')}</Label>
                  <PasswordInput
                    id="confirmPassword"
                    placeholder={t('confirmPasswordPlaceholder')}
                    {...register('confirmPassword', {
                      required: t('validation.confirmPasswordRequired'),
                      validate: (value) => {
                        const password = watch('password');
                        return value === password || t('validation.passwordsDoNotMatch');
                      },
                    })}
                  />
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">
                      {errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={loading || isSubmitting}>
                  {loading || isSubmitting ? t('resettingPassword') : t('resetPassword')}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-sm text-muted-foreground">
            {t('rememberPassword')}{' '}
            <Link href="/auth/signin" className="font-medium text-primary hover:underline">
              {t('signIn')}
            </Link>
          </p>
        </>
      )}
    </AuthShell>
  );
}
