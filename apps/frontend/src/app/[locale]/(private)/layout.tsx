'use client';

import React from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSession, signOut } from '@/lib/auth-client';
import { Link, usePathname, useRouter } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { getFirstAccessiblePath, userCanAccessPath } from '@/config/app-navigation';

interface PrivateLayoutProps {
  children: React.ReactNode;
}

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('navigation');

  // Redirect to signin if not authenticated, or to home if not admin
  React.useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    if (!userCanAccessPath(session.user, pathname)) {
      router.push(getFirstAccessiblePath(session.user) ?? '/');
    }
  }, [session, isPending, router, pathname]);

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

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/auth/signin');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const getUserInitials = () => {
    const name = session?.user?.name?.trim();
    if (!name) return 'U';

    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((part: string) => part.charAt(0).toUpperCase()).join('');
  };

  const generateBreadcrumbs = () => {
    if (!pathname) return [];

    const segments = pathname.split('/').filter(Boolean);

    const routeLabels: Record<string, string> = {
      dashboard: t('dashboard'),
      users: t('users'),
      roles: t('roles'),
      permissions: t('permissions'),
      employees: t('employees'),
      positions: t('positions'),
      'organization-structure': t('organizationStructure'),
    };

    const breadcrumbs: Array<{ label: string; href: string; isLast: boolean }> = [];

    breadcrumbs.push({
      label: t('dashboard'),
      href: '/dashboard',
      isLast: segments.length === 0 || segments[0] === 'dashboard',
    });

    let currentPath = '';
    segments.forEach((segment, index) => {
      if (segment === 'dashboard' && index === 0) {
        return;
      }

      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;

      breadcrumbs.push({
        label: routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
        href: currentPath,
        isLast,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();
  const currentPage = breadcrumbs[breadcrumbs.length - 1]?.label ?? t('dashboard');

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} />
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 backdrop-blur transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-14">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="-ml-1 text-primary hover:bg-accent hover:text-accent-foreground" />
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {currentPage}
              </h1>
              <Breadcrumb className="hidden sm:block">
                <BreadcrumbList>
                  {breadcrumbs.map((crumb, index) => (
                    <React.Fragment key={crumb.href}>
                      {index > 0 && <BreadcrumbSeparator className="hidden md:block" />}
                      <BreadcrumbItem className="hidden md:block">
                        {crumb.isLast ? (
                          <BreadcrumbPage className="capitalize">{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={crumb.href} className="capitalize">
                              {crumb.label}
                            </Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <LanguageSwitcher
              variant="ghost"
              className="rounded-md text-primary hover:bg-accent hover:text-accent-foreground"
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-10 gap-2 rounded-md px-2 text-left hover:bg-accent hover:text-accent-foreground"
                >
                  <Avatar className="size-8 rounded-md border border-border">
                    <AvatarImage src={session.user.image || ''} alt={session.user.name || ''} />
                    <AvatarFallback className="rounded-md bg-primary text-primary-foreground">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden min-w-0 leading-tight sm:grid">
                    <span className="max-w-36 truncate text-sm font-medium">
                      {session.user.name || t('user')}
                    </span>
                    <span className="max-w-40 truncate text-xs text-muted-foreground">
                      {session.user.email}
                    </span>
                  </span>
                  <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {session.user.name || t('user')}
                    </span>
                    <span className="truncate text-xs font-normal text-muted-foreground">
                      {session.user.email}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={`/users/${session.user.id}`} className="cursor-pointer">
                    <User className="mr-2 size-4" />
                    <span>{t('profile')}</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  <Settings className="mr-2 size-4" />
                  <span>{t('settings')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleSignOut}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 size-4" />
                  <span>{t('logout')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
