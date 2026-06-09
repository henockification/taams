'use client';

import { SignUpForm } from '@/components/auth/SignUpForm';
import Image from 'next/image';
import Link from 'next/link';

export default function SignUpPage() {
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
                  Create Account
                </h1>

                <p className="text-sm text-muted-foreground">
                  Sign up to get started with{' '}
                  <Link href="/" className="font-medium text-primary hover:underline">
                    Taams
                  </Link>
                </p>
              </div>
              
              <SignUpForm />
              
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link href="/auth/signin" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
