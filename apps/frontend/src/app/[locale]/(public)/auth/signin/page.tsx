'use client';

import { SignInForm } from '@/components/auth/SignInForm';
import Image from 'next/image';
import Link from 'next/link';

export default function SignInPage() {
  return (
    <>
      <div
        className="flex items-center justify-center min-h-screen auth-layout"
      >
        {/* Right Side - Form */}
        <div
          className="flex items-center justify-center p-8 w-full max-w-[420px]"
        >
          <div className="w-full ">
            <div className="space-y-6">
              <div className="text-center">
                <h1 className="text-2xl font-semibold mb-2">
                  Welcome Back
                </h1>
                <p className="text-sm text-muted-foreground">
                  Sign in to your account to continue to{' '}
                  <Link href="/" className="font-medium text-primary hover:underline">
                    Taams
                  </Link>
                </p>
              </div>
              
              <SignInForm />
              
              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/auth/signup" className="font-medium text-primary hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
