'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForm } from 'react-hook-form';
import { notifications } from '@/lib/notifications';
import { AlertCircle, Check } from 'lucide-react';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Try to get token from query params first, then from URL hash
  const token = searchParams.get('token') || searchParams.get('t') || 
    (typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.substring(1)).get('token') : null);
  const email = searchParams.get('email');

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormData>({
    mode: 'onChange',
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  useEffect(() => {
    // If no token in query params, try to extract from URL
    if (!token && typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      const pathParts = url.pathname.split('/');
      const tokenFromPath = pathParts[pathParts.length - 1];
      
      if (tokenFromPath && tokenFromPath !== 'reset-password') {
        // Redirect to the dynamic route with the token
        router.replace(`/auth/reset-password/${tokenFromPath}${url.search}`);
        return;
      }
    }

    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [token, router]);

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!token) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error } = await authClient.resetPassword({
        newPassword: data.password,
        token
      });

      if (error) {
        setError(error.message || 'Failed to reset password');
      } else {
        setSuccess(true);
        notifications.show({
          title: 'Password Reset Successfully',
          message: 'Your password has been updated. You can now sign in.',
          color: 'green',
          icon: <Check size={16} />,
        });
        
        // Redirect to sign in page after 2 seconds
        setTimeout(() => {
          router.push('/auth/signin');
        }, 2000);
      }
    } catch (err) {
      setError('Failed to reset password. Please try again.');
      console.error('Reset password error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    router.push('/auth/signin');
  };

  return (
    <div className="flex items-center justify-center min-h-screen auth-layout">
      <div className="flex items-center justify-center p-8 w-full max-w-[420px]">
        <div className="w-full">
          <div className="space-y-6">
            {success ? (
              <>
                <div className="flex justify-center">
                  <Check size={48} className="text-olive" />
                </div>
                <div className="text-center">
                  <h1 className="text-2xl font-semibold mb-2 text-olive">
                    Password reset successfully
                  </h1>
                  <p className="text-muted-foreground">Redirecting to sign in page...</p>
                </div>
              </>
            ) : !token ? (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-2xl font-semibold mb-2 text-destructive">
                    Invalid Reset Link
                  </h1>
                  <p className="text-muted-foreground">
                    This password reset link is invalid or has expired. Please request a new password reset.
                  </p>
                </div>
                <Button className="w-full" onClick={handleBack}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="text-center">
                  <h1 className="text-2xl font-semibold mb-2">Reset your password</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your new password below
                    {email && <><br />Resetting password for: <strong>{email}</strong></>}
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
                          <Label htmlFor="password">New Password</Label>
                          <Input
                            id="password"
                            type="password"
                            placeholder="Enter your new password"
                            {...register('password', {
                              required: 'Password is required',
                              minLength: {
                                value: 6,
                                message: 'Password must be at least 6 characters',
                              },
                            })}
                          />
                          {errors.password && (
                            <p className="text-sm text-destructive">
                              {errors.password.message}
                            </p>
                          )}
                      </div>

                      <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirm New Password</Label>
                          <Input
                            id="confirmPassword"
                            type="password"
                            placeholder="Confirm your new password"
                            {...register('confirmPassword', {
                              required: 'Please confirm your password',
                              validate: (value) => {
                                const password = watch('password');
                                return value === password || 'Passwords do not match';
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
                        {loading || isSubmitting ? 'Resetting...' : 'Reset password'}
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
              </div>
            )}
          </div> 
        </div> 
      </div>
    </div>
  );
}
