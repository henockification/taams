'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useTheme, ThemeConfig } from '@/hooks/useTheme';

const ThemeContext = createContext<ThemeConfig | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themeConfig = useTheme();

  return (
    <ThemeContext.Provider value={themeConfig}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeConfig {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
}
