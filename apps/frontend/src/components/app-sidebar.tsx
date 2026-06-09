"use client"

import * as React from "react"
import Image from "next/image"
import { Clock3 } from "lucide-react"
import { useTranslations } from "next-intl"

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
import { getAccessibleNavGroups } from "@/config/app-navigation"
import { Link, usePathname } from "@/i18n"

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  user?: {
    role?: string[]
    permissions?: string[]
  }
}

export function AppSidebar({ user, ...props }: AppSidebarProps) {
  const pathname = usePathname()
  const t = useTranslations("navigation")
  const navGroups = getAccessibleNavGroups(user)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <Link
          href="/dashboard"
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

      <SidebarContent className="px-2 py-3">
        {navGroups.map((group) => (
          <SidebarGroup key={group.labelKey}>
            <SidebarGroupLabel className="text-sidebar-foreground/60">
              {t(group.labelKey)}
            </SidebarGroupLabel>
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
          </SidebarGroup>
        ))}

        <SidebarGroup className="mt-auto">
          <div className="mx-2 rounded-md border border-sidebar-border bg-sidebar-accent/60 p-3 text-sidebar-accent-foreground group-data-[collapsible=icon]:hidden">
            <div className="mb-2 flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Clock3 className="size-4" />
            </div>
            <p className="text-sm font-medium">{t("timeOperations")}</p>
            <p className="mt-1 text-xs leading-5 text-sidebar-foreground/70">
              {t("timeOperationsDescription")}
            </p>
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}
