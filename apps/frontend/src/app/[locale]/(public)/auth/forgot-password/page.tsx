'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { notifications } from '@/lib/notifications';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

interface ForgotPasswordFormData {
  email: string;
}

export default function ForgotPasswordPage() {
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [token, setToken] = useState<string | null>(null);
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
      if (!token) {
        setError('Please verify you are human');
        return;
      }

      const { error } = await authClient.requestPasswordReset({
        email: data.email,
        redirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3008'}/auth/reset-password`,
        fetchOptions: {
          headers: {
            'x-captcha-response': token,
          },
        },
      });

      if (error) {
        setError(error.message || 'Failed to send reset email');
        turnstileRef.current?.reset();
        setToken(null);
      } else {
        setSubmittedEmail(data.email);
        setSuccess(true);
        turnstileRef.current?.reset();
        setToken(null);
        notifications.show({
          title: 'Reset Email Sent',
          message: 'Check your email for password reset instructions',
          color: 'green',
        });
      }
    } catch (err) {
      setError('Failed to send reset email. Please try again.');
      console.error('Forgot password error:', err);
      turnstileRef.current?.reset();
      setToken(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen auth-layout">
      <div className="flex items-center justify-center p-8 w-full max-w-[420px]">
        <div className="w-full">
          <div className="space-y-6">
            {success ? (
              <>
                <div className="text-center">
                  <h1 className="text-2xl font-semibold mb-2 text-olive">
                    Email sent
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    We&apos;ve sent password reset instructions to{' '}
                    <strong>{submittedEmail}</strong>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Check your email and click the link to reset your password.
                </p>
                <Button className="w-full" asChild>
                  <Link href="/auth/signin">Back to sign in</Link>
                </Button>
              </>
            ) : (
              <>
                <div className="text-center">
                  <h1 className="text-2xl font-semibold mb-2">Forgot password?</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we&apos;ll send you a link to reset your password for{' '}
                    <Link href="/" className="font-medium text-primary hover:underline">
                      Taams
                    </Link>
                    .
                  </p>
                </div>

                <Card>
                  <CardContent className="pt-6">
                    {error && (
                      <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                      </Alert>
                    )}

                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="Your email address"
                          {...register('email', {
                            required: 'Email is required',
                            pattern: {
                              value: /^\S+@\S+$/,
                              message: 'Invalid email address',
                            },
                          })}
                        />
                        {errors.email && (
                          <p className="text-sm text-destructive">{errors.email.message}</p>
                        )}
                      </div>

                      <Turnstile
                        ref={turnstileRef}
                        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
                        onSuccess={(t) => setToken(t)}
                      />

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loading || isSubmitting}
                      >
                        {loading || isSubmitting ? 'Sending...' : 'Send reset link'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                <p className="text-center text-sm text-muted-foreground">
                  Remember your password?{' '}
                  <Link href="/auth/signin" className="font-medium text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
