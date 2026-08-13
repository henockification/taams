"use client"

import * as React from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  ClipboardList,
  Fingerprint,
  HeartPulse,
  LogOut,
  RefreshCw,
  RotateCcw,
  ServerOff,
  ShieldAlert,
  TimerOff,
  UsersRound,
  WalletCards,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Link } from "@/i18n"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useHrDashboardSummary } from "@/data/hooks/core.hooks"
import type {
  Employee,
  HrDashboardSeverity,
  HrDashboardSummary,
  HrDashboardWidget,
  LeaveBalance,
} from "@/data/types/core.types"
import { cn } from "@/lib/utils"

type WidgetKey = keyof HrDashboardSummary["widgets"]
type HrDashboardMessageKey =
  | "pendingManualRequests"
  | "recentReturnedCorrections"
  | "employeesOnLeave"
  | "employeesWithoutPunch"
  | "missingCheckout"
  | "lateEmployees"
  | "attendanceExceptions"
  | "upcomingLeave"
  | "leaveExpiring"
  | "offlineDevices"
  | "syncStatus"

const widgetMeta: Record<WidgetKey, { tone: string; icon: React.ComponentType<{ className?: string }>; group: "openItems" | "people" | "systems"; labelKey: HrDashboardMessageKey }> = {
  pendingApprovals: { icon: ClipboardCheck, tone: "bg-slate-900 text-white", group: "openItems", labelKey: "pendingManualRequests" },
  correctionsReturned: { icon: RotateCcw, tone: "bg-rose-600 text-white", group: "openItems", labelKey: "recentReturnedCorrections" },
  manualAttendanceRequests: { icon: ClipboardList, tone: "bg-amber-500 text-white", group: "openItems", labelKey: "pendingManualRequests" },
  employeesOnLeave: { icon: CalendarClock, tone: "bg-indigo-600 text-white", group: "people", labelKey: "employeesOnLeave" },
  employeesWithoutPunch: { icon: Fingerprint, tone: "bg-cyan-700 text-white", group: "people", labelKey: "employeesWithoutPunch" },
  missingCheckout: { icon: LogOut, tone: "bg-orange-600 text-white", group: "people", labelKey: "missingCheckout" },
  lateEmployees: { icon: Clock3, tone: "bg-violet-700 text-white", group: "people", labelKey: "lateEmployees" },
  attendanceExceptions: { icon: AlertTriangle, tone: "bg-red-700 text-white", group: "openItems", labelKey: "attendanceExceptions" },
  upcomingLeave: { icon: CalendarClock, tone: "bg-emerald-700 text-white", group: "people", labelKey: "upcomingLeave" },
  employeesNearLeaveExpiry: { icon: TimerOff, tone: "bg-teal-700 text-white", group: "people", labelKey: "leaveExpiring" },
  devicesOffline: { icon: ServerOff, tone: "bg-zinc-800 text-white", group: "systems", labelKey: "offlineDevices" },
  synchronizationStatus: { icon: RefreshCw, tone: "bg-blue-700 text-white", group: "systems", labelKey: "syncStatus" },
}

export default function HrDashboardPage() {
  const t = useTranslations("hrDashboard")
  const [date, setDate] = React.useState(todayInput())
  const { data, isLoading, isFetching, isError, error, refetch } = useHrDashboardSummary({ date })
  const dashboard = data?.hrDashboard

  if (isLoading) return <HrDashboardSkeleton />

  if (isError || !dashboard) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-3 p-6">
          <Badge variant="destructive">{t("unableToLoad")}</Badge>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : t("noData")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            {t("date")}
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-44" />
          </label>
          {isFetching ? (
            <Badge variant="secondary" className="mb-1 gap-2">
              <RefreshCw className="size-3.5 animate-spin" />
              {t("refreshing")}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">{t("generatedAt", { value: formatDateTime(dashboard.generatedAt) })}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 size-4" />
            {t("refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <WidgetGrid dashboard={dashboard} />
        <PersonalLeaveBalance balance={dashboard.currentAnnualLeaveBalance} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <OperationalQueue dashboard={dashboard} />
        <AttendanceExceptions dashboard={dashboard} />
      </div>

      <AttendanceReportingDiscipline dashboard={dashboard} />

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <PeopleStatus dashboard={dashboard} />
        <LeaveStatus dashboard={dashboard} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <DeviceStatus dashboard={dashboard} />
        <SynchronizationStatus dashboard={dashboard} />
      </div>
    </div>
  )
}

function WidgetGrid({ dashboard }: { dashboard: HrDashboardSummary }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(Object.entries(dashboard.widgets) as Array<[WidgetKey, HrDashboardWidget]>).map(([key, widget]) => (
        <WidgetCard key={key} widgetKey={key} widget={widget} />
      ))}
    </div>
  )
}

function WidgetCard({ widgetKey, widget }: { widgetKey: WidgetKey; widget: HrDashboardWidget }) {
  const t = useTranslations("hrDashboard")
  const meta = widgetMeta[widgetKey]
  const Icon = meta.icon

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-md", meta.tone)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-muted-foreground">{t(meta.labelKey)}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{widget.count}</p>
        </div>
        <Button variant="ghost" size="icon" asChild>
          <Link href={widget.href as any} aria-label={t(meta.labelKey)}>
            <RefreshCw className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function PersonalLeaveBalance({ balance }: { balance: LeaveBalance | null }) {
  const t = useTranslations("hrDashboard")

  return (
    <Card>
      <CardContent className="flex h-full min-h-36 flex-col justify-between gap-4 p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-teal-700 text-white">
            <WalletCards className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{t("myLeaveBalance")}</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              {balance ? formatDays(balance.available) : t("notAvailable")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">{t("usedLeave")}</p>
            <p className="font-medium text-foreground">{balance ? formatDays(balance.used) : "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">{t("fiscalYear")}</p>
            <p className="truncate font-medium text-foreground">{balance?.fiscalYear?.name ?? "-"}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function OperationalQueue({ dashboard }: { dashboard: HrDashboardSummary }) {
  const t = useTranslations("hrDashboard")
  const rows = [
    ...dashboard.details.pendingManualRequests.map((request) => ({
      id: `manual-${request.id}`,
      employee: request.employee ?? null,
      type: t("pendingManualRequests"),
      date: request.createdAt,
      note: request.reason,
    })),
    ...dashboard.details.pendingLeaveRequests.map((request) => ({
      id: `leave-${request.id}`,
      employee: request.employee ?? null,
      type: t("pendingLeaveRequests"),
      date: request.createdAt,
      note: request.reason,
    })),
    ...dashboard.details.returnedCorrections.map((request) => ({
      id: `returned-${request.id}`,
      employee: request.employee ?? null,
      type: t("recentReturnedCorrections"),
      date: request.rejectedAt ?? request.updatedAt,
      note: request.rejectionReason ?? request.reason,
    })),
  ].slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("openItems")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <DataTable emptyLabel={t("noRows")}>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="min-w-48 font-medium">{formatEmployeeName(row.employee)}</TableCell>
              <TableCell className="min-w-44">{row.type}</TableCell>
              <TableCell className="min-w-36 text-muted-foreground">{formatDateTime(row.date)}</TableCell>
              <TableCell className="min-w-64 text-muted-foreground">{row.note}</TableCell>
            </TableRow>
          ))}
        </DataTable>
      </CardContent>
    </Card>
  )
}

function AttendanceExceptions({ dashboard }: { dashboard: HrDashboardSummary }) {
  const t = useTranslations("hrDashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("attendanceExceptions")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {dashboard.details.attendanceExceptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noAlerts")}</p>
        ) : dashboard.details.attendanceExceptions.map((item) => (
          <AlertRow key={item.id} severity={item.severity} title={`${item.title}: ${item.count}`} description={item.description} />
        ))}
      </CardContent>
    </Card>
  )
}

function AttendanceReportingDiscipline({ dashboard }: { dashboard: HrDashboardSummary }) {
  const t = useTranslations("hrDashboard")
  const summary = dashboard.attendanceReportingDiscipline
  const items = [
    [t("supervisorReportingRate"), `${summary.reportingRate}%`, t("supervisorReportingRateDescription")],
    [t("supervisorCorrectionRate"), `${summary.correctionRate}%`, t("supervisorCorrectionRateDescription")],
    [t("hrReadyRate"), `${summary.hrReadyRate}%`, t("hrReadyRateDescription")],
    [t("returnedRecords"), summary.returnedRecords, t("returnedRecordsDescription")],
  ]

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("attendanceReportingDiscipline")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {items.map(([label, value, description]) => (
            <div key={label} className="rounded-md border border-border p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <SimpleTable
            headers={[t("department"), t("records"), t("reportedToHr"), t("correctedBeforeHr"), t("hrReady"), t("correctionRate")]}
            emptyLabel={t("noRows")}
          >
            {summary.departmentBreakdown.slice(0, 10).map((department) => (
              <TableRow key={department.departmentId ?? department.department}>
                <TableCell className="min-w-52 font-medium">{department.department}</TableCell>
                <TableCell className="min-w-24">{department.totalRecords}</TableCell>
                <TableCell className="min-w-36">{department.reportedRecords} <span className="text-muted-foreground">({department.reportingRate}%)</span></TableCell>
                <TableCell className="min-w-36">{department.adjustedRecords}</TableCell>
                <TableCell className="min-w-36">{department.hrApprovedRecords} <span className="text-muted-foreground">({department.hrReadyRate}%)</span></TableCell>
                <TableCell className="min-w-28">{department.correctionRate}%</TableCell>
              </TableRow>
            ))}
          </SimpleTable>
        </div>
      </CardContent>
    </Card>
  )
}

function PeopleStatus({ dashboard }: { dashboard: HrDashboardSummary }) {
  const t = useTranslations("hrDashboard")
  const rows = [
    ...dashboard.details.employeesWithoutPunch.map((employee) => ({ id: `without-${employee.id}`, employee, status: t("employeesWithoutPunch") })),
    ...dashboard.details.missingCheckoutEmployees.map((employee) => ({ id: `checkout-${employee.id}`, employee, status: t("missingCheckout") })),
    ...dashboard.details.lateEmployees.map((employee) => ({ id: `late-${employee.id}`, employee, status: t("lateEmployees") })),
  ].slice(0, 12)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("people")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <SimpleTable headers={[t("employee"), t("department"), t("status")]} emptyLabel={t("noRows")}>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="min-w-52 font-medium">{formatEmployeeName(row.employee)}</TableCell>
              <TableCell className="min-w-44 text-muted-foreground">{formatDepartment(row.employee)}</TableCell>
              <TableCell className="min-w-44"><Badge variant="secondary">{row.status}</Badge></TableCell>
            </TableRow>
          ))}
        </SimpleTable>
      </CardContent>
    </Card>
  )
}

function LeaveStatus({ dashboard }: { dashboard: HrDashboardSummary }) {
  const t = useTranslations("hrDashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("upcomingLeave")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <SimpleTable headers={[t("employee"), t("leaveDates"), t("status")]} emptyLabel={t("noRows")}>
          {dashboard.details.upcomingLeave.slice(0, 10).map((request) => (
            <TableRow key={request.id}>
              <TableCell className="min-w-52 font-medium">{formatEmployeeName(request.employee ?? null)}</TableCell>
              <TableCell className="min-w-44 text-muted-foreground">{request.startDate} - {request.endDate}</TableCell>
              <TableCell className="min-w-36"><Badge variant="secondary">{request.leaveType?.nameEn ?? request.status}</Badge></TableCell>
            </TableRow>
          ))}
          {dashboard.details.employeesNearLeaveExpiry.slice(0, 10).map((balance) => (
            <TableRow key={`balance-${balance.id}`}>
              <TableCell className="min-w-52 font-medium">{formatEmployeeName(balance.employee ?? null)}</TableCell>
              <TableCell className="min-w-44 text-muted-foreground">{balance.fiscalYear?.endsAt ?? "-"}</TableCell>
              <TableCell className="min-w-36"><Badge>{t("available")}: {balance.available}</Badge></TableCell>
            </TableRow>
          ))}
        </SimpleTable>
      </CardContent>
    </Card>
  )
}

function DeviceStatus({ dashboard }: { dashboard: HrDashboardSummary }) {
  const t = useTranslations("hrDashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("offlineDevices")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <SimpleTable headers={[t("device"), t("status"), t("lastSeen")]} emptyLabel={t("noRows")}>
          {dashboard.details.devicesOffline.map((device) => (
            <TableRow key={device.id}>
              <TableCell className="min-w-52 font-medium">{device.deviceName}</TableCell>
              <TableCell><Badge variant="destructive">{device.healthStatus}</Badge></TableCell>
              <TableCell className="min-w-36 text-muted-foreground">{formatDateTime(device.lastSeenAt)}</TableCell>
            </TableRow>
          ))}
        </SimpleTable>
      </CardContent>
    </Card>
  )
}

function SynchronizationStatus({ dashboard }: { dashboard: HrDashboardSummary }) {
  const t = useTranslations("hrDashboard")
  const counts = dashboard.details.synchronizationStatus.counts

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("syncStatus")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            [t("started"), counts.started, "text-blue-700"],
            [t("completed"), counts.completed, "text-emerald-700"],
            [t("failed"), counts.failed, "text-rose-700"],
            [t("partial"), counts.partial, "text-amber-700"],
          ].map(([label, value, className]) => (
            <div key={label} className="rounded-md border border-border p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
              <p className={cn("mt-1 text-2xl font-semibold", className)}>{value}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <SimpleTable headers={[t("device"), t("status"), t("records")]} emptyLabel={t("noRows")}>
            {dashboard.details.synchronizationStatus.recent.slice(0, 8).map((batch) => (
              <TableRow key={batch.id}>
                <TableCell className="min-w-52 font-medium">{batch.device?.deviceName ?? "-"}</TableCell>
                <TableCell><StatusBadge status={batch.syncStatus} /></TableCell>
                <TableCell className="min-w-36 text-muted-foreground">{batch.successfulRecords}/{batch.totalRecords}</TableCell>
              </TableRow>
            ))}
          </SimpleTable>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertRow({ severity, title, description }: { severity: HrDashboardSeverity; title: string; description: string }) {
  const iconClass = severity === "critical"
    ? "bg-destructive text-destructive-foreground"
    : severity === "warning"
      ? "bg-amber-500 text-white"
      : "bg-primary text-primary-foreground"

  return (
    <div className="flex gap-3 rounded-md border border-border p-3">
      <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md", iconClass)}>
        {severity === "critical" ? <ShieldAlert className="size-4" /> : severity === "warning" ? <AlertTriangle className="size-4" /> : <HeartPulse className="size-4" />}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const variant = status === "FAILED" ? "destructive" : status === "COMPLETED" ? "secondary" : "outline"
  return <Badge variant={variant}>{status}</Badge>
}

function DataTable({ children, emptyLabel }: { children: React.ReactNode; emptyLabel: string }) {
  const t = useTranslations("hrDashboard")
  const rows = React.Children.toArray(children)

  return (
    <SimpleTable headers={[t("employee"), t("status"), t("requestedAt"), t("reason")]} emptyLabel={emptyLabel}>
      {rows}
    </SimpleTable>
  )
}

function SimpleTable({ headers, emptyLabel, children }: { headers: string[]; emptyLabel: string; children: React.ReactNode }) {
  const rows = React.Children.toArray(children).filter(Boolean)

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {headers.map((header) => (
            <TableHead key={header}>{header}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={headers.length} className="h-24 text-center text-muted-foreground">
              {emptyLabel}
            </TableCell>
          </TableRow>
        ) : rows}
      </TableBody>
    </Table>
  )
}

function HrDashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 12 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function formatEmployeeName(employee: Employee | null | undefined) {
  if (!employee) return "-"
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(" ")
}

function formatDepartment(employee: Employee | null | undefined) {
  return employee?.department?.nameEn ?? employee?.sourceDepartmentName ?? "-"
}

function formatDays(value: string | number | null | undefined) {
  if (value == null) return "-"
  const amount = Number(value)
  if (!Number.isFinite(amount)) return String(value)
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(amount)
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
