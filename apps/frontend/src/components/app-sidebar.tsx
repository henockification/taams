"use client"

import * as React from "react"
import Image from "next/image"
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, Loader2 } from "lucide-react"
import { useTranslations } from "next-intl"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { getAccessibleNavGroups, getFirstAccessiblePath } from "@/config/app-navigation"
import { useDashboardSummary, useTimeOperationsSummary } from "@/data/hooks/core.hooks"
import { Link, usePathname } from "@/i18n"
import { cn } from "@/lib/utils"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: {
    id?: string
    role?: string[]
    permissions?: string[]
  }
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const t = useTranslations("navigation")
  const roleKey = user?.role?.join("|") ?? ""
  const permissionKey = user?.permissions?.join("|") ?? ""
  const dashboardResponse = useDashboardSummary(user?.id)
  const roles = React.useMemo(
    () => user?.role?.map((role) => role.toLowerCase()) ?? [],
    [roleKey, user?.role],
  )
  const isExplicitSupervisor = roles.some((role) => (
    role === "supervisor"
    || role === "department_head"
    || role === "department_manager"
    || role === "manager"
  ))
  const canOpenSupervisorDashboard = isExplicitSupervisor
    || dashboardResponse.data?.dashboard.role === "MANAGER"
    || Boolean(user?.permissions?.includes("department-head-dashboard:read"))
  const navUser = React.useMemo(() => {
    if (!user || !canOpenSupervisorDashboard) return user

    return {
      ...user,
      role: Array.from(new Set([...(user.role ?? []), "supervisor"])),
    }
  }, [user, canOpenSupervisorDashboard])
  const navGroups = React.useMemo(
    () => getAccessibleNavGroups(navUser),
    [navUser, roleKey, permissionKey, canOpenSupervisorDashboard],
  )
  const homeHref = getFirstAccessiblePath(navUser) ?? "/dashboard"
  const activeGroupKey = React.useMemo(
    () => getActiveGroupKey(navGroups, pathname),
    [navGroups, pathname],
  )
  const [openGroupKey, setOpenGroupKey] = React.useState<string | null>(activeGroupKey)
  const { data: timeOperationsResponse, isLoading, isError } = useTimeOperationsSummary()
  const timeOperations = timeOperationsResponse?.timeOperations
  const topOperation = timeOperations?.items[0]

  React.useEffect(() => {
    setOpenGroupKey((currentGroupKey) => (
      currentGroupKey === activeGroupKey ? currentGroupKey : activeGroupKey
    ))
  }, [activeGroupKey])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3 py-0 group-data-[collapsible=icon]:h-14 group-data-[collapsible=icon]:px-2">
        <Link
          href={homeHref as any}
          className="flex items-center gap-3 rounded-md px-1.5 py-1 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground ring-1 ring-sidebar-border">
            <Image
              src="/logo.png"
              alt="Taams"
              width={28}
              height={28}
              priority
              className="size-7 object-contain"
            />
          </span>
          <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-base font-semibold text-sidebar-foreground">Taams</span>
            <span className="text-xs text-sidebar-foreground/70">
              {t("attendanceManagement")}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-hidden px-2 py-3">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 group-data-[collapsible=icon]:pr-0">
          {navGroups.map((group, index) => (
            <React.Fragment key={group.labelKey}>
              {index > 0 ? <SidebarSeparator className="my-1 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:w-6" /> : null}
              <Collapsible
                open={openGroupKey === group.labelKey}
                onOpenChange={(open) => setOpenGroupKey(open ? group.labelKey : null)}
                className="group/collapsible"
              >
                <SidebarGroup className="py-1">
                  <SidebarGroupLabel asChild className="text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground">
                    <CollapsibleTrigger className="w-full cursor-pointer">
                      <span className="min-w-0 flex-1 truncate text-left">{t(group.labelKey)}</span>
                      <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => {
                          const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`)

                          return (
                            <SidebarMenuItem key={item.url}>
                              <SidebarMenuButton
                                asChild
                                isActive={isActive}
                                tooltip={t(item.titleKey)}
                                className="h-10 gap-3 rounded-md data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                              >
                                <Link href={item.url}>
                                  <item.icon />
                                  <span>{t(item.titleKey)}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          )
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            </React.Fragment>
          ))}
        </div>

        <SidebarGroup className="shrink-0 pt-3">
          <div className="mx-2 rounded-md border border-sidebar-border bg-sidebar-accent/60 p-3 text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            <div className="flex items-start gap-2.5">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-md text-primary-foreground",
                  getTimeOperationTone(topOperation?.severity, isError).iconClass,
                )}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isError ? (
                  <AlertTriangle className="size-4" />
                ) : topOperation?.severity === "success" ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <Clock3 className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{t("timeOperations")}</p>
                  {timeOperations && timeOperations.counts.totalOpenItems > 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                        getTimeOperationTone(topOperation?.severity, isError).badgeClass,
                      )}
                    >
                      {timeOperations.counts.totalOpenItems}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-sidebar-foreground/70">
                  {isLoading
                    ? "Checking attendance workflow..."
                    : isError
                      ? "Could not load the current operations queue."
                      : topOperation?.description ?? t("timeOperationsDescription")}
                </p>
                {!isLoading && !isError && topOperation ? (
                  <Link
                    href={topOperation.actionHref as any}
                    className="mt-2 inline-flex text-xs font-medium text-sidebar-foreground underline-offset-4 hover:underline"
                  >
                    {topOperation.actionLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

function getTimeOperationTone(
  severity?: "critical" | "warning" | "info" | "success",
  isError = false,
) {
  if (isError || severity === "critical") {
    return {
      iconClass: "bg-destructive text-destructive-foreground",
      badgeClass: "bg-destructive text-destructive-foreground",
    }
  }

  if (severity === "warning") {
    return {
      iconClass: "bg-amber-500 text-white",
      badgeClass: "bg-amber-500 text-white",
    }
  }

  if (severity === "success") {
    return {
      iconClass: "bg-emerald-600 text-white",
      badgeClass: "bg-emerald-600 text-white",
    }
  }

  return {
    iconClass: "bg-primary text-primary-foreground",
    badgeClass: "bg-primary text-primary-foreground",
  }
}

function getActiveGroupKey(
  navGroups: ReturnType<typeof getAccessibleNavGroups>,
  pathname: string,
) {
  const activeGroup = navGroups.find((group) =>
    group.items.some((item) => pathname === item.url || pathname.startsWith(`${item.url}/`)),
  )

  return activeGroup?.labelKey ?? navGroups.find((group) => group.labelKey === "workspace")?.labelKey ?? navGroups[0]?.labelKey ?? null
}
