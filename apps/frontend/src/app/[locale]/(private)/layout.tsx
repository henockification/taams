'use client';

import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { usePathname } from 'next/navigation';
import { useSession } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';

interface PrivateLayoutProps {
  children: React.ReactNode;
}

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect to signin if not authenticated, or to home if not admin
  React.useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    // Check if user has admin role
    if (!session.user.role?.includes('admin')) {
      router.push('/');
    }
  }, [session, isPending, router]);

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md px-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-3/4" />
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return null;
  }

  // Generate breadcrumb based on pathname
  const generateBreadcrumbs = () => {
    if (!pathname) return [];

    // Remove locale from pathname (first segment after /)
    const segments = pathname.split('/').filter(Boolean);
    const locale = segments[0];
    const pathWithoutLocale = segments.slice(1);

    // Route name mapping for user-friendly labels
    const routeLabels: Record<string, string> = {
      dashboard: 'Dashboard',
      categories: 'Categories',
      items: 'Items',
      products: 'Packages',
      users: 'Users',
    };

    const breadcrumbs: Array<{ label: string; href: string; isLast: boolean }> = [];

    // Always start with Dashboard
    breadcrumbs.push({
      label: 'Dashboard',
      href: `/${locale}/dashboard`,
      isLast: pathWithoutLocale.length === 0 || pathWithoutLocale[0] === 'dashboard',
    });

    // Build breadcrumb trail
    let currentPath = `/${locale}`;
    pathWithoutLocale.forEach((segment, index) => {
      // Skip dashboard if it's the first segment (already added)
      if (segment === 'dashboard' && index === 0) {
        return;
      }

      currentPath += `/${segment}`;
      const isLast = index === pathWithoutLocale.length - 1;

      breadcrumbs.push({
        label: routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
        href: currentPath,
        isLast,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                    <BreadcrumbItem className="hidden md:block">
                      {crumb.isLast ? (
                        <BreadcrumbPage className="capitalize">{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.href} className="capitalize">
                          {crumb.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
