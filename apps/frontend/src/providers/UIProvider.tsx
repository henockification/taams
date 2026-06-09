'use client';

import { ReactNode } from 'react';
import { ThemeProvider } from './ThemeProvider';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as SonnerToaster } from '@/components/ui/sonner';

interface UIProviderProps {
  children: ReactNode;
}

export function UIProvider({ children }: UIProviderProps) {
  return (
    <ThemeProvider>
      {children}
      <Toaster />
      <SonnerToaster />
    </ThemeProvider>
  );
}



