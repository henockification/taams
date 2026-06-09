'use client';

import { LanguageSwitcher } from '@/components/language-switcher';

export function AuthLanguageSwitcher() {
  return (
    <LanguageSwitcher
      variant="outline"
      className="border-primary/20 bg-background/80 text-primary shadow-sm backdrop-blur hover:bg-primary/8 hover:text-primary"
    />
  );
}
