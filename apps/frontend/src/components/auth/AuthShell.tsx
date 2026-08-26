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
            <Link href="/" className="inline-flex items-center gap-5">
              <span className="flex size-24 items-center justify-center rounded-xl bg-white shadow-sm">
                <Image
                  src="/logo.png"
                  alt="Tams"
                  width={82}
                  height={82}
                  priority
                  className="h-20 w-20 object-contain"
                />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-5xl font-black leading-none tracking-normal text-white">
                  TAMS
                </span>
                <span className="mt-2 max-w-72 text-base font-semibold leading-5 text-white/80">
                  Time and Attendance Management System
                </span>
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
              <div className="grid grid-cols-3 gap-3 text-xs font-medium text-white/76">
                <div className="border-l border-white/24 pl-3">{t('coverageAttendance')}</div>
                <div className="border-l border-white/24 pl-3">{t('coverageLeave')}</div>
                <div className="border-l border-white/24 pl-3">{t('coverageReports')}</div>
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
                <span className="flex size-14 items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-border">
                  <Image
                    src="/logo.png"
                    alt="Tams"
                    width={42}
                    height={42}
                    priority
                    className="h-10 w-10 object-contain"
                  />
                </span>
                <span className="flex flex-col">
                  <span className="text-2xl font-black leading-none text-primary">TAMS</span>
                  <span className="max-w-64 text-xs font-semibold leading-tight text-primary/75 sm:text-sm">
                    Time and Attendance Management System
                  </span>
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
