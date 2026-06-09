'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { notifications } from '@/lib/notifications';
import { Loader2 } from 'lucide-react';
import { hasPageAccess, getPagePermission, Role } from '@/lib/rbac';

interface RoleAuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: Role[]; // Optional - will use path-based permissions if not provided
  fallbackPath?: string;
}

export function RoleAuthGuard({ 
  children, 
  requiredRoles,
  fallbackPath = '/dashboard' 
}: RoleAuthGuardProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isPending && session?.user) {
      // Use path-based permissions if no specific roles provided
      const hasAccess = requiredRoles 
        ? hasPageAccess(session.user.role, pathname)
        : hasPageAccess(session.user.role, pathname);
      
      if (!hasAccess) {
        const permission = getPagePermission(pathname);
        const message = permission 
          ? `You need ${permission.allowedRoles.join(' or ')} role to access ${permission.name}`
          : 'You do not have permission to access this page';
          
        notifications.show({
          title: 'Access Denied',
          message,
          color: 'red',
        });
        router.push(fallbackPath);
      }
    }
  }, [isPending, session, requiredRoles, fallbackPath, router, pathname]);

  if (isPending || !session?.user) {
    return (
      <div className="bg-background min-h-screen">
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-muted-foreground">Loading authentication status...</p>
          </div>
        </div>
      </div>
    );
  }

  // Check if user has access to this page
  const hasAccess = hasPageAccess(session.user.role, pathname);
  
  if (!hasAccess) {
    const permission = getPagePermission(pathname);
    return (
      <div className="bg-background min-h-screen">
        <div className="flex items-center justify-center h-screen">
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">
              {permission 
                ? `You need ${permission.allowedRoles.join(' or ')} role to access ${permission.name}`
                : 'You do not have permission to access this page'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
