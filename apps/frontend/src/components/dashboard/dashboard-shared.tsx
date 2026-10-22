"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Info, X } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { DashboardAttendanceSummary, DashboardDataQuality } from "@/data/types/core.types"
import { cn } from "@/lib/utils"

export type DashboardDepartmentOption = { id: string; name: string; parentDepartmentId: string | null }

/** Searchable department picker; choosing a department includes its sub-departments. */
export function DashboardDepartmentFilter({
  departments,
  value,
  onChange,
}: {
  departments: DashboardDepartmentOption[]
  value?: string
  onChange: (value: string | undefined) => void
}) {
  const t = useTranslations("dashboardShared")
  const [open, setOpen] = React.useState(false)
  const selected = departments.find((department) => department.id === value)
  const childCount = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const department of departments) {
      if (department.parentDepartmentId) counts.set(department.parentDepartmentId, (counts.get(department.parentDepartmentId) ?? 0) + 1)
    }
    return counts
  }, [departments])

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal sm:w-72">
            <span className="truncate">{selected?.name ?? t("allDepartments")}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(22rem,calc(100vw-2rem))] p-0" align="start">
          <Command>
            <CommandInput placeholder={t("searchDepartment")} />
            <CommandList>
              <CommandEmpty>{t("noDepartmentFound")}</CommandEmpty>
              <CommandGroup>
                <CommandItem value={`__all ${t("allDepartments")}`} onSelect={() => { onChange(undefined); setOpen(false) }}>
                  <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
                  {t("allDepartments")}
                </CommandItem>
                {departments.map((department) => (
                  <CommandItem key={department.id} value={`${department.name} ${department.id}`} onSelect={() => { onChange(department.id); setOpen(false) }}>
                    <Check className={cn("size-4", value === department.id ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0 flex-1 truncate">{department.name}</span>
                    {childCount.get(department.id) ? (
                      <span className="shrink-0 text-xs text-muted-foreground">+{childCount.get(department.id)}</span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value ? (
        <Button variant="ghost" size="icon" aria-label={t("clearDepartment")} onClick={() => onChange(undefined)}>
          <X className="size-4" />
        </Button>
      ) : null}
    </div>
  )
}

/** Explains why some figures are incomplete; renders nothing when data is complete. */
export function DashboardDataQualityNotice({ dataQuality, isLive }: { dataQuality: DashboardDataQuality; isLive: boolean }) {
  const t = useTranslations("dashboardShared")
  const pastMissing = dataQuality.missingRecords - dataQuality.missingToday
  const messages = [
    isLive && dataQuality.missingToday > 0 ? t("dataQualityToday", { count: dataQuality.missingToday }) : null,
    pastMissing > 0 ? t("dataQualityMissing", { count: pastMissing }) : null,
    dataQuality.noScheduleEmployees > 0 ? t("dataQualityNoSchedule", { count: dataQuality.noScheduleEmployees }) : null,
  ].filter((message): message is string => Boolean(message))
  if (messages.length === 0) return null

  return (
    <div role="status" className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-0.5">
        <p className="font-medium">{t("dataQualityTitle")}</p>
        {messages.map((message) => <p key={message}>{message}</p>)}
      </div>
    </div>
  )
}

/** One-line attendance picture for the day: who is here, late, absent, away. */
export function DashboardAttendanceStrip({ summary, isLive }: { summary: DashboardAttendanceSummary; isLive: boolean }) {
  const t = useTranslations("dashboardShared")
  const items: Array<{ label: string; value: React.ReactNode; tone?: string; hidden?: boolean }> = [
    { label: t("headcount"), value: summary.headcount },
    { label: t("present"), value: summary.present, tone: "text-emerald-700 dark:text-emerald-400" },
    { label: t("late"), value: summary.late, tone: "text-amber-700 dark:text-amber-400" },
    { label: t("absent"), value: summary.absent, tone: "text-rose-700 dark:text-rose-400" },
    { label: t("absentNotYetArrived"), value: summary.notYetArrived, hidden: !isLive },
    { label: t("onLeave"), value: summary.onLeave, tone: "text-indigo-700 dark:text-indigo-400" },
    { label: t("attendanceRate"), value: summary.attendanceRate === null ? "—" : `${summary.attendanceRate}%` },
    { label: t("onTimeRate"), value: summary.punctualityRate === null ? "—" : `${summary.punctualityRate}%` },
  ]

  return (
    <Card className="py-3">
      <CardContent className="grid grid-cols-2 gap-x-4 gap-y-3 px-4 sm:grid-cols-4 xl:grid-cols-8">
        {items.filter((item) => !item.hidden).map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{item.label}</p>
            <p className={cn("text-lg font-semibold text-foreground", item.tone)}>{item.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

/** Today in Addis Ababa, the calendar the server uses for attendance days. */
export function addisTodayInput() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Addis_Ababa", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date())
}
