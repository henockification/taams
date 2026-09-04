'use client';

import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
  BellRing,
  ChevronDown,
  LogOut,
  User,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSession, signOut } from '@/lib/auth-client';
import { Link, usePathname, useRouter } from '@/i18n';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { LanguageSwitcher } from '@/components/language-switcher';
import { CalendarSwitcher } from '@/components/calendar-switcher';
import { getFirstAccessiblePath, getNavItemForPath, userCanAccessPath } from '@/config/app-navigation';
import { coreQueryKeys } from '@/data/hooks/core.hooks';

interface PrivateLayoutProps {
  children: React.ReactNode;
}

export default function PrivateLayout({ children }: PrivateLayoutProps) {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const dashboardT = useTranslations('dashboard');
  const coreT = useTranslations('core');
  const rbacT = useTranslations('rbac');

  // Redirect to signin if not authenticated, or to home if not admin
  React.useEffect(() => {
    if (isPending) return;

    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    if (!userCanAccessPath(session.user, pathname)) {
      router.push(getFirstAccessiblePath(session.user) ?? '/dashboard');
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
      queryClient.removeQueries({ queryKey: coreQueryKeys.all });
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

  const getPageDescription = () => {
    const navItem = getNavItemForPath(pathname);

    switch (navItem?.titleKey) {
      case 'dashboard':
        return dashboardT('emptyDescription');
      case 'executiveDashboard':
        return coreT('executiveDashboardDescription');
      case 'hrDashboard':
        return coreT('hrDashboardDescription');
      case 'departmentHeadDashboard':
        return coreT('departmentHeadDashboardDescription');
      case 'organizationStructure':
        return coreT('organizationStructureDescription');
      case 'positions':
        return coreT('positionsDescription');
      case 'employees':
        return coreT('employeesDescription');
      case 'permanentEmployees':
        return coreT('permanentEmployeesDescription');
      case 'fiscalYears':
        return coreT('fiscalYearsDescription');
      case 'leaveTypes':
        return coreT('leaveTypesDescription');
      case 'leaveBalances':
        return coreT('initialBalancesDescription');
      case 'leaveTransfer':
        return coreT('leaveTransferDescription');
      case 'leaveAuthorizations':
        return coreT('leaveAuthorizationsDescription');
      case 'temporaryAssignments':
        return coreT('temporaryAssignmentsDescription');
      case 'leaveRequestApprovals':
        return coreT('leaveRequestApprovalsDescription');
      case 'supervisorDelegation':
        return coreT('supervisorDelegationDescription');
      case 'overtimeAssignments':
        return coreT('overtimeAssignmentsDescription');
      case 'overtimeRequests':
        return coreT('myOvertimeAssignmentsDescription');
      case 'annualLeaveRequests':
        return coreT('annualLeaveRequestsDescription');
      case 'otherLeaveRequests':
        return coreT('otherLeaveRequestsDescription');
      case 'manualPunchRequests':
        return coreT('manualPunchRequestsDescription');
      case 'attendanceCorrectionApprovals':
        return coreT('attendanceCorrectionApprovalsDescription');
      case 'workSchedules':
        return coreT('workSchedulesDescription');
      case 'holidays':
        return coreT('holidaysDescription');
      case 'shifts':
        return coreT('shiftsDescription');
      case 'scheduleAssignments':
        return coreT('assignWorkScheduleDescription');
      case 'biometricDevices':
        return coreT('biometricDevicesDescription');
      case 'biometricExemptions':
        return coreT('biometricExemptionsDescription');
      case 'attendancePunches':
        return coreT('attendancePunchesDescription');
      case 'ifmisAttendance':
        return coreT('ifmisAttendanceDescription');
      case 'attendanceApprovals':
        return coreT('attendanceApprovalsDescription');
      case 'hrAttendanceApproval':
        return coreT('hrAttendanceApprovalDescription');
      case 'attendanceDailyReport':
        return coreT('attendanceDailyReportDescription');
      case 'attendancePunchesReport':
        return coreT('attendancePunchesReportDescription');
      case 'lateAttendanceReport':
        return coreT('lateAttendanceReportDescription');
      case 'overtimeReport':
        return coreT('overtimeReportDescription');
      case 'leaveBalancesReport':
        return coreT('leaveBalancesReportDescription');
      case 'leaveRequestsReport':
        return coreT('leaveRequestsReportDescription');
      case 'employeeRosterReport':
        return coreT('employeeRosterReportDescription');
      case 'deviceSyncReport':
        return coreT('deviceSyncReportDescription');
      case 'users':
        return rbacT('usersDescription');
      case 'roles':
        return rbacT('rolesDescription');
      case 'permissions':
        return rbacT('permissionsDescription');
      default:
        return pathname === '/notification-logs' ? coreT('myNotificationsDescription') : '';
    }
  };

  const currentNavItem = getNavItemForPath(pathname);
  const currentPage = pathname === '/notification-logs'
    ? t('notifications')
    : currentNavItem
      ? t(currentNavItem.titleKey)
      : t('dashboard');
  const currentDescription = getPageDescription();

  return (
    <SidebarProvider className="h-svh overflow-hidden">
      <AppSidebar user={session.user} />
      <SidebarInset className="min-h-0 w-auto min-w-0 overflow-hidden">
        <header className="z-20 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:min-h-14">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="-ml-1 text-primary hover:bg-accent hover:text-accent-foreground" />
            <Separator orientation="vertical" className="hidden h-5 sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">
                {currentPage}
              </h1>
              {currentDescription ? (
                <p className="hidden max-w-[min(52rem,calc(100vw-22rem))] truncate text-xs text-muted-foreground sm:block">
                  {currentDescription}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <CalendarSwitcher className="rounded-md text-primary hover:bg-accent hover:text-accent-foreground" />
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
                <DropdownMenuItem asChild>
                  <Link href="/notification-logs" className="cursor-pointer">
                    <BellRing className="mr-2 size-4" />
                    <span>{t('notifications')}</span>
                  </Link>
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
        <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-auto p-4 sm:p-6">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
