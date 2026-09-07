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
import { LoginMethodToggle, type LoginMethod } from '@/components/auth/login-method-toggle';
import { identifierPayload, isValidEthiopianPhone } from '@/lib/login-identifier';

interface ForgotPasswordFormData {
  identifier: string;
}

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [method, setMethod] = useState<LoginMethod>('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submittedIdentifier, setSubmittedIdentifier] = useState('');
  const [submittedMethod, setSubmittedMethod] = useState<LoginMethod>('email');
  const [testingMode, setTestingMode] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormData>({
    defaultValues: {
      identifier: '',
    },
  });

  const changeMethod = (nextMethod: LoginMethod) => {
    setMethod(nextMethod);
    setValue('identifier', '');
    setError(null);
  };

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setLoading(true);
    setError(null);

    try {
      const payload = identifierPayload(method, data.identifier);
      const { data: result, error } = await authClient.requestPasswordReset(payload);

      if (error) {
        setError(error.message || t('requestResetFailed'));
      } else {
        setSubmittedIdentifier(data.identifier.trim());
        setSubmittedMethod(method);
        setTestingMode(Boolean(result?.testingMode));
        setSuccess(true);
        notifications.show({
          title: t('requestResetSuccessTitle'),
          message: result?.testingMode
            ? t('otpTestingMode')
            : t('requestResetSuccessMessage'),
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

  const resetQuery = submittedMethod === 'email'
    ? `email=${encodeURIComponent(submittedIdentifier)}`
    : `phone=${encodeURIComponent(submittedIdentifier)}`;

  return (
    <AuthShell
      eyebrow={t('brandEyebrow')}
      title={success ? t('forgotPasswordSuccessTitle') : t('forgotPasswordTitle')}
      description={
        success
          ? t('forgotPasswordSuccessDescription', { identifier: submittedIdentifier })
          : t('forgotPasswordDescription')
      }
      sideFooter={<div />}
    >
      {success ? (
        <Card className="border-border/80 shadow-sm">
          <CardContent className="space-y-4 pt-6">
            <p className="text-center text-sm leading-6 text-muted-foreground">
              {testingMode ? t('otpTestingMode') : t('forgotPasswordSuccessHelp')}
            </p>
            <Button className="w-full" asChild>
              <Link href={`/auth/reset-password?${resetQuery}${testingMode ? '&testingMode=1' : ''}`}>
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
                <LoginMethodToggle method={method} onChange={changeMethod} />

                <div className="space-y-2">
                  <Label htmlFor="identifier">{method === 'email' ? t('email') : t('phone')}</Label>
                  <Input
                    id="identifier"
                    key={method}
                    type={method === 'email' ? 'email' : 'tel'}
                    inputMode={method === 'email' ? 'email' : 'tel'}
                    autoComplete={method === 'email' ? 'email' : 'tel'}
                    placeholder={method === 'email' ? t('emailPlaceholder') : t('phonePlaceholder')}
                    {...register('identifier', {
                      required: method === 'email' ? t('validation.emailRequired') : t('validation.phoneRequired'),
                      validate: (value) => {
                        if (method === 'email') {
                          return /^\S+@\S+$/.test(value) || t('validation.invalidEmail');
                        }
                        return isValidEthiopianPhone(value) || t('validation.invalidPhone');
                      },
                    })}
                  />
                  {errors.identifier && (
                    <p className="text-sm text-destructive">{errors.identifier.message}</p>
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
