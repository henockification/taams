'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link, useRouter } from '@/i18n';
import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { notifications } from '@/lib/notifications';
import { AlertCircle, Check } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { OtpVerificationDialog } from '@/components/auth/OtpVerificationDialog';
import { LoginMethodToggle, type LoginMethod } from '@/components/auth/login-method-toggle';
import { identifierPayload, toLocalEthiopianMobile } from '@/lib/login-identifier';
import { identifierFieldRules, LoginIdentifierField } from '@/components/auth/login-identifier-field';

interface ResetPasswordFormData {
  identifier: string;
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const t = useTranslations('auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [testingMode, setTestingMode] = useState(false);
  const [pendingReset, setPendingReset] = useState<{
    email?: string;
    phone?: string;
    password: string;
  } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryEmail = searchParams.get('email') || '';
  const queryPhone = searchParams.get('phone') || '';
  const [method, setMethod] = useState<LoginMethod>(queryPhone && !queryEmail ? 'phone' : 'email');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    mode: 'onChange',
    defaultValues: {
      identifier: queryPhone && !queryEmail ? toLocalEthiopianMobile(queryPhone) : queryEmail,
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    setError(null);
    setTestingMode(searchParams.get('testingMode') === '1');
    const email = searchParams.get('email') || '';
    const phone = searchParams.get('phone') || '';
    if (phone && !email) {
      setMethod('phone');
      setValue('identifier', toLocalEthiopianMobile(phone));
    } else if (email) {
      setMethod('email');
      setValue('identifier', email);
    }
  }, [searchParams, setValue]);

  const changeMethod = (nextMethod: LoginMethod) => {
    setMethod(nextMethod);
    setValue('identifier', '');
    setError(null);
  };

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError(null);
    setOtpError(null);
    setPendingReset({
      ...identifierPayload(method, data.identifier),
      password: data.password,
    });
    setOtpOpen(true);
  };

  const verifyResetOtp = async (otp: string) => {
    if (!pendingReset) return;
    setLoading(true);
    setOtpError(null);

    try {
      const { error } = await authClient.resetPassword({
        email: pendingReset.email,
        phone: pendingReset.phone,
        otp,
        newPassword: pendingReset.password,
      });

      if (error) {
        setOtpError(error.message || t('resetPasswordFailed'));
      } else {
        setOtpOpen(false);
        setSuccess(true);
        notifications.show({
          title: t('resetPasswordSuccessTitle'),
          message: t('resetPasswordSuccessMessage'),
          color: 'green',
          icon: <Check size={16} />,
        });

        setTimeout(() => {
          router.push('/auth/signin');
        }, 2000);
      }
    } catch (err) {
      setOtpError(t('resetPasswordFailed'));
      console.error('Reset password error:', err);
    } finally {
      setLoading(false);
    }
  };

  const resendResetOtp = async () => {
    if (!pendingReset) return;
    setResendingOtp(true);
    setOtpError(null);

    try {
      const { data, error } = await authClient.requestPasswordReset({
        email: pendingReset.email,
        phone: pendingReset.phone,
      });
      if (error) {
        setOtpError(error.message || t('requestResetFailed'));
        return;
      }
      setTestingMode(Boolean(data?.testingMode));
      notifications.show({
        title: t('otpResentTitle'),
        message: t('otpResent'),
        color: 'green',
      });
    } catch (err) {
      setOtpError(t('requestResetFailed'));
      console.error('Resend reset OTP error:', err);
    } finally {
      setResendingOtp(false);
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
                <LoginMethodToggle method={method} onChange={changeMethod} />

                <LoginIdentifierField
                  key={method}
                  method={method}
                  registration={register('identifier', identifierFieldRules(method, t))}
                  error={errors.identifier?.message}
                />

                <div className="space-y-2">
                  <Label htmlFor="password">{t('newPassword')}</Label>
                  <PasswordInput
                    id="password"
                    placeholder={t('newPasswordPlaceholder')}
                    {...register('password', {
                      required: t('validation.passwordRequired'),
                      minLength: {
                        value: 12,
                        message: t('validation.passwordMinLength'),
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

          <OtpVerificationDialog
            open={otpOpen}
            destination={pendingReset?.email ?? pendingReset?.phone ?? ''}
            loading={loading}
            resending={resendingOtp}
            error={otpError}
            testingMode={testingMode}
            onOpenChange={(open) => {
              setOtpOpen(open);
              if (!open) setOtpError(null);
            }}
            onVerify={verifyResetOtp}
            onResend={resendResetOtp}
          />
        </>
      )}
    </AuthShell>
  );
}
