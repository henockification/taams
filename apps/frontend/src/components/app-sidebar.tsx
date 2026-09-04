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
} from "@/components/ui/sidebar"
import { getAccessibleNavGroups, getFirstAccessiblePath, getNavItemForPath, type AppNavItem } from "@/config/app-navigation"
import { useTimeOperationsSummary } from "@/data/hooks/core.hooks"
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
  const navGroups = React.useMemo(
    () => getAccessibleNavGroups(user),
    [user, roleKey, permissionKey],
  )
  const homeHref = getFirstAccessiblePath(user) ?? "/dashboard"
  const activeGroupKey = React.useMemo(
    () => getActiveGroupKey(navGroups, pathname),
    [navGroups, pathname],
  )
  const activeSectionKey = React.useMemo(
    () => getActiveSectionKey(navGroups, pathname),
    [navGroups, pathname],
  )
  const [openGroupKeys, setOpenGroupKeys] = React.useState<Set<string>>(
    () => new Set(activeGroupKey ? [activeGroupKey] : []),
  )
  const [openSectionKeys, setOpenSectionKeys] = React.useState<Set<string>>(
    () => new Set(activeSectionKey ? [activeSectionKey] : []),
  )
  const { data: timeOperationsResponse, isLoading, isError } = useTimeOperationsSummary()
  const timeOperations = timeOperationsResponse?.timeOperations
  const topOperation = timeOperations?.items[0]

  React.useEffect(() => {
    if (!activeGroupKey) return

    setOpenGroupKeys((currentGroupKeys) => {
      if (currentGroupKeys.has(activeGroupKey)) return currentGroupKeys

      const nextGroupKeys = new Set(currentGroupKeys)
      nextGroupKeys.add(activeGroupKey)
      return nextGroupKeys
    })
  }, [activeGroupKey])

  React.useEffect(() => {
    if (!activeSectionKey) return

    setOpenSectionKeys((currentSectionKeys) => {
      if (currentSectionKeys.has(activeSectionKey)) return currentSectionKeys
      const nextSectionKeys = new Set(currentSectionKeys)
      nextSectionKeys.add(activeSectionKey)
      return nextSectionKeys
    })
  }, [activeSectionKey])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="h-16 justify-center border-b border-sidebar-border px-3 py-0 group-data-[collapsible=icon]:h-14 group-data-[collapsible=icon]:px-2">
        <Link
          href={homeHref as any}
          className="flex items-center gap-3 px-1 py-0.5 group-data-[collapsible=icon]:justify-center"
        >
          <Image
            src="/logo.png"
            alt="Tams"
            width={44}
            height={44}
            priority
            className="size-11 shrink-0 object-contain group-data-[collapsible=icon]:size-9"
          />
          <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-base font-semibold text-sidebar-foreground">Tams</span>
            <span className="text-xs text-sidebar-foreground/70">
              {t("attendanceManagement")}
            </span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 overflow-hidden px-2 py-2">
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1 group-data-[collapsible=icon]:pr-0">
          {navGroups.map((group) => (
            <React.Fragment key={group.labelKey}>
              <Collapsible
                open={openGroupKeys.has(group.labelKey)}
                onOpenChange={(open) => {
                  setOpenGroupKeys((currentGroupKeys) => {
                    const nextGroupKeys = new Set(currentGroupKeys)

                    if (open) {
                      nextGroupKeys.add(group.labelKey)
                    } else {
                      nextGroupKeys.delete(group.labelKey)
                    }

                    return nextGroupKeys
                  })
                }}
                className="group/collapsible"
              >
                <SidebarGroup className="py-0.5">
                  <SidebarGroupLabel
                    asChild
                    className="h-9 rounded-md px-2.5 text-[12.5px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent/70 data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                  >
                    <CollapsibleTrigger className="w-full cursor-pointer gap-2.5">
                      <group.icon className="size-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-left group-data-[collapsible=icon]:hidden">{t(group.labelKey)}</span>
                      <ChevronRight className="ml-auto size-4 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                    </CollapsibleTrigger>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent className="group-data-[collapsible=icon]:hidden">
                      <div className="relative ml-4 mt-1 pl-4 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.5rem)] before:w-px before:bg-sidebar-foreground/20">
                        {group.sections?.length ? (
                          <div className="space-y-1">
                            {group.sections.map((section) => {
                              const sectionKey = `${group.labelKey}:${section.labelKey}`
                              return (
                                <Collapsible
                                  key={sectionKey}
                                  open={openSectionKeys.has(sectionKey)}
                                  onOpenChange={(open) => setOpenSectionKeys((current) => {
                                    const next = new Set(current)
                                    if (open) next.add(sectionKey)
                                    else next.delete(sectionKey)
                                    return next
                                  })}
                                  className="group/submenu"
                                >
                                  <CollapsibleTrigger asChild>
                                    <button
                                      type="button"
                                      className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-xs font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                                    >
                                      <section.icon className="size-3.5 shrink-0" />
                                      <span className="min-w-0 flex-1 truncate">{t(section.labelKey)}</span>
                                      <ChevronRight className="size-3.5 shrink-0 transition-transform group-data-[state=open]/submenu:rotate-90" />
                                    </button>
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="relative ml-3 pl-3 before:absolute before:left-0 before:top-1 before:h-[calc(100%-0.5rem)] before:w-px before:bg-sidebar-foreground/15">
                                      <SidebarMenu className="gap-1 py-1">
                                        {section.items.map((item) => <SidebarNavItem key={item.url} item={item} />)}
                                      </SidebarMenu>
                                    </div>
                                  </CollapsibleContent>
                                </Collapsible>
                              )
                            })}
                          </div>
                        ) : (
                          <SidebarMenu className="gap-1">
                            {group.items.map((item) => <SidebarNavItem key={item.url} item={item} />)}
                          </SidebarMenu>
                        )}
                      </div>
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

function SidebarNavItem({ item }: { item: AppNavItem }) {
  const pathname = usePathname()
  const t = useTranslations("navigation")
  const isActive = getNavItemForPath(pathname)?.url === item.url

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={t(item.titleKey)}
        className="h-8 gap-2.5 rounded-md px-2.5 text-[12.5px] font-normal data-[active=true]:bg-primary data-[active=true]:font-medium data-[active=true]:text-primary-foreground data-[active=true]:shadow-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&>svg]:size-4"
      >
        <Link href={item.url}>
          <item.icon />
          <span>{t(item.titleKey)}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
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
  const activeUrl = getNavItemForPath(pathname)?.url
  const activeGroup = navGroups.find((group) =>
    group.items.some((item) => item.url === activeUrl),
  )

  return activeGroup?.labelKey ?? navGroups.find((group) => group.labelKey === "workspace")?.labelKey ?? navGroups[0]?.labelKey ?? null
}

function getActiveSectionKey(
  navGroups: ReturnType<typeof getAccessibleNavGroups>,
  pathname: string,
) {
  const activeUrl = getNavItemForPath(pathname)?.url
  for (const group of navGroups) {
    const section = group.sections?.find((candidate) =>
      candidate.items.some((item) => item.url === activeUrl),
    )
    if (section) return `${group.labelKey}:${section.labelKey}`
  }

  return null
}
