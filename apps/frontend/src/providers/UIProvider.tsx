'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';
import { CalendarPreferenceProvider } from './CalendarPreferenceProvider';

interface UIProviderProps {
  children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
  return (
    <ThemeProvider>
      <CalendarPreferenceProvider>
        {children}
        <Toaster />
        <SonnerToaster />
      </CalendarPreferenceProvider>
    </ThemeProvider>
  );
}


