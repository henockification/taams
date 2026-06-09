import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { UIProvider, QueryProvider } from '@/providers';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n';
import React from 'react';

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;
  
  // Ensure that the incoming locale is valid
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  // Providing all messages to the client side
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <QueryProvider>
        <UIProvider>
          {children}
        </UIProvider>
      </QueryProvider>
    </NextIntlClientProvider>
  );
}
