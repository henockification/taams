'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { ReactNode } from 'react';
import { Link } from '@/i18n';
import { cn } from '@/lib/utils';
import { AuthLanguageSwitcher } from './AuthLanguageSwitcher';

interface AuthShellProps {
  children: ReactNode;
  title: string;
  description: ReactNode;
  eyebrow?: string;
  footer?: ReactNode;
  sideContent?: ReactNode;
  sideFooter?: ReactNode;
  supportingContent?: ReactNode;
  className?: string;
}

export function AuthShell({
  children,
  title,
  description,
  eyebrow,
  footer,
  sideContent,
  sideFooter,
  supportingContent,
  className,
}: AuthShellProps) {
  const t = useTranslations('auth');

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[minmax(360px,0.95fr)_minmax(420px,1.05fr)]">
        <section className="relative hidden overflow-hidden bg-primary text-primary-foreground lg:flex">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(0,51,102,0.98),rgba(0,36,73,1))]" />
          <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex size-12 items-center justify-center rounded-md bg-white shadow-sm">
                <Image
                  src="/logo.png"
                  alt="Taams"
                  width={34}
                  height={34}
                  priority
                  className="h-8 w-8 object-contain"
                />
              </span>
              <span className="max-w-64 text-lg font-semibold leading-tight tracking-normal">
                Time and Attendance Management System
              </span>
            </Link>

            <div className="max-w-lg space-y-5">
              {eyebrow ? (
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-white/70">
                  {eyebrow}
                </p>
              ) : null}
              <h2 className="text-4xl font-semibold leading-tight text-white xl:text-5xl">
                {title}
              </h2>
              <p className="max-w-md text-base leading-7 text-white/78">
                {description}
              </p>
              {sideContent ? <div className="pt-2">{sideContent}</div> : null}
            </div>

            {sideFooter ? (
              sideFooter
            ) : (
              <div className="grid grid-cols-3 gap-3 text-sm text-white/74">
                <div className="border-l border-white/24 pl-3">{t('featureRbac')}</div>
                <div className="border-l border-white/24 pl-3">{t('featureNativeAuth')}</div>
                <div className="border-l border-white/24 pl-3">{t('featureSmsOtp')}</div>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="absolute right-4 top-4 sm:right-6 sm:top-6">
            <AuthLanguageSwitcher />
          </div>

          <div className={cn('w-full max-w-[430px] space-y-6', className)}>
            <div className="flex justify-center lg:hidden">
              <Link href="/" className="inline-flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-border">
                  <Image
                    src="/logo.png"
                    alt="Taams"
                    width={34}
                    height={34}
                    priority
                    className="h-8 w-8 object-contain"
                  />
                </span>
                <span className="max-w-64 text-base font-semibold leading-tight text-primary sm:text-lg">
                  Time and Attendance Management System
                </span>
              </Link>
            </div>

            <div className="space-y-2 text-center lg:text-left">
              {eyebrow ? (
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-primary/70">
                  {eyebrow}
                </p>
              ) : null}
              <h1 className="text-3xl font-semibold tracking-normal text-foreground">
                {title}
              </h1>
              <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            </div>

            {supportingContent ? <div>{supportingContent}</div> : null}

            {children}

            {footer ? (
              <div className="text-center text-sm text-muted-foreground">{footer}</div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
