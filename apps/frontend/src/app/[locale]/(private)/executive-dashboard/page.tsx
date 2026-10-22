"use client"

import * as React from "react"
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock3,
  DoorOpen,
  HeartPulse,
  Maximize2,
  RefreshCw,
  ShieldAlert,
  Timer,
  TrendingUp,
  UsersRound,
  X,
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
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { CalendarDateField } from "@/components/calendar/calendar-date-field"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardDataQualityNotice, DashboardDepartmentFilter, addisTodayInput } from "@/components/dashboard/dashboard-shared"
import { useExecutiveDashboardSummary } from "@/data/hooks/core.hooks"
import type { ExecutiveDashboardSeverity, ExecutiveDashboardSummary, ExecutiveDashboardTrend } from "@/data/types/core.types"
import { useEmployeeName } from "@/lib/employee-name"
import { cn } from "@/lib/utils"
import { useCalendarPreference } from "@/providers/CalendarPreferenceProvider"

type ExecutiveDashboardPeriod = "day" | "week" | "month"

// One colour per distribution status so a segment keeps its colour when others are absent.
const distributionColors: Record<string, string> = {
  onTime: "#1f8a70",
  late: "#f59e0b",
  leave: "#4f46e5",
  officialDuty: "#0e7490",
  absent: "#dc2626",
  notYetArrived: "#94a3b8",
  exempt: "#16a34a",
  rest: "#cbd5e1",
  noSchedule: "#a855f7",
  notGenerated: "#78716c",
}

const distributionChartConfig = { count: { label: "Count" } } satisfies ChartConfig
const rankingChartConfig = { attendanceRate: { label: "Attendance %", color: "#1f8a70" } } satisfies ChartConfig
const timelineChartConfig = {
  arrivals: { label: "Arrivals", color: "#1f8a70" },
  count: { label: "All punches", color: "#2563eb" },
} satisfies ChartConfig
const trendChartConfig = { attendanceRate: { label: "Attendance %", color: "#7c3aed" } } satisfies ChartConfig
// Validated pair (light and dark): the usual-day line is also dashed, so it never relies on colour alone.
const arrivalColors = {
  focus: { light: "#1f8a70", dark: "#2aa384" },
  typical: { light: "#2563eb", dark: "#6b8ff0" },
}
const weekdayChartConfig = { lateRate: { label: "Late %", color: "#d97706" } } satisfies ChartConfig

type DrillKind = "present" | "absent" | "late"

export default function ExecutiveDashboardPage() {
  const t = useTranslations("executiveDashboard")
  const { formatDate, formatDateTime } = useCalendarPreference()
  const [date, setDate] = React.useState(todayInput())
  const [month, setMonth] = React.useState(todayInput().slice(0, 7))
  const [period, setPeriod] = React.useState<ExecutiveDashboardPeriod>("day")
  const [departmentId, setDepartmentId] = React.useState<string | undefined>(undefined)
  const [drill, setDrill] = React.useState<DrillKind | null>(null)
  const [wallScreen, setWallScreen] = React.useState(false)
  const { data, isLoading, isFetching, isError, error, refetch } = useExecutiveDashboardSummary({ date, month, period, departmentId })
  const dashboard = data?.executiveDashboard
  const handlePeriodChange = (value: ExecutiveDashboardPeriod) => {
    const today = todayInput()
    setPeriod(value)
    setDate(today)
    setMonth(today.slice(0, 7))
  }

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

  const coverage = dashboard.dateFrom === dashboard.dateTo
    ? formatDate(dashboard.dateFrom)
    : `${formatDate(dashboard.dateFrom)} – ${formatDate(dashboard.dateTo)}`

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap">
          <label className="grid min-w-0 gap-1.5 text-sm font-medium text-foreground">
            {t("period")}
            <Select value={period} onValueChange={(value) => handlePeriodChange(value as ExecutiveDashboardPeriod)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">{t("day")}</SelectItem>
                <SelectItem value="week">{t("week")}</SelectItem>
                <SelectItem value="month">{t("monthPeriod")}</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {period === "month" ? (
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-foreground">
              {t("month")}
              <Input type="month" value={month} max={todayInput().slice(0, 7)} onChange={(event) => event.target.value && setMonth(event.target.value)} className="w-full sm:w-44" />
            </label>
          ) : (
            <label className="grid min-w-0 gap-1.5 text-sm font-medium text-foreground">
              {period === "week" ? t("weekContaining") : t("date")}
              <CalendarDateField value={date} onChange={(value) => { setDate(value); setMonth(value.slice(0, 7)) }} className="w-full sm:w-44" />
            </label>
          )}
          <label className="col-span-2 grid min-w-0 gap-1.5 text-sm font-medium text-foreground sm:col-span-1">
            {t("department")}
            <DashboardDepartmentFilter departments={dashboard.departments} value={departmentId} onChange={setDepartmentId} />
          </label>
          {isFetching ? (
            <Badge variant="secondary" className="mb-1 gap-2">
              <RefreshCw className="size-3.5 animate-spin" />
              {t("refreshing")}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-muted-foreground">{t("generatedAt", { value: formatDateTime(dashboard.generatedAt) })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setWallScreen(true)}>
              <Maximize2 className="mr-2 size-4" />
              {t("wallScreen")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="mr-2 size-4" />
              {t("refresh")}
            </Button>
          </div>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {t("showing", { range: coverage, scope: dashboard.scope.departmentName ?? t("allDepartments") })}
        {dashboard.scope.departmentName && dashboard.scope.departmentCount > 1 ? ` ${t("includingSubDepartments", { count: dashboard.scope.departmentCount - 1 })}` : ""}
      </p>

      <DashboardDataQualityNotice dataQuality={dashboard.dataQuality} isLive={dashboard.isLive} />

      <Headline dashboard={dashboard} />

      <KpiGrid dashboard={dashboard} onDrill={setDrill} />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ArrivalCurve dashboard={dashboard} />
        <LostTime dashboard={dashboard} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DepartmentMovers dashboard={dashboard} onSelect={setDepartmentId} />
        <WeekdayLateness dashboard={dashboard} />
      </div>

      <RepeatCases dashboard={dashboard} />

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <WorkforceDistribution dashboard={dashboard} />
        <DepartmentRanking dashboard={dashboard} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <CompoundStatus dashboard={dashboard} />
        <LiveTimeline dashboard={dashboard} />
      </div>

      <DepartmentPerformance dashboard={dashboard} onSelect={setDepartmentId} />

      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <LeaveSummary dashboard={dashboard} />
        <HrPerformance dashboard={dashboard} />
      </div>

      <AttendanceReportingDiscipline dashboard={dashboard} />

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <MonthlyTrend dashboard={dashboard} />
        <AlertsPanel dashboard={dashboard} />
      </div>

      <DrillDownDialog dashboard={dashboard} kind={drill} onClose={() => setDrill(null)} />
      {wallScreen ? <WallScreen dashboard={dashboard} onExit={() => setWallScreen(false)} /> : null}
    </div>
  )
}

function KpiGrid({ dashboard, onDrill }: { dashboard: ExecutiveDashboardSummary; onDrill: (kind: DrillKind) => void }) {
  const t = useTranslations("executiveDashboard")
  const status = dashboard.workforceStatus
  const { current, comparison } = dashboard.insights
  const comparedWith = useComparisonLabel(dashboard)
  const multiDay = dashboard.dateFrom !== dashboard.dateTo
  const label = (key: string) => t(multiDay ? `${key}Days` : key)
  const lateHint = current.lateRate === null
    ? null
    : current.averageLateMinutes === null
      ? t("lateShareHintNoAverage", { rate: current.lateRate })
      : t("lateShareHint", { rate: current.lateRate, minutes: current.averageLateMinutes })
  const items: Array<{
    label: string
    value: React.ReactNode
    icon: React.ComponentType<{ className?: string }>
    tone: string
    hints: Array<string | null>
    change?: { points: number | null; goodWhenUp: boolean }
    trend?: ExecutiveDashboardTrend
    drill?: DrillKind
  }> = [
    { label: t("totalEmployees"), value: status.totalEmployees, icon: UsersRound, tone: "bg-slate-900 text-white", hints: [status.indefinitelyAbsent ? t("indefinitelyAbsentHint", { count: status.indefinitelyAbsent }) : null] },
    {
      label: label("present"),
      value: status.presentToday,
      icon: CheckCircle2,
      tone: "bg-emerald-600 text-white",
      hints: [current.attendanceRate !== null ? t("shareOfDueHint", { rate: current.attendanceRate }) : null],
      change: { points: pointChange(current.attendanceRate, comparison?.attendanceRate), goodWhenUp: true },
      drill: "present",
    },
    {
      label: label("absent"),
      value: status.absentToday,
      icon: AlertTriangle,
      tone: "bg-rose-600 text-white",
      hints: [
        current.absenceRate !== null ? t("shareOfDueHint", { rate: current.absenceRate }) : null,
        dashboard.isLive && status.notYetArrived ? t("notYetArrivedHint", { count: status.notYetArrived }) : null,
      ],
      change: { points: pointChange(current.absenceRate, comparison?.absenceRate), goodWhenUp: false },
      drill: "absent",
    },
    { label: label("onLeave"), value: status.onApprovedLeave, icon: CalendarClock, tone: "bg-indigo-600 text-white", hints: [] },
    {
      label: label("late"),
      value: status.lateArrivals,
      icon: Clock3,
      tone: "bg-amber-500 text-white",
      hints: [lateHint],
      change: { points: pointChange(current.lateRate, comparison?.lateRate), goodWhenUp: false },
      drill: "late",
    },
    { label: label("remote"), value: status.workingRemotely, icon: BriefcaseBusiness, tone: "bg-cyan-700 text-white", hints: [] },
    { label: label("officialDuty"), value: status.officialAssignment, icon: Building2, tone: "bg-teal-700 text-white", hints: [] },
    {
      label: t("attendanceRate"),
      value: status.presentToday + status.absentToday > 0 ? `${status.attendanceRate}%` : "—",
      icon: TrendingUp,
      tone: "bg-violet-700 text-white",
      hints: [status.previousAttendanceRate !== null && comparedWith ? t("comparisonValueHint", { comparison: comparedWith, value: status.previousAttendanceRate }) : null],
      trend: status.attendanceTrend,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
      {items.map((item) => {
        const content = (
          <CardContent className="flex min-w-0 items-center gap-2 px-3 sm:gap-4 sm:px-4">
            <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-md sm:size-11", item.tone)}>
              <item.icon className="size-4 sm:size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium leading-tight text-muted-foreground sm:text-sm">{item.label}</p>
              <p className="mt-1 flex items-center gap-1.5 break-words text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {item.value}
                {item.trend !== undefined ? <TrendIcon trend={item.trend} /> : null}
              </p>
              {item.hints.filter(Boolean).map((hint) => (
                <p key={hint} className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{hint}</p>
              ))}
              {item.change && item.change.points !== null && comparedWith ? (
                <PointChange points={item.change.points} goodWhenUp={item.change.goodWhenUp} comparedWith={comparedWith} />
              ) : null}
            </div>
          </CardContent>
        )
        return (
          <Card key={item.label} className={cn("min-w-0 gap-3 py-3 sm:gap-6 sm:py-6", item.drill && "transition-colors hover:bg-accent/50")}>
            {item.drill ? (
              <button type="button" className="w-full cursor-pointer text-left" onClick={() => onDrill(item.drill!)} title={t("showBreakdown")}>
                {content}
              </button>
            ) : content}
          </Card>
        )
      })}
    </div>
  )
}

/** "▲ 3.1 pts vs Tue at the same time"; green when the move is good, red when bad. */
function PointChange({ points, goodWhenUp, comparedWith, className }: { points: number; goodWhenUp: boolean; comparedWith: string; className?: string }) {
  const t = useTranslations("executiveDashboard")
  const good = points === 0 ? null : (points > 0) === goodWhenUp
  const Icon = points > 0 ? ArrowUp : points < 0 ? ArrowDown : ArrowRight
  return (
    <p className={cn("mt-0.5 flex flex-wrap items-center gap-1 text-[11px] leading-tight text-muted-foreground", className)}>
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", good === true && "text-emerald-700 dark:text-emerald-400", good === false && "text-rose-700 dark:text-rose-400")}>
        <Icon className="size-3" aria-hidden="true" />
        {t("pointsChange", { points: Math.abs(points) })}
      </span>
      <span>{t("vsComparison", { comparison: comparedWith })}</span>
    </p>
  )
}

/** One-paragraph summary of the figures above, for a reader who only has a few seconds. */
function Headline({ dashboard, textClassName }: { dashboard: ExecutiveDashboardSummary; textClassName?: string }) {
  const t = useTranslations("executiveDashboard")
  const { formatDate } = useCalendarPreference()
  const comparedWith = useComparisonLabel(dashboard)
  const { current, comparison, lowestDepartment } = dashboard.insights
  const sentences: string[] = []

  if (current.attendanceRate === null) {
    sentences.push(t("headlineNoneDue"))
  } else {
    if (dashboard.period === "day" && dashboard.isLive) sentences.push(t("headlineLive", { time: addisClock(dashboard.generatedAt), rate: current.attendanceRate }))
    else if (dashboard.period === "day") sentences.push(t("headlineDay", { date: formatDate(dashboard.dateFrom), rate: current.attendanceRate }))
    else sentences.push(t("headlinePeriod", { range: `${formatDate(dashboard.dateFrom)} – ${formatDate(dashboard.dateTo)}`, rate: current.attendanceRate }))

    const change = pointChange(current.attendanceRate, comparison?.attendanceRate)
    if (change !== null && comparedWith) {
      if (change > 0) sentences.push(t("headlineUp", { points: change, comparison: comparedWith }))
      else if (change < 0) sentences.push(t("headlineDown", { points: Math.abs(change), comparison: comparedWith }))
      else sentences.push(t("headlineSame", { comparison: comparedWith }))
    }
    if (current.late > 0 && current.averageLateMinutes !== null) sentences.push(t("headlineLate", { count: current.late, minutes: current.averageLateMinutes }))
    if (lowestDepartment) sentences.push(t("headlineLowest", { department: lowestDepartment.department, rate: lowestDepartment.attendanceRate }))
  }

  return (
    <Card className="border-primary/20 bg-primary/5 py-4">
      <CardContent className={cn("px-4 text-sm leading-6 text-foreground sm:text-base", textClassName)}>
        {sentences.join(" ")}
      </CardContent>
    </Card>
  )
}

function ArrivalCurve({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const { formatDate } = useCalendarPreference()
  const curve = dashboard.insights.arrivalCurve
  const config = {
    focus: { label: dashboard.isLive ? t("arrivalToday") : formatDate(curve?.date ?? dashboard.focusDate), theme: arrivalColors.focus },
    typical: { label: t("arrivalTypical"), theme: arrivalColors.typical },
  } satisfies ChartConfig
  const shiftStartTick = curve?.shiftStart && curve.points.some((point) => point.time === curve.shiftStart) ? curve.shiftStart : null

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{dashboard.isLive ? t("arrivalCurve") : t("arrivalCurveOn", { date: formatDate(dashboard.focusDate) })}</CardTitle>
        <CardDescription>{t("arrivalCurveDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {!curve ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <>
            <ChartContainer config={config} className="min-h-60 sm:min-h-72">
              <LineChart data={curve.points} margin={{ left: 4, right: 12, top: 16 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={24} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} width={44} />
                <ChartTooltip content={<ChartTooltipContent formatter={percentTooltipRow(config)} />} />
                <ChartLegend content={<ChartLegendContent />} />
                {shiftStartTick ? (
                  <ReferenceLine x={shiftStartTick} stroke="var(--muted-foreground)" strokeDasharray="2 3" label={{ value: t("shiftStart", { time: shiftStartTick }), position: "insideTopLeft", fontSize: 11, fill: "var(--muted-foreground)" }} />
                ) : null}
                <Line dataKey="typical" type="monotone" stroke="var(--color-typical)" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls={false} />
                <Line dataKey="focus" type="monotone" stroke="var(--color-focus)" strokeWidth={2} dot={false} connectNulls={false} />
              </LineChart>
            </ChartContainer>
            <p className="text-xs text-muted-foreground">
              {curve.typicalDates.length ? t("arrivalTypicalNote", { count: curve.typicalDates.length }) : t("arrivalNoTypical")}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function LostTime({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const lost = dashboard.insights.lostTime
  const parts = [
    { label: t("lostLate"), hours: lost.lateHours, tone: "bg-amber-500" },
    { label: t("lostEarly"), hours: lost.earlyLeaveHours, tone: "bg-orange-600" },
    { label: t("lostMissed"), hours: lost.missedSessionHours, tone: "bg-rose-600" },
  ]
  const largest = Math.max(...parts.map((part) => part.hours), 0)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("lostTime")}</CardTitle>
        <CardDescription>{t("lostTimeDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-rose-600 text-white">
            <Timer className="size-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">{t("lostTotal")}</p>
            <p className="text-3xl font-semibold tracking-tight text-foreground">{t("lostHours", { value: lost.totalHours })}</p>
            {lost.equivalentWorkdays !== null && lost.workdayHours !== null ? (
              <p className="text-xs text-muted-foreground">{t("lostEquivalent", { days: lost.equivalentWorkdays, hours: lost.workdayHours })}</p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-3">
          {parts.map((part) => (
            <div key={part.label} className="grid gap-1">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{part.label}</span>
                <span className="font-semibold text-foreground">{t("lostHours", { value: part.hours })}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", part.tone)} style={{ width: largest > 0 ? `${(part.hours / largest) * 100}%` : "0%" }} />
              </div>
            </div>
          ))}
        </div>
        {dashboard.isLive ? <p className="text-xs text-muted-foreground">{t("lostTimeLiveNote")}</p> : null}
      </CardContent>
    </Card>
  )
}

function DepartmentMovers({ dashboard, onSelect }: { dashboard: ExecutiveDashboardSummary; onSelect?: (departmentId: string) => void }) {
  const t = useTranslations("executiveDashboard")
  const comparedWith = useComparisonLabel(dashboard)
  const { improved, declined } = dashboard.insights.departmentMovers
  const columns = [
    { title: t("mostImproved"), items: improved, Icon: ArrowUp, tone: "text-emerald-700 dark:text-emerald-400" },
    { title: t("mostDeclined"), items: declined, Icon: ArrowDown, tone: "text-rose-700 dark:text-rose-400" },
  ]

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("departmentMovers")}</CardTitle>
        <CardDescription>{comparedWith ? t("departmentMoversDescription", { comparison: comparedWith }) : t("noComparison")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {columns.map(({ title, items, Icon, tone }) => (
          <div key={title} className="grid content-start gap-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">{title}</p>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noMovers")}</p>
            ) : items.map((item) => (
              <button
                key={item.departmentId ?? item.department}
                type="button"
                disabled={!onSelect || !item.departmentId}
                onClick={() => item.departmentId && onSelect?.(item.departmentId)}
                title={onSelect && item.departmentId ? t("drillDown") : undefined}
                className="flex items-center justify-between gap-3 rounded-md border border-border p-3 text-left enabled:hover:bg-accent/50"
              >
                <span className="min-w-0">
                  <span className="block break-words text-sm font-medium leading-tight text-foreground">{item.department}</span>
                  <span className="text-xs text-muted-foreground">{item.comparisonRate}% → {item.attendanceRate}%</span>
                </span>
                <span className={cn("inline-flex shrink-0 items-center gap-0.5 text-sm font-semibold", tone)}>
                  <Icon className="size-3.5" aria-hidden="true" />
                  {t("pointsChange", { points: Math.abs(item.change) })}
                </span>
              </button>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function WeekdayLateness({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const { formatDate } = useCalendarPreference()
  const weekdays = dashboard.insights.weekdayLateness
  const data = weekdays.days.map((day) => ({ ...day, label: t(`weekday_${day.weekday}`) }))

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("weekdayLateness")}</CardTitle>
        <CardDescription>{t("weekdayLatenessDescription", { from: formatDate(weekdays.dateFrom), to: formatDate(weekdays.dateTo) })}</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <ChartContainer config={weekdayChartConfig} className="min-h-56 sm:min-h-64">
            <BarChart data={data} margin={{ top: 20, left: 4, right: 4 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} tickFormatter={(value: string) => value.slice(0, 3)} />
              <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} width={44} />
              <ChartTooltip
                content={(
                  <ChartTooltipContent
                    formatter={(_value, _name, item) => (
                      <div className="grid gap-0.5 text-xs">
                        <span className="font-medium text-foreground">{t("lateRateLabel")}: {item.payload.lateRate}%</span>
                        <span className="text-muted-foreground">{item.payload.late} / {item.payload.present}</span>
                        {item.payload.averageLateMinutes !== null ? (
                          <span className="text-muted-foreground">{t("averageLateMinutesValue", { minutes: item.payload.averageLateMinutes })}</span>
                        ) : null}
                      </div>
                    )}
                  />
                )}
              />
              <Bar dataKey="lateRate" fill="var(--color-lateRate)" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="lateRate" position="top" className="fill-foreground text-[11px]" formatter={(value) => `${value ?? 0}%`} />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function RepeatCases({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const { formatDate } = useCalendarPreference()
  const employeeName = useEmployeeName()
  const repeat = dashboard.insights.repeatCases

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("repeatCases")}</CardTitle>
        <CardDescription>
          {t("repeatCasesDescription", { from: formatDate(repeat.dateFrom), to: formatDate(repeat.dateTo), late: repeat.lateThreshold, absent: repeat.absentThreshold })}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid grid-cols-2 gap-2 sm:max-w-md sm:gap-3">
          <div className="rounded-md border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("repeatLate", { count: repeat.lateThreshold })}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{repeat.lateCount}</p>
          </div>
          <div className="rounded-md border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">{t("repeatAbsent", { count: repeat.absentThreshold })}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{repeat.absentCount}</p>
          </div>
        </div>
        {repeat.employees.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noRepeatCases")}</p>
        ) : (
          <div className="max-h-[24rem] overflow-auto">
            <Table className="min-w-[40rem] table-fixed">
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead className="w-[34%]">{t("employee")}</TableHead>
                  <TableHead className="w-[38%]">{t("department")}</TableHead>
                  <TableHead className="w-[14%]">{t("lateDaysShort")}</TableHead>
                  <TableHead className="w-[14%]">{t("absentDaysShort")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repeat.employees.map((entry) => (
                  <TableRow key={entry.employeeId}>
                    <TableCell className="whitespace-normal break-words font-medium leading-5">
                      {employeeName(entry.employee) || "—"}
                      {entry.employee ? <span className="block text-xs font-normal text-muted-foreground">{entry.employee.employeeCode}</span> : null}
                    </TableCell>
                    <TableCell className="whitespace-normal break-words leading-5">{entry.department}</TableCell>
                    <TableCell className={cn(entry.lateDays >= repeat.lateThreshold && "font-semibold text-amber-700 dark:text-amber-400")}>{entry.lateDays}</TableCell>
                    <TableCell className={cn(entry.absentDays >= repeat.absentThreshold && "font-semibold text-rose-700 dark:text-rose-400")}>{entry.absentDays}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DrillDownDialog({ dashboard, kind, onClose }: { dashboard: ExecutiveDashboardSummary; kind: DrillKind | null; onClose: () => void }) {
  const t = useTranslations("executiveDashboard")
  const employeeName = useEmployeeName()
  const [selected, setSelected] = React.useState<string | null | undefined>(undefined)
  React.useEffect(() => setSelected(undefined), [kind])

  const departments = dashboard.departmentPerformance
    .map((department) => {
      const count = kind === "present" ? department.present : kind === "absent" ? department.absent : department.lateEmployees
      const share = kind === "present"
        ? department.attendanceRate
        : kind === "absent"
          ? shareOf(department.absent, department.dueDays)
          : shareOf(department.lateEmployees, department.present)
      return { departmentId: department.departmentId, department: department.department, count, share }
    })
    .filter((department) => department.count > 0)
    .sort((left, right) => right.count - left.count || left.department.localeCompare(right.department))

  const showPeople = kind === "absent" || kind === "late"
  const people = dashboard.insights.people.filter((person) => (
    (kind === "late" ? person.status === "LATE" : person.status !== "LATE")
    && (selected === undefined || person.departmentId === selected)
  ))
  const title = kind === "present" ? t("drillDownPresent") : kind === "absent" ? t("drillDownAbsent") : t("drillDownLate")

  return (
    <Dialog open={kind !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {showPeople && dashboard.period === "day" ? <DialogDescription>{t("drillDownDescription")}</DialogDescription> : null}
        </DialogHeader>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60%]">{t("department")}</TableHead>
              <TableHead className="w-[20%]">{t("count")}</TableHead>
              <TableHead className="w-[20%]">{kind === "late" ? t("lateRateLabel") : t("shareOfDepartment")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="h-16 text-center text-sm text-muted-foreground">{t("noPeople")}</TableCell>
              </TableRow>
            ) : departments.map((department) => (
              <TableRow
                key={department.departmentId ?? department.department}
                className={cn(showPeople && dashboard.period === "day" && "cursor-pointer", selected === department.departmentId && "bg-accent")}
                onClick={() => showPeople && dashboard.period === "day" && setSelected(department.departmentId)}
              >
                <TableCell className="whitespace-normal break-words font-medium leading-5">{department.department}</TableCell>
                <TableCell>{department.count}</TableCell>
                <TableCell>{department.share === null ? "—" : `${department.share}%`}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {showPeople ? (
          dashboard.period !== "day" ? (
            <p className="text-sm text-muted-foreground">{t("peopleOnlyForDay")}</p>
          ) : (
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{t("people")} · {people.length}</p>
                {selected !== undefined ? (
                  <Button variant="ghost" size="sm" onClick={() => setSelected(undefined)}>{t("showAllPeople")}</Button>
                ) : null}
              </div>
              {people.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noPeople")}</p>
              ) : (
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[34%]">{t("employee")}</TableHead>
                      <TableHead className="w-[34%]">{t("department")}</TableHead>
                      <TableHead className="w-[32%]">{kind === "late" ? t("checkIn") : t("absentShort")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {people
                      .slice()
                      .sort((left, right) => left.department.localeCompare(right.department) || employeeName(left.employee).localeCompare(employeeName(right.employee)))
                      .map((person) => (
                        <TableRow key={person.employeeId}>
                          <TableCell className="whitespace-normal break-words font-medium leading-5">
                            {employeeName(person.employee) || "—"}
                            {person.employee ? <span className="block text-xs font-normal text-muted-foreground">{person.employee.employeeCode}</span> : null}
                          </TableCell>
                          <TableCell className="whitespace-normal break-words leading-5">{person.department}</TableCell>
                          <TableCell className="whitespace-normal leading-5">
                            {person.status === "LATE"
                              ? <>{person.checkInAt ? addisClock(person.checkInAt) : "—"} <span className="text-xs text-muted-foreground">· {t("minutesLate", { count: person.lateMinutes ?? 0 })}</span></>
                              : <Badge variant={person.status === "ABSENT" ? "destructive" : "secondary"}>{t(person.status === "ABSENT" ? "segment_absent" : "segment_notYetArrived")}</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Full-screen view for an office display: headline, the three key figures, the morning curve and movers. */
function WallScreen({ dashboard, onExit }: { dashboard: ExecutiveDashboardSummary; onExit: () => void }) {
  const t = useTranslations("executiveDashboard")
  const comparedWith = useComparisonLabel(dashboard)
  const { current, comparison } = dashboard.insights
  const status = dashboard.workforceStatus
  const exitRef = React.useRef(onExit)
  exitRef.current = onExit

  React.useEffect(() => {
    const root = document.documentElement
    let enteredFullscreen = false
    root.requestFullscreen?.().then(() => { enteredFullscreen = true }).catch(() => undefined)
    // Leaving browser full screen (Esc) also leaves the wall screen.
    const onFullscreenChange = () => { if (enteredFullscreen && !document.fullscreenElement) exitRef.current() }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") exitRef.current() }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange)
      window.removeEventListener("keydown", onKeyDown)
      if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined)
    }
  }, [])

  const tiles = [
    { label: t("present"), value: status.presentToday, share: current.attendanceRate, change: pointChange(current.attendanceRate, comparison?.attendanceRate), goodWhenUp: true, tone: "text-emerald-700 dark:text-emerald-400" },
    { label: t("absent"), value: status.absentToday, share: current.absenceRate, change: pointChange(current.absenceRate, comparison?.absenceRate), goodWhenUp: false, tone: "text-rose-700 dark:text-rose-400" },
    { label: t("late"), value: status.lateArrivals, share: current.lateRate, change: pointChange(current.lateRate, comparison?.lateRate), goodWhenUp: false, tone: "text-amber-700 dark:text-amber-400" },
  ]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background p-4 sm:p-8">
      <div className="mx-auto grid max-w-7xl gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-foreground sm:text-2xl">{dashboard.scope.departmentName ?? t("allDepartments")}</p>
            <p className="text-sm text-muted-foreground">{t("wallUpdated", { time: addisClock(dashboard.generatedAt) })}</p>
          </div>
          <Button variant="outline" onClick={onExit}>
            <X className="mr-2 size-4" />
            {t("exitWallScreen")}
          </Button>
        </div>
        <Headline dashboard={dashboard} textClassName="text-lg sm:text-2xl sm:leading-9" />
        <div className="grid gap-4 sm:grid-cols-3">
          {tiles.map((tile) => (
            <Card key={tile.label} className="py-5">
              <CardContent className="px-5">
                <p className="text-base font-medium text-muted-foreground sm:text-lg">{tile.label}</p>
                <p className={cn("mt-1 text-5xl font-semibold tracking-tight sm:text-7xl", tile.tone)}>{tile.value}</p>
                {tile.share !== null ? <p className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{tile.share}%</p> : null}
                {tile.change !== null && comparedWith ? (
                  <PointChange points={tile.change} goodWhenUp={tile.goodWhenUp} comparedWith={comparedWith} className="text-sm [&_svg]:size-4" />
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <ArrivalCurve dashboard={dashboard} />
          <DepartmentMovers dashboard={dashboard} />
        </div>
      </div>
    </div>
  )
}

/** Plain-language name of what the figures are compared with, or null when there is nothing to compare. */
function useComparisonLabel(dashboard: ExecutiveDashboardSummary) {
  const t = useTranslations("executiveDashboard")
  const { formatDate } = useCalendarPreference()
  const comparison = dashboard.insights.comparison
  if (!comparison || comparison.due === 0) return null
  if (comparison.kind === "PREVIOUS_WORKING_DAY") {
    return comparison.asOf
      ? t("comparedDayAtTime", { date: formatDate(comparison.dateFrom), time: addisClock(comparison.asOf) })
      : t("comparedDay", { date: formatDate(comparison.dateFrom) })
  }
  const range = `${formatDate(comparison.dateFrom)} – ${formatDate(comparison.dateTo)}`
  return comparison.asOf ? t("comparedPeriodSoFar", { range }) : t("comparedPeriod", { range })
}

/** Change in percentage points, or null when either side has nothing to compare. */
function pointChange(current: number | null | undefined, previous: number | null | undefined) {
  if (current === null || current === undefined || previous === null || previous === undefined) return null
  return Math.round((current - previous) * 10) / 10
}

function shareOf(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : null
}

/** Tooltip row "Series  42.5%" that, unlike the default, also shows zero values. */
function percentTooltipRow(config: ChartConfig) {
  return function PercentRow(value: unknown, name: string, item: { color?: string }) {
    return (
      <>
        <span className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: item.color }} />
        <div className="flex flex-1 items-center justify-between gap-3 leading-none">
          <span className="text-muted-foreground">{config[name]?.label ?? name}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">{value === null || value === undefined ? "—" : `${value}%`}</span>
        </div>
      </>
    )
  }
}

/** Clock time in Addis Ababa (UTC+3, no daylight saving), whatever the viewer's time zone. */
function addisClock(value: string | Date | null) {
  if (!value) return ""
  const local = new Date(new Date(value).getTime() + 3 * 60 * 60 * 1000)
  return `${String(local.getUTCHours()).padStart(2, "0")}:${String(local.getUTCMinutes()).padStart(2, "0")}`
}

function TrendIcon({ trend }: { trend: ExecutiveDashboardTrend }) {
  if (trend === "UP") return <ArrowUp className="size-4 text-emerald-600" aria-label="Up" />
  if (trend === "DOWN") return <ArrowDown className="size-4 text-rose-600" aria-label="Down" />
  if (trend === "FLAT") return <ArrowRight className="size-4 text-muted-foreground" aria-label="Flat" />
  return null
}

function WorkforceDistribution({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const segments = dashboard.workforceDistribution

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("workforceDistribution")}</CardTitle>
        <CardDescription>{dashboard.dateFrom === dashboard.dateTo ? t("distributionDescriptionDay") : t("distributionDescriptionPeriod")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        {segments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <>
            <ChartContainer config={distributionChartConfig} className="min-h-52 sm:min-h-64">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
                <Pie data={segments} dataKey="count" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2}>
                  {segments.map((segment) => (
                    <Cell key={segment.id} fill={distributionColors[segment.id] ?? "#64748b"} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
            <div className="grid content-center gap-2">
              {segments.map((segment) => (
                <div key={segment.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: distributionColors[segment.id] ?? "#64748b" }} />
                    <span className="break-words text-sm font-medium leading-tight text-foreground">{t(`segment_${segment.id}`)}</span>
                  </div>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    <span className="font-semibold text-foreground">{segment.count}</span> · {segment.percentage}%
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
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
        <CardDescription>{t("rankingDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="px-3 sm:px-6">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : (
          <ChartContainer config={rankingChartConfig} className="min-h-60 sm:min-h-72">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 36 }}>
              <CartesianGrid horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
              <YAxis dataKey="department" type="category" width={148} tickLine={false} axisLine={false} interval={0} tick={<WrappedDepartmentTick />} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="attendanceRate" fill="var(--color-attendanceRate)" radius={4}>
                <LabelList dataKey="attendanceRate" position="right" formatter={(value) => `${value ?? 0}%`} />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function WrappedDepartmentTick({ x = 0, y = 0, payload }: { x?: number; y?: number; payload?: { value?: string } }) {
  const value = String(payload?.value ?? "")
  const lines = wrapLabel(value, 19, 2)
  const startY = y - ((lines.length - 1) * 6)

  return (
    <g transform={`translate(${x},${startY})`}>
      <title>{value}</title>
      <text textAnchor="end" fill="currentColor" className="fill-muted-foreground text-[11px]">
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? 0 : 12}>{line}</tspan>
        ))}
      </text>
    </g>
  )
}

function wrapLabel(value: string, maxChars: number, maxLines: number) {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []

  for (const word of words.length ? words : [value]) {
    const chunks = word.length > maxChars ? word.match(new RegExp(`.{1,${maxChars}}`, "g")) ?? [word] : [word]
    for (const chunk of chunks) {
      const current = lines[lines.length - 1]
      if (!current || `${current} ${chunk}`.length > maxChars) lines.push(chunk)
      else lines[lines.length - 1] = `${current} ${chunk}`
    }
  }

  if (lines.length <= maxLines) return lines
  const visible = lines.slice(0, maxLines)
  visible[maxLines - 1] = `${visible[maxLines - 1].replace(/\.+$/, "")}…`
  return visible
}

function CompoundStatus({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const { formatDate } = useCalendarPreference()
  const items = [
    { label: dashboard.isLive ? t("currentlyInside") : t("noCheckoutRecorded"), value: dashboard.compoundStatus.currentlyInside, icon: DoorOpen },
    { label: t("checkedOut"), value: dashboard.compoundStatus.checkedOut, icon: CheckCircle2 },
    ...(dashboard.isLive ? [{ label: t("notYetArrived"), value: dashboard.compoundStatus.notYetArrived, icon: Clock3 }] : []),
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dashboard.isLive ? t("compoundStatus") : t("compoundStatusOn", { date: formatDate(dashboard.focusDate) })}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-border p-3 sm:p-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <item.icon className="size-5" />
              </div>
              <span className="text-sm font-medium leading-tight text-foreground">{item.label}</span>
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
  const { formatDate } = useCalendarPreference()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{dashboard.isLive ? t("liveAttendanceTimeline") : t("attendanceTimelineOn", { date: formatDate(dashboard.focusDate) })}</CardTitle>
        <CardDescription>{t("timelineDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={timelineChartConfig} className="min-h-60 sm:min-h-72">
          <LineChart data={dashboard.liveAttendanceTimeline}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="time" tickLine={false} axisLine={false} minTickGap={20} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="arrivals" type="monotone" stroke="var(--color-arrivals)" strokeWidth={2} dot={false} />
            <Line dataKey="count" type="monotone" stroke="var(--color-count)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

function LeaveSummary({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("leaveSummary")}</CardTitle>
        <CardDescription>{t("leaveSummaryDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-2">
        {dashboard.leaveSummary.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noData")}</p>
        ) : dashboard.leaveSummary.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <span className="min-w-0 break-words text-sm font-medium leading-tight text-foreground">{item.label}</span>
            <span className="whitespace-nowrap text-sm text-muted-foreground">
              <span className="text-lg font-semibold text-foreground">{item.count}</span> {t("employeesShort")} · {item.days} {t("daysShort")}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function HrPerformance({ dashboard }: { dashboard: ExecutiveDashboardSummary }) {
  const t = useTranslations("executiveDashboard")
  const items: Array<[string, React.ReactNode]> = [
    [t("pendingHrApproval"), dashboard.hrPerformance.pendingHrApproval],
    [t("pendingCorrections"), dashboard.hrPerformance.pendingCorrections],
    [t("pendingLeaveApproval"), dashboard.hrPerformance.pendingLeaveApproval],
    [t("averageApprovalTime"), t("hours", { value: dashboard.hrPerformance.averageApprovalTimeHours })],
    [t("correctionsReturned"), dashboard.hrPerformance.correctionsReturned],
    [t("payrollReady"), `${dashboard.hrPerformance.payrollReadyPercent}%`],
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("hrPerformance")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <span className="text-sm font-medium text-muted-foreground">{label}</span>
            <span className="text-lg font-semibold text-foreground">{value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function DepartmentPerformance({ dashboard, onSelect }: { dashboard: ExecutiveDashboardSummary; onSelect: (departmentId: string) => void }) {
  const t = useTranslations("executiveDashboard")
  const comparedWith = useComparisonLabel(dashboard)
  const rate = (value: number | null) => (value === null ? "—" : `${value}%`)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>{t("departmentPerformance")}</CardTitle>
        <CardDescription>{t("departmentPerformanceDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="max-h-[28rem] overflow-y-auto">
          <Table className="min-w-[60rem] table-fixed">
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead className="w-[26%]">{t("department")}</TableHead>
                <TableHead className="w-[9%]">{t("employees")}</TableHead>
                <TableHead className="w-[11%]">{t("attendanceRate")}</TableHead>
                <TableHead className="w-[10%]">{t("punctuality")}</TableHead>
                <TableHead className="w-[8%]">{t("absentShort")}</TableHead>
                <TableHead className="w-[8%]">{t("lateShort")}</TableHead>
                <TableHead className="w-[8%]">{t("leaveRate")}</TableHead>
                <TableHead className="w-[10%]">{t("pendingApprovals")}</TableHead>
                <TableHead className="w-[10%]">{t("trend")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dashboard.departmentPerformance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-sm text-muted-foreground">{t("noData")}</TableCell>
                </TableRow>
              ) : dashboard.departmentPerformance.map((department) => (
                <TableRow
                  key={department.departmentId ?? department.department}
                  className={cn(department.departmentId && department.departmentId !== dashboard.scope.departmentId && "cursor-pointer")}
                  onClick={() => department.departmentId && department.departmentId !== dashboard.scope.departmentId && onSelect(department.departmentId)}
                  title={department.departmentId ? t("drillDown") : undefined}
                >
                  <TableCell className="whitespace-normal break-words font-medium leading-5">{department.department}</TableCell>
                  <TableCell>{department.totalEmployees}</TableCell>
                  <TableCell className={cn(department.attendanceRate !== null && department.attendanceRate < 90 && "font-semibold text-rose-600")}>{rate(department.attendanceRate)}</TableCell>
                  <TableCell>{rate(department.punctualityRate)}</TableCell>
                  <TableCell>{department.absent}</TableCell>
                  <TableCell>{department.lateEmployees}</TableCell>
                  <TableCell>{department.leaveRate}%</TableCell>
                  <TableCell>{department.pendingApprovals}</TableCell>
                  <TableCell>
                    {department.trend ? (
                      <Badge variant={department.trend === "DOWN" ? "destructive" : "secondary"} className="gap-1" title={department.previousAttendanceRate !== null && comparedWith ? t("comparisonValueHint", { comparison: comparedWith, value: department.previousAttendanceRate }) : undefined}>
                        <TrendIcon trend={department.trend} />
                        {t(`trend${department.trend}`)}
                      </Badge>
                    ) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
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
        <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
          {items.map(([label, value, description]) => (
            <div key={label} className="rounded-md border border-border p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
              <p className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{value}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
        <div className="max-h-[24rem] overflow-auto">
          <Table className="min-w-[48rem] table-fixed">
            <TableHeader className="sticky top-0 bg-card">
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
              ) : summary.departmentBreakdown.map((department) => (
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
        <CardDescription>{t("monthlyTrendDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={trendChartConfig} className="min-h-60 sm:min-h-72">
          <LineChart data={dashboard.monthlyAttendanceTrend}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line dataKey="attendanceRate" type="monotone" stroke="var(--color-attendanceRate)" strokeWidth={2} dot connectNulls={false} />
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
          <CardDescription>{t("deviceHealthDescription")}</CardDescription>
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
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-10 w-full sm:w-44" />
          <Skeleton className="h-10 w-full sm:w-44" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-24 rounded-xl sm:h-28" />
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

/** Today's date in Addis Ababa (the server classifies attendance by Addis calendar days). */
function todayInput() {
  return addisTodayInput()
}
