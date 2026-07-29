"use client"

import * as React from "react"
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  FileText,
  Fingerprint,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Megaphone,
  ShieldCheck,
  Timer,
  UsersRound as UsersRoundIcon,
  Wallet,
} from "lucide-react"
import { useTranslations } from "next-intl"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDashboardSummary } from "@/data/hooks/core.hooks"
import type {
  AttendancePunch,
  DashboardMetric,
  DashboardPlaceholder,
  DashboardQuickAction,
  DashboardSummary,
  ManualPunchRequest,
  LeaveRequest,
  WorkScheduleDayWithShift,
} from "@/data/types/core.types"
import { Link, useRouter } from "@/i18n"
import { useSession } from "@/lib/auth-client"
import { cn } from "@/lib/utils"

export default function DashboardPage() {
  const t = useTranslations("dashboard")
  const router = useRouter()
  const { data: session, isPending: isSessionPending } = useSession()
  const dashboardQuery = useDashboardSummary(session?.user?.id)
  const dashboard = dashboardQuery.data?.dashboard
  const shouldRedirectSupervisor = dashboard?.role === "MANAGER"
  const canViewManualPunchRequests = Boolean(
    session?.user?.role?.includes("super_admin")
    || session?.user?.permissions?.includes("manual-punch-requests:read"),
  )

  React.useEffect(() => {
    if (shouldRedirectSupervisor) {
      router.replace("/department-head-dashboard")
    }
  }, [router, shouldRedirectSupervisor])

  if (isSessionPending || dashboardQuery.isLoading) {
    return <DashboardSkeleton />
  }

  if (shouldRedirectSupervisor) {
    return <DashboardSkeleton />
  }

  if (dashboardQuery.isError || !dashboard) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="space-y-3 p-6">
          <Badge variant="destructive">{t("unableToLoad")}</Badge>
          <p className="text-sm text-muted-foreground">
            {dashboardQuery.error instanceof Error ? dashboardQuery.error.message : t("tryAgain")}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {dashboard.role === "EMPLOYEE" ? null : <DashboardHero dashboard={dashboard} canViewManualPunchRequests={canViewManualPunchRequests} />}
      {dashboard.role === "SUPER_ADMIN" ? <SuperAdminDashboard dashboard={dashboard} /> : null}
      {dashboard.role === "MANAGER" ? <ManagerDashboard dashboard={dashboard} /> : null}
      {dashboard.role === "EMPLOYEE" ? <EmployeeDashboard dashboard={dashboard} canViewManualPunchRequests={canViewManualPunchRequests} /> : null}
      {dashboard.role === "SETUP_REQUIRED" ? <SetupRequiredDashboard dashboard={dashboard} /> : null}
    </div>
  )
}

function DashboardHero({
  dashboard,
  canViewManualPunchRequests,
}: {
  dashboard: DashboardSummary
  canViewManualPunchRequests: boolean
}) {
  const t = useTranslations("dashboard")

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.14),transparent_34%),linear-gradient(135deg,hsl(var(--accent)/0.65),transparent_40%)]" />
        <div className="relative space-y-4">
          <Badge className="gap-2" variant="secondary">
            <LayoutDashboard className="size-3.5" />
            {roleLabel(dashboard.role, t)}
          </Badge>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {dashboard.setupRequired ? t("setupHeroTitle") : t("heroTitle", { name: dashboard.user.name ?? t("there") })}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
              {dashboard.setupRequired ? t("setupHeroDescription") : heroDescription(dashboard.role, t)}
            </p>
          </div>
        </div>
        <HeroInsightCard dashboard={dashboard} canViewManualPunchRequests={canViewManualPunchRequests} />
      </div>
    </div>
  )
}

function HeroInsightCard({
  dashboard,
  canViewManualPunchRequests,
}: {
  dashboard: DashboardSummary
  canViewManualPunchRequests: boolean
}) {
  const t = useTranslations("dashboard")
  const insight = getHeroInsight(dashboard, t, canViewManualPunchRequests)

  return (
    <div className="relative grid min-w-72 gap-4 rounded-xl border border-border bg-background/85 p-4 shadow-sm backdrop-blur">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <insight.icon className="size-5" />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{insight.title}</p>
          <p className="text-xs leading-5 text-muted-foreground">{insight.description}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{insight.primaryLabel}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{insight.primaryValue}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{insight.secondaryLabel}</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{insight.secondaryValue}</p>
        </div>
      </div>
      {dashboard.currentAnnualLeaveBalance ? (
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("annualLeaveBalance")}</p>
              <p className="mt-1 text-2xl font-semibold text-foreground">{dashboard.currentAnnualLeaveBalance.available}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{t("currentFiscalYear")}</p>
              <p className="mt-1 text-xs font-medium text-foreground">
                {dashboard.currentAnnualLeaveBalance.fiscalYear?.name ?? t("notAvailable")}
              </p>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {t("generatedAt", { value: formatDateTime(dashboard.generatedAt) })}
        </p>
        {insight.href ? (
          <Link
            href={insight.href}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
          >
            {insight.actionLabel}
            <ArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function SuperAdminDashboard({ dashboard }: { dashboard: DashboardSummary }) {
  const t = useTranslations("dashboard")
  const section = dashboard.sections.superAdmin

  return (
    <>
      <MetricGrid metrics={dashboard.metrics} />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="size-5 text-primary" />
              {t("deviceHealth")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {section ? (
              <div className="grid gap-3 sm:grid-cols-5">
                {[
                  ["total", t("total"), section.deviceHealth.total],
                  ["online", t("online"), section.deviceHealth.online],
                  ["offline", t("offline"), section.deviceHealth.offline],
                  ["error", t("error"), section.deviceHealth.error],
                  ["unknown", t("unknown"), section.deviceHealth.unknown],
                ].map(([key, label, value]) => (
                  <div key={key} className="rounded-xl border border-border bg-background p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
        <TimeOperationsPanel dashboard={dashboard} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <QuickActions actions={dashboard.quickActions} />
        <PlaceholderPanel placeholders={dashboard.placeholders} />
      </div>
    </>
  )
}

function ManagerDashboard({ dashboard }: { dashboard: DashboardSummary }) {
  const t = useTranslations("dashboard")
  const section = dashboard.sections.manager

  return (
    <>
      <MetricGrid metrics={dashboard.metrics} />
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <TeamRequestsList
          title={t("pendingTeamRequests")}
          manualRequests={section?.pendingManualPunchRequests ?? []}
          leaveRequests={section?.pendingLeaveRequests ?? []}
          emptyText={t("noPendingTeamRequests")}
        />
        <PunchList
          title={t("recentTeamPunches")}
          punches={section?.recentTeamPunches ?? []}
          emptyText={t("noRecentTeamPunches")}
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <PlaceholderPanel placeholders={dashboard.placeholders} />
        <QuickActions actions={dashboard.quickActions} />
      </div>
    </>
  )
}

function EmployeeDashboard({
  dashboard,
  canViewManualPunchRequests,
}: {
  dashboard: DashboardSummary
  canViewManualPunchRequests: boolean
}) {
  const t = useTranslations("dashboard")
  const section = dashboard.sections.employee
  const todayAttendance = section?.todayAttendance
  const leaveBalance = dashboard.currentAnnualLeaveBalance

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>{t("todaysAttendance")}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("generatedAt", { value: formatDateTime(dashboard.generatedAt) })}
                </p>
              </div>
              <Badge variant="secondary">
                <Fingerprint className="mr-2 size-3.5" />
                {todayAttendance?.date ?? formatDate(new Date().toISOString())}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-3">
            <AttendanceStat
              icon={LogIn}
              label={t("checkIn")}
              value={formatTime(todayAttendance?.checkIn?.punchTime)}
              detail={todayAttendance?.checkIn?.device?.deviceName ?? t("notAvailable")}
            />
            <AttendanceStat
              icon={LogOut}
              label={t("checkOut")}
              value={formatTime(todayAttendance?.checkOut?.punchTime)}
              detail={todayAttendance?.checkOut?.device?.deviceName ?? t("notAvailable")}
            />
            <AttendanceStat
              icon={Timer}
              label={t("workingHours")}
              value={formatWorkingHours(todayAttendance?.workingMinutes ?? 0)}
              detail={todayAttendance?.workingMinutes ? t("minutesWorked", { value: todayAttendance.workingMinutes }) : t("notAvailable")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-primary" />
              {t("leaveBalance")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("annualLeaveBalance")}</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                {leaveBalance?.available ?? t("notAvailable")}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {leaveBalance?.fiscalYear?.name ?? t("currentFiscalYear")}
              </p>
            </div>
            <Link
              href="/annual-leave-requests"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("leaveRequests")}
              <ArrowRight className="size-4" />
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <PunchList
          title={t("attendanceHistory")}
          punches={section?.recentPunches ?? []}
          emptyText={t("noRecentPunches")}
        />
        <LeaveRequestsPanel requests={section?.leaveRequests ?? []} />
      </div>

      <div className={cn("grid gap-6", canViewManualPunchRequests ? "xl:grid-cols-[1fr_1fr]" : "xl:grid-cols-1")}>
        {canViewManualPunchRequests ? (
          <ManualRequestsList
            title={t("myManualRequests")}
            requests={section?.manualPunchRequests ?? []}
            emptyText={t("noManualRequests")}
          />
        ) : null}
        <AnnouncementsPanel announcements={section?.announcements ?? []} />
      </div>
    </div>
  )
}

function AttendanceStat({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof LogIn
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Icon className="size-5" />
        </div>
      </div>
      <p className="mt-3 truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function SetupRequiredDashboard({ dashboard }: { dashboard: DashboardSummary }) {
  const setup = dashboard.sections.setup

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="space-y-3 p-6">
          <Badge variant="secondary">
            <ShieldCheck className="mr-2 size-3.5" />
            Setup needed
          </Badge>
          <h2 className="text-xl font-semibold text-foreground">{setup?.title}</h2>
          <p className="text-sm leading-6 text-muted-foreground">{setup?.description}</p>
        </CardContent>
      </Card>
      <QuickActions actions={dashboard.quickActions} />
    </div>
  )
}

function MetricGrid({ metrics }: { metrics: DashboardMetric[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} metric={metric} />
      ))}
    </div>
  )
}

function MetricCard({ metric }: { metric: DashboardMetric }) {
  const content = (
    <Card className="h-full transition hover:border-primary/40 hover:shadow-sm">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
          <Activity className="size-4 text-primary" />
        </div>
        <p className="text-3xl font-semibold tracking-tight text-foreground">{metric.value}</p>
        <p className="text-sm leading-5 text-muted-foreground">{metric.description}</p>
      </CardContent>
    </Card>
  )

  if (!metric.href) return content

  return (
    <Link className="block h-full" href={metric.href}>
      {content}
    </Link>
  )
}

function QuickActions({ actions }: { actions: DashboardQuickAction[] }) {
  const t = useTranslations("dashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("quickActions")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-xl border border-border bg-background p-4 transition hover:border-primary/50 hover:bg-accent/50"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="font-medium text-foreground">{action.label}</p>
                <p className="text-sm leading-5 text-muted-foreground">{action.description}</p>
              </div>
              <ArrowRight className="mt-1 size-4 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function TimeOperationsPanel({ dashboard }: { dashboard: DashboardSummary }) {
  const t = useTranslations("dashboard")
  const operations = dashboard.sections.superAdmin?.timeOperations

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock3 className="size-5 text-primary" />
          {t("timeOperations")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {operations ? (
          <>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-sm font-medium text-foreground">{operations.headline}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("openItems", { count: operations.counts.totalOpenItems })}
              </p>
            </div>
            <div className="space-y-3">
              {operations.items.slice(0, 3).map((item) => (
                <Link
                  key={item.id}
                  href={item.actionHref}
                  className="block rounded-xl border border-border p-4 transition hover:border-primary/50 hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <Badge className={severityClass(item.severity)} variant="secondary">
                        {item.severity}
                      </Badge>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-sm leading-5 text-muted-foreground">{item.description}</p>
                    </div>
                    <ArrowRight className="mt-1 size-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function PunchList({ title, punches, emptyText }: { title: string; punches: AttendancePunch[]; emptyText: string }) {
  const t = useTranslations("dashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="size-5 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {punches.length === 0 ? (
          <EmptyLine text={emptyText} />
        ) : (
          punches.map((punch) => (
            <div key={punch.id} className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background p-4">
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {punch.employee ? employeeName(punch.employee) : punch.biometricId}
                </p>
                <p className="text-sm text-muted-foreground">{formatDateTime(punch.punchTime)}</p>
              </div>
              <Badge variant={punch.isProcessed ? "secondary" : "outline"}>
                {punch.punchType || t("unknown")}
              </Badge>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function LeaveRequestsPanel({ requests }: { requests: LeaveRequest[] }) {
  const t = useTranslations("dashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="size-5 text-primary" />
          {t("leaveRequests")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <EmptyLine text={t("noLeaveRequests")} />
        ) : (
          requests.map((request) => (
            <div key={request.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{request.leaveType?.nameEn ?? t("leaveRequests")}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(request.startDate)} - {formatDate(request.endDate)}
                  </p>
                </div>
                <Badge variant={request.status === "PENDING" ? "default" : request.status === "REJECTED" ? "destructive" : "secondary"}>
                  {request.status}
                </Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">{request.reason}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function AnnouncementsPanel({ announcements }: { announcements: NonNullable<DashboardSummary["sections"]["employee"]>["announcements"] }) {
  const t = useTranslations("dashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Megaphone className="size-5 text-primary" />
          {t("announcements")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {announcements.length === 0 ? (
          <EmptyLine text={t("noAnnouncements")} />
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="rounded-xl border border-border bg-background p-4">
              <p className="font-medium text-foreground">{announcement.title}</p>
              <p className="mt-1 text-sm leading-5 text-muted-foreground">{announcement.body}</p>
              <p className="mt-3 text-xs text-muted-foreground">{formatDateTime(announcement.publishedAt)}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function ManualRequestsList({
  title,
  requests,
  emptyText,
}: {
  title: string
  requests: ManualPunchRequest[]
  emptyText: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {requests.length === 0 ? (
          <EmptyLine text={emptyText} />
        ) : (
          requests.map((request) => (
            <div key={request.id} className="rounded-xl border border-border bg-background p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">
                    {request.employee ? employeeName(request.employee) : request.requestedPunchType}
                  </p>
                  <p className="text-sm text-muted-foreground">{formatDateTime(request.requestedPunchTime)}</p>
                </div>
                <Badge variant={request.status === "PENDING" ? "default" : "secondary"}>{request.status}</Badge>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">{request.reason}</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function TeamRequestsList({
  title,
  manualRequests,
  leaveRequests,
  emptyText,
}: {
  title: string
  manualRequests: ManualPunchRequest[]
  leaveRequests: LeaveRequest[]
  emptyText: string
}) {
  const t = useTranslations("dashboard")

  const isEmpty = manualRequests.length === 0 && leaveRequests.length === 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isEmpty ? (
          <EmptyLine text={emptyText} />
        ) : (
          <>
            {manualRequests.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("myManualRequests")}</p>
                {manualRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {request.employee ? employeeName(request.employee) : request.requestedPunchType}
                        </p>
                        <p className="text-sm text-muted-foreground">{formatDateTime(request.requestedPunchTime)}</p>
                      </div>
                      <Badge variant={request.status === "PENDING" ? "default" : "secondary"}>{request.status}</Badge>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-5 text-muted-foreground">{request.reason}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {leaveRequests.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("leaveRequests")}</p>
                {leaveRequests.map((request) => (
                  <div key={request.id} className="rounded-xl border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-1">
                        <p className="font-medium text-foreground">
                          {request.employee ? employeeName(request.employee) : t("requestsLabel")}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {request.leaveType?.nameEn ?? t("leaveRequestApprovals")}
                        </p>
                      </div>
                      <Badge variant={request.status === "PENDING" ? "default" : "secondary"}>{request.status}</Badge>
                    </div>
                    <p className="mt-3 text-sm leading-5 text-muted-foreground">
                      {formatDate(request.startDate)} - {formatDate(request.endDate)}
                    </p>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function SchedulePreview({ days }: { days: WorkScheduleDayWithShift[] }) {
  const t = useTranslations("dashboard")

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="size-5 text-primary" />
          {t("schedulePreview")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {days.length === 0 ? (
          <EmptyLine text={t("noSchedule")} />
        ) : (
          days.map((day) => (
            <div key={day.id} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background p-4">
              <div>
                <p className="font-medium text-foreground">{day.dayOfWeek}</p>
                <p className="text-sm text-muted-foreground">
                  {day.isOffDay ? t("offDay") : day.shift?.nameEn ?? t("shiftAssigned")}
                </p>
              </div>
              {day.isOffDay ? (
                <Badge variant="outline">{t("off")}</Badge>
              ) : (
                <CheckCircle2 className="size-4 text-primary" />
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function PlaceholderPanel({ placeholders }: { placeholders: DashboardPlaceholder[] }) {
  const t = useTranslations("dashboard")

  if (placeholders.length === 0) return null

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle>{t("upcomingInsights")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {placeholders.map((placeholder) => (
          <div key={placeholder.id} className="rounded-xl border border-border bg-background p-4">
            <Badge variant="outline">{t("preview")}</Badge>
            <h3 className="mt-3 font-medium text-foreground">{placeholder.title}</h3>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">{placeholder.description}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
      {text}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-48 rounded-2xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-36 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  )
}

type DashboardTranslator = (key: string, values?: Record<string, string | number | Date>) => string

function roleLabel(role: DashboardSummary["role"], t: DashboardTranslator) {
  const labels = {
    SUPER_ADMIN: t("roleSuperAdmin"),
    MANAGER: t("roleManager"),
    EMPLOYEE: t("roleEmployee"),
    SETUP_REQUIRED: t("roleSetupRequired"),
  }

  return labels[role]
}

function heroDescription(role: DashboardSummary["role"], t: DashboardTranslator) {
  const descriptions = {
    SUPER_ADMIN: t("superAdminDescription"),
    MANAGER: t("managerDescription"),
    EMPLOYEE: t("employeeDescription"),
    SETUP_REQUIRED: t("setupHeroDescription"),
  }

  return descriptions[role]
}

function getHeroInsight(
  dashboard: DashboardSummary,
  t: DashboardTranslator,
  canViewManualPunchRequests: boolean,
) {
  if (dashboard.role === "SUPER_ADMIN") {
    const openItems = dashboard.sections.superAdmin?.timeOperations.counts.totalOpenItems ?? 0
    const devicesNeedingAttention = (dashboard.sections.superAdmin?.deviceHealth.offline ?? 0)
      + (dashboard.sections.superAdmin?.deviceHealth.error ?? 0)

    return {
      icon: Clock3,
      title: openItems > 0 ? t("attentionQueue") : t("operationsClear"),
      description: openItems > 0 ? t("attentionQueueDescription") : t("operationsClearDescription"),
      primaryLabel: t("openItemsLabel"),
      primaryValue: openItems,
      secondaryLabel: t("devicesLabel"),
      secondaryValue: devicesNeedingAttention,
      actionLabel: t("reviewOperations"),
      href: "/attendance-punches",
    }
  }

  if (dashboard.role === "MANAGER") {
    const section = dashboard.sections.manager
    const pendingTeamRequests = (section?.pendingManualPunchRequests.length ?? 0) + (section?.pendingLeaveRequests.length ?? 0)

    return {
      icon: UsersRoundIcon,
      title: t("teamSnapshot"),
      description: t("teamSnapshotDescription"),
      primaryLabel: t("pendingLabel"),
      primaryValue: pendingTeamRequests,
      secondaryLabel: t("reportsLabel"),
      secondaryValue: section?.directReportsCount ?? 0,
      actionLabel: canViewManualPunchRequests ? t("reviewRequests") : "",
      href: canViewManualPunchRequests ? "/manual-punch-requests" : null,
    }
  }

  if (dashboard.role === "EMPLOYEE") {
    const section = dashboard.sections.employee

    return {
      icon: CalendarClock,
      title: section?.latestWorkSchedule ? t("scheduleReady") : t("scheduleMissing"),
      description: section?.latestWorkSchedule ? t("scheduleReadyDescription") : t("scheduleMissingDescription"),
      primaryLabel: t("recentLabel"),
      primaryValue: section?.recentPunches.length ?? 0,
      secondaryLabel: t("requestsLabel"),
      secondaryValue: section?.manualPunchRequests.length ?? 0,
      actionLabel: canViewManualPunchRequests ? t("requestManualPunch") : "",
      href: canViewManualPunchRequests ? "/manual-punch-requests" : null,
    }
  }

  return {
    icon: ShieldCheck,
    title: t("setupRequiredCardTitle"),
    description: t("setupRequiredCardDescription"),
    primaryLabel: t("statusLabel"),
    primaryValue: t("pendingLabel"),
    secondaryLabel: t("profileLabel"),
    secondaryValue: t("missingLabel"),
    actionLabel: t("openEmployees"),
    href: "/employees",
  }
}

function severityClass(severity: string) {
  return cn(
    severity === "critical" && "bg-destructive/10 text-destructive hover:bg-destructive/10",
    severity === "warning" && "bg-amber-500/10 text-amber-700 hover:bg-amber-500/10",
    severity === "success" && "bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10",
  )
}

function employeeName(employee: { firstNameEn: string; middleNameEn?: string | null; lastNameEn: string }) {
  return [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(" ")
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not available"

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

function formatDate(value?: string | null) {
  if (!value) return "Not available"

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
  }).format(new Date(value))
}

function formatTime(value?: string | null) {
  if (!value) return "Not available"

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatWorkingHours(minutes: number) {
  if (!minutes) return "0h 0m"
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return `${hours}h ${remainder}m`
}
