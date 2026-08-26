'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useSession } from '@/lib/auth-client';
import { useRouter } from '@/i18n';

export default function LocaleLandingPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;

    router.replace(session?.user ? '/dashboard' : '/auth/signin');
  }, [isPending, router, session?.user]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-primary" />
        <span>Loading TAMS...</span>
      </div>
    </main>
  );
}
