"use client"

import * as React from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DoorOpen,
  HeartPulse,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  UsersRound,
} from "lucide-react"
import { useTranslations } from "next-intl"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useExecutiveDashboardSummary } from "@/data/hooks/core.hooks"
import type { ExecutiveDashboardSeverity, ExecutiveDashboardSummary } from "@/data/types/core.types"
import { cn } from "@/lib/utils"

const distributionColors = ["#1f8a70", "#4f46e5", "#dc2626", "#f59e0b", "#0e7490"]

const distributionChartConfig = {
  count: { label: "Count" },
} satisfies ChartConfig

const rankingChartConfig = {
  attendanceRate: { label: "Attendance %", color: "#1f8a70" },
} satisfies ChartConfig

const timelineChartConfig = {
  count: { label: "Punches", color: "#2563eb" },
} satisfies ChartConfig

const trendChartConfig = {
  attendanceRate: { label: "Attendance %", color: "#7c3aed" },
} satisfies ChartConfig

export default function ExecutiveDashboardPage() {
  const t = useTranslations("executiveDashboard")
  const [date, setDate] = React.useState(todayInput())
  const [month, setMonth] = React.useState(todayInput().slice(0, 7))
  const { data, isLoading, isFetching, isError, error, refetch } = useExecutiveDashboardSummary({ date, month })
  const dashboard = data?.executiveDashboard

  if (isLoading) return <ExecutiveDashboardSkeleton />

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
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            {t("month")}
            <Input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="w-44" />
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

      <KpiGrid dashboard={dashboard} />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <WorkforceDistribution dashboard={dashboard} />
        <DepartmentRanking dashboard={dashboard} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <CompoundStatus dashboard={dashboard} />
        <LiveTimeline dashboard={dashboard} />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <LeaveAndHrSummary dashboard={dashboard} />
        <DepartmentPerformance dashboard={dashboard} />
      </div>

      <AttendanceReportingDiscipline dashboard={dashboard} />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <MonthlyTrend dashboard={dashboard} />
        <AlertsPanel dashboard={dashboard} />
      </div>
    </div>
  )
}

function KpiGrid({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const items = [
    { label: t("totalEmployees"), value: dashboard.workforceStatus.totalEmployees, icon: UsersRound, tone: "bg-slate-900 text-white" },
    { label: t("presentToday"), value: dashboard.workforceStatus.presentToday, icon: CheckCircle2, tone: "bg-emerald-600 text-white" },
    { label: t("absentToday"), value: dashboard.workforceStatus.absentToday, icon: AlertTriangle, tone: "bg-rose-600 text-white" },
    { label: t("onApprovedLeave"), value: dashboard.workforceStatus.onApprovedLeave, icon: CalendarClock, tone: "bg-indigo-600 text-white" },
    { label: t("lateArrivals"), value: dashboard.workforceStatus.lateArrivals, icon: Clock3, tone: "bg-amber-500 text-white" },
    { label: t("workingRemotely"), value: dashboard.workforceStatus.workingRemotely, icon: BriefcaseBusiness, tone: "bg-cyan-700 text-white" },
    { label: t("officialAssignment"), value: dashboard.workforceStatus.officialAssignment, icon: Building2, tone: "bg-teal-700 text-white" },
    { label: t("attendanceRate"), value: `${dashboard.workforceStatus.attendanceRate}%`, icon: TrendingUp, tone: "bg-violet-700 text-white" },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex items-center gap-4 p-4">
            <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-md", item.tone)}>
              <item.icon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-muted-foreground">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function WorkforceDistribution({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("workforceDistribution")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <ChartContainer config={distributionChartConfig} className="min-h-64">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
            <Pie data={dashboard.workforceDistribution} dataKey="count" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2}>
              {dashboard.workforceDistribution.map((segment, index) => (
                <Cell key={segment.id} fill={distributionColors[index % distributionColors.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartContainer>
        <div className="grid content-center gap-2">
          {dashboard.workforceDistribution.map((segment, index) => (
            <div key={segment.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: distributionColors[index % distributionColors.length] }} />
                <span className="truncate text-sm font-medium text-foreground">{segment.label}</span>
              </div>
              <span className="text-sm text-muted-foreground">{segment.percentage}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DepartmentRanking({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const data = dashboard.departmentAttendanceRanking.slice(0, 6)

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("departmentAttendanceRanking")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={rankingChartConfig} className="min-h-72">
          <BarChart data={data} layout="vertical" margin={{ left: 12, right: 36 }}>
            <CartesianGrid horizontal={false} />
            <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
            <YAxis dataKey="department" type="category" width={120} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="attendanceRate" fill="var(--color-attendanceRate)" radius={4}>
              <LabelList dataKey="attendanceRate" position="right" formatter={(value) => `${value ?? 0}%`} />
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function CompoundStatus({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const items = [
    { label: t("currentlyInside"), value: dashboard.compoundStatus.currentlyInside, icon: DoorOpen },
    { label: t("checkedOut"), value: dashboard.compoundStatus.checkedOut, icon: CheckCircle2 },
    { label: t("notYetArrived"), value: dashboard.compoundStatus.notYetArrived, icon: Clock3 },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("compoundStatus")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-border p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <item.icon className="size-5" />
              </div>
              <span className="truncate text-sm font-medium text-foreground">{item.label}</span>
            </div>
            <span className="text-2xl font-semibold text-foreground">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function LiveTimeline({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("liveAttendanceTimeline")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={timelineChartConfig} className="min-h-72">
          <LineChart data={dashboard.liveAttendanceTimeline}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function LeaveAndHrSummary({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const hrItems = [
    [t("pendingHrApproval"), dashboard.hrPerformance.pendingHrApproval],
    [t("pendingLeaveApproval"), dashboard.hrPerformance.pendingLeaveApproval],
    [t("averageApprovalTime"), t("hours", { value: dashboard.hrPerformance.averageApprovalTimeHours })],
    [t("correctionsReturned"), dashboard.hrPerformance.correctionsReturned],
    [t("payrollReady"), `${dashboard.hrPerformance.payrollReadyPercent}%`],
  ]

  return (
    <div className="grid min-w-0 gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t("leaveSummary")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {dashboard.leaveSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
          ) : dashboard.leaveSummary.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span className="truncate text-sm font-medium text-foreground">{item.label}</span>
              <span className="text-xl font-semibold text-foreground">{item.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("hrPerformance")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {hrItems.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
              <span className="text-lg font-semibold text-foreground">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function DepartmentPerformance({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("departmentPerformance")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34%]">{t("department")}</TableHead>
              <TableHead className="w-[14%]">{t("attendanceRate")}</TableHead>
              <TableHead className="w-[16%]">{t("pendingApprovals")}</TableHead>
              <TableHead className="w-[14%]">{t("lateEmployees")}</TableHead>
              <TableHead className="w-[12%]">{t("leaveRate")}</TableHead>
              <TableHead className="w-[10%]">{t("trend")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dashboard.departmentPerformance.slice(0, 10).map((department) => (
              <TableRow key={department.departmentId ?? department.department}>
                <TableCell className="whitespace-normal break-words font-medium leading-5">{department.department}</TableCell>
                <TableCell>{department.attendanceRate}%</TableCell>
                <TableCell>{department.pendingApprovals}</TableCell>
                <TableCell>{department.lateEmployees}</TableCell>
                <TableCell>{department.leaveRate}%</TableCell>
                <TableCell>
                  <Badge variant={department.trend === "UP" ? "secondary" : "destructive"} className="gap-1">
                    {department.trend === "UP" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                    {department.trend}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function AttendanceReportingDiscipline({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const summary = dashboard.attendanceReportingDiscipline
  const items = [
    [t("supervisorReportingRate"), `${summary.reportingRate}%`, t("supervisorReportingRateDescription")],
    [t("supervisorCorrectionRate"), `${summary.correctionRate}%`, t("supervisorCorrectionRateDescription")],
    [t("hrReadyRate"), `${summary.hrReadyRate}%`, t("hrReadyRateDescription")],
    [t("adjustmentsLogged"), summary.adjustmentCount, t("adjustmentsLoggedDescription")],
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
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">{t("department")}</TableHead>
                <TableHead className="w-[13%]">{t("records")}</TableHead>
                <TableHead className="w-[15%]">{t("reportedToHr")}</TableHead>
                <TableHead className="w-[15%]">{t("correctedBeforeHr")}</TableHead>
                <TableHead className="w-[13%]">{t("hrReady")}</TableHead>
                <TableHead className="w-[14%]">{t("correctionRate")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.departmentBreakdown.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-sm text-muted-foreground">{t("noData")}</TableCell>
                </TableRow>
              ) : summary.departmentBreakdown.slice(0, 10).map((department) => (
                <TableRow key={department.departmentId ?? department.department}>
                  <TableCell className="whitespace-normal break-words font-medium leading-5">{department.department}</TableCell>
                  <TableCell>{department.totalRecords}</TableCell>
                  <TableCell>{department.reportedRecords} <span className="text-muted-foreground">({department.reportingRate}%)</span></TableCell>
                  <TableCell>{department.adjustedRecords}</TableCell>
                  <TableCell>{department.hrApprovedRecords} <span className="text-muted-foreground">({department.hrReadyRate}%)</span></TableCell>
                  <TableCell>{department.correctionRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function MonthlyTrend({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("monthlyAttendanceTrend")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={trendChartConfig} className="min-h-72">
          <LineChart data={dashboard.monthlyAttendanceTrend}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="attendanceRate" type="monotone" stroke="var(--color-attendanceRate)" strokeWidth={2} dot />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function AlertsPanel({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t("deviceHealth")}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          {[
            [t("online"), dashboard.deviceHealth.online, "text-emerald-700"],
            [t("offline"), dashboard.deviceHealth.offline, "text-rose-700"],
            [t("error"), dashboard.deviceHealth.error, "text-amber-700"],
            [t("unknown"), dashboard.deviceHealth.unknown, "text-muted-foreground"],
          ].map(([label, value, className]) => (
            <div key={label} className="rounded-md border border-border p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
              <p className={cn("mt-1 text-2xl font-semibold", className)}>{value}</p>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("attendanceExceptions")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {dashboard.attendanceExceptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAlerts")}</p>
          ) : dashboard.attendanceExceptions.map((item) => (
            <AlertRow key={item.id} severity={item.severity} title={`${item.title}: ${item.count}`} description={item.description} />
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t("executiveAlerts")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {dashboard.executiveAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noAlerts")}</p>
          ) : dashboard.executiveAlerts.map((item) => (
            <AlertRow key={item.id} severity={item.severity} title={item.title} description={item.description} />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function AlertRow({ severity, title, description }: { severity: ExecutiveDashboardSeverity; title: string; description: string }) {
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

function ExecutiveDashboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex justify-between gap-3">
        <div className="flex gap-3">
          <Skeleton className="h-10 w-44" />
          <Skeleton className="h-10 w-44" />
        </div>
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
      <Skeleton className="h-96 rounded-xl" />
    </div>
  )
}

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function formatDateTime(value: string | null) {
  if (!value) return "-"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}
