'use client';

import { useState, useEffect, useCallback } from 'react';
import { Theme, type ThemeConfig, getStoredTheme, applyTheme, getSystemTheme } from '@/lib/theme';

export type { ThemeConfig };

export function useTheme(): ThemeConfig {
  const [theme, setThemeState] = useState<Theme>('system');

  // Initialize theme on mount
  useEffect(() => {
    const storedTheme = getStoredTheme();
    const initialTheme = storedTheme || 'system';
    setThemeState(initialTheme);
    applyTheme(initialTheme);
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyTheme('system');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    const currentTheme = getStoredTheme() || 'system';
    const effectiveTheme = currentTheme === 'system' ? getSystemTheme() : currentTheme;
    const newTheme = effectiveTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  }, [setTheme]);

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}

