'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { notifications } from '@/lib/notifications';
import { AlertCircle } from 'lucide-react';
import { authClient } from '@/lib/auth-client';

interface ForgotPasswordFormData {
  email: string;
}

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setLoading(true);
    setError(null);

    try {
      const { error } = await authClient.requestPasswordReset({
        email: data.email,
      });

      if (error) {
        setError(error.message || t('requestResetFailed'));
      } else {
        setSubmittedEmail(data.email);
        setSuccess(true);
        notifications.show({
          title: t('requestResetSuccessTitle'),
          message: t('requestResetSuccessMessage'),
          color: 'green',
        });
      }
    } catch (err) {
      setError(t('requestResetFailed'));
      console.error('Forgot password error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow={t('brandEyebrow')}
      title={success ? t('forgotPasswordSuccessTitle') : t('forgotPasswordTitle')}
      description={
        success
          ? t('forgotPasswordSuccessDescription', { email: submittedEmail })
          : t('forgotPasswordDescription')
      }
    >
      {success ? (
        <Card className="border-border/80 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <p className="text-center text-sm leading-6 text-muted-foreground">
              {t('forgotPasswordSuccessHelp')}
            </p>
            <Button className="w-full" asChild>
              <Link href={`/auth/reset-password?email=${encodeURIComponent(submittedEmail)}`}>
                {t('setNewPassword')}
              </Link>
            </Button>
            <Button className="w-full" variant="outline" onClick={() => router.push('/auth/signin')}>
              {t('backToSignIn')}
            </Button>
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
                      pattern: {
                        value: /^\S+@\S+$/,
                        message: t('validation.invalidEmail'),
                      },
                    })}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={loading || isSubmitting}>
                  {loading || isSubmitting ? t('requestingReset') : t('requestResetButton')}
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
