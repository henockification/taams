'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { notifications } from '@/lib/notifications';
import { AlertCircle } from 'lucide-react';
import { useEmailSignIn } from '@/data/hooks/auth.hooks';
import { OtpVerificationDialog } from '@/components/auth/OtpVerificationDialog';
import { LoginMethodToggle, type LoginMethod } from '@/components/auth/login-method-toggle';
import { identifierPayload } from '@/lib/login-identifier';
import { identifierFieldRules, LoginIdentifierField } from '@/components/auth/login-identifier-field';

interface SignInFormData {
  identifier: string;
  password: string;
}

export function SignInForm() {
  const t = useTranslations('auth');
  const [method, setMethod] = useState<LoginMethod>('email');
  const [error, setError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpOpen, setOtpOpen] = useState(false);
  const [testingMode, setTestingMode] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [pendingCredentials, setPendingCredentials] = useState<{
    email?: string;
    phone?: string;
    password: string;
  } | null>(null);
  const router = useRouter();
  const signInMutation = useEmailSignIn();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    mode: 'onChange',
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const changeMethod = (nextMethod: LoginMethod) => {
    setMethod(nextMethod);
    setValue('identifier', '');
    setError(null);
  };

  const onSubmit = async (formData: SignInFormData) => {
    setError(null);
    const credentials = {
      ...identifierPayload(method, formData.identifier),
      password: formData.password,
    };

    try {
      const result = await signInMutation.mutateAsync({
        ...credentials,
        callbackURL: '/dashboard',
      });

      if (result?.otpRequired) {
        setPendingCredentials(credentials);
        setTestingMode(Boolean(result.testingMode));
        setOtpError(null);
        setOtpOpen(true);
        return;
      }

      await finishSignIn();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  const finishSignIn = async () => {
    setOtpOpen(false);

    notifications.show({
      title: t('signInSuccessTitle'),
      message: t('signInSuccessMessage'),
      color: 'green',
    });

    await new Promise((resolve) => setTimeout(resolve, 250));

    router.push('/dashboard');
    router.refresh();
  };

  const getErrorMessage = (err: unknown) => {
    console.error('Sign in error:', err);
    if (typeof err === 'object' && err !== null) {
      const error = err as { message?: string; code?: string; maxAttempts?: number; lockoutMinutes?: number };
      const max = error.maxAttempts ?? 5;
      const minutes = error.lockoutMinutes ?? 15;
      if (error.code === 'ACCOUNT_LOCKED') {
        return t('accountLocked', { max, minutes });
      }
      if (error.code === 'INVALID_CREDENTIALS') {
        return t('invalidCredentialsWithLimit', { max, minutes });
      }
      if (typeof error.message === 'string') {
        return error.message;
      }
    }
    return t('loginFailed');
  };

  const verifySignInOtp = async (otp: string) => {
    if (!pendingCredentials) return;
    setOtpError(null);

    try {
      await signInMutation.mutateAsync({
        ...pendingCredentials,
        otp,
        callbackURL: '/dashboard',
      });
      await finishSignIn();
    } catch (err) {
      setOtpError(getErrorMessage(err));
    }
  };

  const resendSignInOtp = async () => {
    if (!pendingCredentials) return;
    setResendingOtp(true);
    setOtpError(null);

    try {
      const result = await signInMutation.mutateAsync({
        ...pendingCredentials,
        callbackURL: '/dashboard',
      });
      setTestingMode(Boolean(result?.testingMode));
      notifications.show({
        title: t('otpResentTitle'),
        message: t('otpResent'),
        color: 'green',
      });
    } catch (err) {
      setOtpError(getErrorMessage(err));
    } finally {
      setResendingOtp(false);
    }
  };

  return (
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

            <LoginIdentifierField
              key={method}
              method={method}
              registration={register('identifier', identifierFieldRules(method, t))}
              error={errors.identifier?.message}
            />

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
                <p className="mt-1 text-sm text-error-600">
                  {errors.password.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={signInMutation.isPending || isSubmitting}>
              {signInMutation.isPending || isSubmitting ? t('signingIn') : t('signIn')}
            </Button>
          </form>

          <div className="mt-4 flex justify-center">
            <Button variant="link" type="button" onClick={() => router.push('/auth/forgot-password')}>
              {t('forgotPassword')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <OtpVerificationDialog
        open={otpOpen}
        destination={pendingCredentials?.email ?? pendingCredentials?.phone ?? ''}
        loading={signInMutation.isPending && !resendingOtp}
        resending={resendingOtp}
        error={otpError}
        testingMode={testingMode}
        onOpenChange={(open) => {
          setOtpOpen(open);
          if (!open) setOtpError(null);
        }}
        onVerify={verifySignInOtp}
        onResend={resendSignInOtp}
      />
    </>
  );
}
