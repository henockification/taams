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
import { authClient, signIn, signUp } from '../../lib/auth-client';
import Image from 'next/image';
import { Verification } from '../ui/verification';
import { usersApi } from '@/data/api/users.api';
import { Turnstile, TurnstileInstance } from '@marsidev/react-turnstile';

interface SignUpFormData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  captchaToken: string;
}

export function SignUpForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<'signup' | 'verification'>('signup');
  const [userEmail, setUserEmail] = useState<string>('');
  const [verificationError, setVerificationError] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const router = useRouter();
  const isSubmittingRef = useRef(false);
  const hasSubmittedRef = useRef(false);
  const turnstileRef = useRef<TurnstileInstance | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpFormData>({
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data: SignUpFormData) => {
    if (loading || isSubmittingRef.current || hasSubmittedRef.current) {
      return;
    }
    if (currentStep === 'verification') {
      return;
    }
    isSubmittingRef.current = true;
    hasSubmittedRef.current = true;
    setLoading(true);
    setError(null);

    try {
      if (!token) {
        setError('Please verify you are human');
        return;
      }

      await usersApi.signup({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        password: data.password,
        captchaToken: token ?? '',
      });

      turnstileRef.current?.reset();

      // If we reach here, signup was successful (API throws on error)
      notifications.show({
        title: 'Account Created!',
        message: 'Please verify your email to complete registration.',
        color: 'blue',
      });
      // Redirect to signin page after successful signup
      setUserEmail(data.email);
      setCurrentStep('verification');
      setError(null);
    } catch (error) {
      console.error('Sign up error:', error);
      setError(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await signIn.social({
        provider: 'google',
        callbackURL: '/dashboard',
      });

      if (result.error) {
        setError(result.error.message || 'Google sign-up failed');
      }
    } catch (err) {
      setError('Google sign-up failed');
      console.error('Google sign-up error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (code: string) => {
    setIsVerifying(true);
    setVerificationError('');
    
    try {
      // Call the verification API
      const result = await authClient.emailOtp.verifyEmail({
        email: userEmail,
        otp: code,
      });

      if (result.data) {
        notifications.show({
          title: 'Email Verified!',
          message: 'Your email has been verified successfully. Please sign in to continue.',
          color: 'green',
        });
        
        // Redirect to sign-in page for better security
        router.push('/auth/signin');
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
      
      notifications.show({
        title: 'Code Sent',
        message: 'A new verification code has been sent to your email',
        color: 'green',
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

  const handleClearVerificationError = () => {
    setVerificationError('');
  };

  const handleBackToSignUp = () => {
    setCurrentStep('signup');
    setUserEmail('');
    setVerificationError('');
    setError(null);
    // Reset submission state
    hasSubmittedRef.current = false;
    isSubmittingRef.current = false;
  };

  // Show verification component if email verification is required
  if (currentStep === 'verification') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Verify Your Email</CardTitle>
          <CardDescription className="text-center">
            We&apos;ve sent a verification code to <strong>{userEmail}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Verification
            onVerify={handleVerify}
            onResend={handleResend}
            onClearError={handleClearVerificationError}
            isLoading={isVerifying}
            isResending={isResending}
            error={verificationError}
          />
          
          <div className="flex justify-center">
            <Button variant="ghost" type="button" onClick={handleBackToSignUp}>
              Back to Sign Up
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
          onClick={handleGoogleSignUp}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                type="text"
                placeholder="First name"
                {...register('firstName', {
                  required: 'First name is required',
                  minLength: {
                    value: 1,
                    message: 'First name is required',
                  },
                })}
              />
              {errors.firstName && (
                <p className="text-sm text-error-600 mt-1">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                type="text"
                placeholder="Last name"
                {...register('lastName', {
                  required: 'Last name is required',
                  minLength: {
                    value: 1,
                    message: 'Last name is required',
                  },
                })}
              />
              {errors.lastName && (
                <p className="text-sm text-error-600 mt-1">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

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

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || isSubmitting || hasSubmittedRef.current}
          >
            {loading || isSubmitting ? 'Creating account...' : 'Create account'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
