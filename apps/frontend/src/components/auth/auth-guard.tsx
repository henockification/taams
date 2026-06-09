'use client';

import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { notifications } from '@/lib/notifications';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    console.log('AuthGuard check:', { isPending, hasUser: !!session?.user, session });
    if (!isPending && requireAuth && !session?.user) {
      console.log('AuthGuard: No user found, redirecting to signin');
      notifications.show({
        title: 'Authentication Required',
        message: 'Please log in to access this page',
        color: 'red',
      });
      router.push('/auth/signin');
    }
  }, [isPending, session, requireAuth, router]);

  // Show loading during session check
  if (isPending) {
    return (
      <div className="bg-background min-h-screen">
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  // Don't render protected content if no session
  if (requireAuth && !session?.user) {
    return (
      <div className="bg-background min-h-screen">
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
