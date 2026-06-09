// Re-export the routing configuration for easy access
export { routing } from './config';
export { Link, redirect, usePathname, useRouter } from './config';

// Locale types and utilities
export const locales = ['en', 'am'] as const;
export type Locale = typeof locales[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  am: 'አማርኛ',
};

// Helper function to check if a locale is valid
export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
