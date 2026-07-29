"use client"

import * as React from "react"
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Fingerprint,
  RefreshCw,
  RotateCcw,
  WalletCards,
  UserX,
  UsersRound,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useDepartmentHeadDashboardSummary } from "@/data/hooks/core.hooks"
import type {
  AttendancePunch,
  DepartmentHeadDashboardSummary,
  DepartmentHeadDashboardWidget,
  Employee,
  LeaveBalance,
  LeaveRequest,
  ManualPunchRequest,
} from "@/data/types/core.types"
import { cn } from "@/lib/utils"

type WidgetKey = keyof DepartmentHeadDashboardSummary["widgets"]
type MessageKey =
  | "todaysStaff"
  | "present"
  | "absent"
  | "leave"
  | "late"
  | "pendingAttendance"
  | "pendingLeave"
  | "pendingCorrections"

const widgetMeta: Record<WidgetKey, { icon: React.ComponentType<{ className?: string }>; tone: string; labelKey: MessageKey }> = {
  todaysStaff: { icon: UsersRound, tone: "bg-slate-900 text-white", labelKey: "todaysStaff" },
  present: { icon: CheckCircle2, tone: "bg-emerald-700 text-white", labelKey: "present" },
  absent: { icon: UserX, tone: "bg-rose-600 text-white", labelKey: "absent" },
  leave: { icon: CalendarClock, tone: "bg-indigo-600 text-white", labelKey: "leave" },
  late: { icon: Clock3, tone: "bg-amber-500 text-white", labelKey: "late" },
  pendingAttendance: { icon: Fingerprint, tone: "bg-cyan-700 text-white", labelKey: "pendingAttendance" },
  pendingLeave: { icon: ClipboardList, tone: "bg-violet-700 text-white", labelKey: "pendingLeave" },
  pendingCorrections: { icon: RotateCcw, tone: "bg-orange-600 text-white", labelKey: "pendingCorrections" },
}

export default function DepartmentHeadDashboardPage() {
  const t = useTranslations("departmentHeadDashboard")
  const [date, setDate] = React.useState(todayInput())
  const { data, isLoading, isFetching, isError, error, refetch } = useDepartmentHeadDashboardSummary({ date })
  const dashboard = data?.departmentHeadDashboard

  if (isLoading) return <DepartmentHeadDashboardSkeleton />

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
          <Badge variant="outline" className="mb-1">
            {dashboard.department?.nameEn ?? t("department")}
          </Badge>
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
        <WidgetGrid widgets={dashboard.widgets} />
        <PersonalLeaveBalance balance={dashboard.currentAnnualLeaveBalance} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <AttendanceSnapshot dashboard={dashboard} />
        <PendingWork dashboard={dashboard} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <StaffStatus title={t("staffOnLeave")} employees={dashboard.details.employeesOnLeave.map((request) => request.employee).filter(Boolean) as Employee[]} />
        <StaffStatus title={t("lateEmployees")} employees={dashboard.details.lateEmployees} />
      </div>
    </div>
  )
}

function WidgetGrid({ widgets }: { widgets: DepartmentHeadDashboardSummary["widgets"] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {(Object.entries(widgets) as Array<[WidgetKey, DepartmentHeadDashboardWidget]>).map(([key, widget]) => (
        <WidgetCard key={key} widgetKey={key} widget={widget} />
      ))}
    </div>
  )
}

function WidgetCard({ widgetKey, widget }: { widgetKey: WidgetKey; widget: DepartmentHeadDashboardWidget }) {
  const t = useTranslations("departmentHeadDashboard")
  const meta = widgetMeta[widgetKey]
  const Icon = meta.icon

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-md", meta.tone)}>
          <Icon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-muted-foreground">{t(meta.labelKey)}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{widget.count}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function PersonalLeaveBalance({ balance }: { balance: LeaveBalance | null }) {
  const t = useTranslations("departmentHeadDashboard")

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

function AttendanceSnapshot({ dashboard }: { dashboard: DepartmentHeadDashboardSummary }) {
  const t = useTranslations("departmentHeadDashboard")
  const rows = [
    ...dashboard.details.presentEmployees.map((employee) => ({ id: `present-${employee.id}`, employee, status: t("present") })),
    ...dashboard.details.absentEmployees.map((employee) => ({ id: `absent-${employee.id}`, employee, status: t("absent") })),
  ].slice(0, 12)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("attendanceSnapshot")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <SimpleTable headers={[t("employee"), t("department"), t("status")]} emptyLabel={t("noRows")}>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="min-w-52 font-medium">{formatEmployeeName(row.employee)}</TableCell>
              <TableCell className="min-w-44 text-muted-foreground">{formatDepartment(row.employee)}</TableCell>
              <TableCell><StatusBadge status={row.status} /></TableCell>
            </TableRow>
          ))}
        </SimpleTable>
      </CardContent>
    </Card>
  )
}

function PendingWork({ dashboard }: { dashboard: DepartmentHeadDashboardSummary }) {
  const t = useTranslations("departmentHeadDashboard")
  const rows = [
    ...dashboard.details.pendingAttendance.map((punch) => ({
      id: `attendance-${punch.id}`,
      employee: punch.employee ?? null,
      type: t("pendingAttendance"),
      date: punch.punchTime,
      note: punch.device?.deviceName ?? punch.biometricId,
    })),
    ...dashboard.details.pendingLeave.map((request) => ({
      id: `leave-${request.id}`,
      employee: request.employee ?? null,
      type: t("pendingLeave"),
      date: request.createdAt,
      note: formatLeaveDates(request),
    })),
    ...dashboard.details.pendingCorrections.map((request) => ({
      id: `correction-${request.id}`,
      employee: request.employee ?? null,
      type: t("pendingCorrections"),
      date: request.createdAt,
      note: request.reason,
    })),
  ].slice(0, 12)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("pendingWork")}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <SimpleTable headers={[t("employee"), t("status"), t("requestedAt"), t("reason")]} emptyLabel={t("noRows")}>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="min-w-52 font-medium">{formatEmployeeName(row.employee)}</TableCell>
              <TableCell className="min-w-44"><StatusBadge status={row.type} /></TableCell>
              <TableCell className="min-w-36 text-muted-foreground">{formatDateTime(row.date)}</TableCell>
              <TableCell className="min-w-56 text-muted-foreground">{row.note}</TableCell>
            </TableRow>
          ))}
        </SimpleTable>
      </CardContent>
    </Card>
  )
}

function StaffStatus({ title, employees }: { title: string; employees: Employee[] }) {
  const t = useTranslations("departmentHeadDashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <SimpleTable headers={[t("employee"), t("department"), t("status")]} emptyLabel={t("noRows")}>
          {employees.slice(0, 12).map((employee) => (
            <TableRow key={employee.id}>
              <TableCell className="min-w-52 font-medium">{formatEmployeeName(employee)}</TableCell>
              <TableCell className="min-w-44 text-muted-foreground">{formatDepartment(employee)}</TableCell>
              <TableCell><StatusBadge status={title} /></TableCell>
            </TableRow>
          ))}
        </SimpleTable>
      </CardContent>
    </Card>
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

function StatusBadge({ status }: { status: string }) {
  const isProblem = status.toLowerCase().includes("absent")
    || status.toLowerCase().includes("pending")
    || status.toLowerCase().includes("late")

  return (
    <Badge variant={isProblem ? "secondary" : "outline"} className="gap-1">
      {isProblem ? <AlertTriangle className="size-3" /> : <CheckCircle2 className="size-3" />}
      {status}
    </Badge>
  )
}

function DepartmentHeadDashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex justify-between gap-3">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
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

function formatEmployeeName(employee: Employee | AttendancePunch["employee"] | ManualPunchRequest["employee"] | LeaveRequest["employee"] | null | undefined) {
  if (!employee) return "-"
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(" ")
}

function formatDepartment(employee: Employee | null | undefined) {
  return employee?.department?.nameEn ?? employee?.sourceDepartmentName ?? "-"
}

function formatLeaveDates(request: LeaveRequest) {
  return `${request.startDate} - ${request.endDate}`
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
