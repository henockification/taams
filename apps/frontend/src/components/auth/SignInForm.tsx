'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import { notifications } from '@/lib/notifications';
import { AlertCircle } from 'lucide-react';
import { authClient, signIn } from '../../lib/auth-client';
import Image from 'next/image';
import { Verification } from '../ui/verification';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

interface SignInFormData {
  email: string;
  password: string;
  captchaToken: string;
}

export function SignInForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string>('');
  const [showVerification, setShowVerification] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [verificationCaptchaToken, setVerificationCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const verificationTurnstileRef = useRef<TurnstileInstance | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SignInFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
      captchaToken: '',
    },
  });

  const onSubmit = async (formData: SignInFormData) => {
    setLoading(true);
    setError(null);

    try {
      if (!token) {
        setError('Please verify you are human');
        return;
      }

      const { data, error } = await signIn.email({
        email: formData.email,
        password: formData.password,
        fetchOptions: {
          headers: {
            'x-captcha-response': token,
          },
        },
      });

      if (data) {
        const session = await authClient.getSession();

        notifications.show({
          title: 'Success!',
          message: 'You have been logged in successfully',
          color: 'green',
        });

        turnstileRef.current?.reset();
        setToken(null);

        await new Promise((resolve) => setTimeout(resolve, 500));

        const userRole = session.data?.user?.role;
        if (Array.isArray(userRole) && userRole.includes('admin')) {
          router.push('/dashboard');
          router.refresh();
        } else {
          router.push('/');
        }
      } else if (error) {
        const status = 'status' in error ? error.status : undefined;
        const message =
          typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof (error as { message?: string }).message === 'string'
            ? (error as { message: string }).message
            : 'Login failed';

        if (
          status === 403 ||
          (message.toLowerCase().includes('email') && message.toLowerCase().includes('verif'))
        ) {
          setUserEmail(formData.email);
          setShowVerification(true);
          setError(null);
        } else {
          setError(message);
          turnstileRef.current?.reset();
          setToken(null);
        }
      } else {
        setError('Login failed');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await signIn.social({
        provider: 'google',
        callbackURL: '/dashboard',
      });

      if (result.error) {
        setError(result.error.message || 'Google sign-in failed');
      }
    } catch (err) {
      setError('Google sign-in failed');
      console.error('Google sign-in error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (code: string) => {
    setIsVerifying(true);
    setVerificationError('');

    if (!verificationCaptchaToken) {
      setVerificationError('Please complete the security check below.');
      setIsVerifying(false);
      return;
    }

    try {
      const result = await authClient.emailOtp.verifyEmail({
        email: userEmail,
        otp: code,
      });

      if (result.data) {
        notifications.show({
          title: 'Email Verified!',
          message: 'Your email has been verified successfully. Signing you in...',
          color: 'green',
        });

        const { data: signInData, error: signInError } = await signIn.email({
          email: userEmail,
          password: getValues('password'),
          fetchOptions: {
            headers: {
              'x-captcha-response': verificationCaptchaToken,
            },
          },
        });

        if (signInData) {
          const session = await authClient.getSession();

          const userRole = session.data?.user?.role;
          if (Array.isArray(userRole) && userRole.includes('admin')) {
            if (session.data?.user?.tenantId && typeof window !== 'undefined') {
              localStorage.setItem('tenantId', session.data.user.tenantId);
            }
            router.push('/dashboard');
            router.refresh();
          } else {
            router.push('/');
          }
          verificationTurnstileRef.current?.reset();
          setVerificationCaptchaToken(null);
        } else {
          const msg =
            signInError &&
            typeof signInError === 'object' &&
            'message' in signInError &&
            typeof (signInError as { message?: string }).message === 'string'
              ? (signInError as { message: string }).message
              : 'Sign in failed after verification.';
          setVerificationError(msg);
          verificationTurnstileRef.current?.reset();
          setVerificationCaptchaToken(null);
        }
      } else if (result.error) {
        // Handle error from result.error instead of catching exception
        let errorMessage = 'Invalid verification code. Please try again.';
        
        if (result.error.code === 'OTP_EXPIRED') {
          errorMessage = 'Verification code has expired. Please request a new code.';
        } else if (result.error.code === 'INVALID_OTP') {
          errorMessage = 'Invalid verification code. Please try again.';
        }
        
        setVerificationError(errorMessage);
      }
    } catch (error: any) {
      let errorMessage = 'Invalid verification code. Please try again.';
      
      if (error.code === 'OTP_EXPIRED') {
        errorMessage = 'Verification code has expired. Please request a new code.';
      } else if (error.code === 'INVALID_OTP') {
        errorMessage = 'Invalid verification code. Please try again.';
      }
      
      setVerificationError(errorMessage);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    
    try {
      // Call the resend verification API
      await authClient.emailOtp.sendVerificationOtp({
        email: userEmail,
        type: "email-verification",
      });
    } catch (error) {
      notifications.show({
        title: 'Error',
        message: 'Failed to resend verification code',
        color: 'red',
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToSignIn = () => {
    setShowVerification(false);
    setUserEmail('');
    setVerificationError('');
    setError(null);
    setVerificationCaptchaToken(null);
    verificationTurnstileRef.current?.reset();
  };

  const handleClearVerificationError = () => {
    setVerificationError('');
  };

  // Show verification component if email verification is required
  if (showVerification) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Verify Your Email</CardTitle>
          <CardDescription className="text-center">
            We&apos;ve sent a verification code to <strong>{userEmail}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Turnstile
            ref={verificationTurnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            onSuccess={(t) => setVerificationCaptchaToken(t)}
          />
          <Verification
            onVerify={handleVerify}
            onResend={handleResend}
            onClearError={handleClearVerificationError}
            isLoading={isVerifying}
            isResending={isResending}
            error={verificationError}
          />
          
          <div className="flex justify-center">
            <Button variant="ghost" type="button" onClick={handleBackToSignIn}>
              Back to Sign In
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {/* <Button
          variant="outline"
          className="w-full mb-4"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          <Image 
            src="/google.svg" 
            alt="Google" 
            width={16} 
            height={16}
            className="mr-2"
          />
          Continue with Google
        </Button> */}

        {/* <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Or continue with email
            </span>
          </div>
        </div> */}

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
              <p className="text-sm text-error-600 mt-1">
                {errors.email.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <PasswordInput
              id="password"
              placeholder="Your password"
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters',
                },
              })}
            />
            {errors.password && (
              <p className="text-sm text-error-600 mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <Turnstile 
            ref={turnstileRef}
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!} 
            onSuccess={(token) => setToken(token)} 
          />

          <Button type="submit" className="w-full" disabled={loading || isSubmitting}>
            {loading || isSubmitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>

        <div className="flex justify-center mt-4">
          <Button variant="link" type="button" onClick={() => router.push('/auth/forgot-password')}>
            Forgot your password?
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
