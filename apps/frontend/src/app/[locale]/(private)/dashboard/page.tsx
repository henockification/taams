"use client"

import { CalendarClock, Clock3, UsersRound } from "lucide-react"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Link } from "@/i18n"

export default function DashboardPage() {
  const t = useTranslations("dashboard")

  return (
    <div className="flex min-h-[calc(100svh-8rem)] items-center justify-center">
      <Card className="w-full max-w-4xl overflow-hidden border-border bg-card shadow-sm">
        <CardContent className="grid gap-8 p-6 md:grid-cols-[1fr_0.85fr] md:p-8">
          <div className="flex flex-col justify-center space-y-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-accent px-3 py-1 text-sm font-medium text-accent-foreground">
              <Clock3 className="size-4" />
              {t("eyebrow")}
            </div>
            <div className="space-y-3">
              <h2 className="max-w-xl text-3xl font-semibold tracking-normal text-foreground md:text-4xl">
                {t("emptyTitle")}
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
                {t("emptyDescription")}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/users">
                  <UsersRound className="size-4" />
                  {t("manageEmployees")}
                </Link>
              </Button>
              <Button variant="outline" disabled>
                <CalendarClock className="size-4" />
                {t("attendanceComingSoon")}
              </Button>
            </div>
          </div>

          <div className="relative min-h-64 rounded-md border border-border bg-background p-5">
            <div className="absolute inset-x-5 top-5 flex items-center justify-between border-b border-border pb-4">
              <div>
                <div className="h-2 w-24 rounded-full bg-primary" />
                <div className="mt-2 h-2 w-16 rounded-full bg-muted" />
              </div>
              <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Clock3 className="size-5" />
              </div>
            </div>

            <div className="grid h-full content-end gap-3 pt-20">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-md border border-border bg-card p-3"
                >
                  <div className="flex size-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <UsersRound className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="h-2 w-28 rounded-full bg-foreground/20" />
                    <div className="mt-2 h-2 w-40 rounded-full bg-muted" />
                  </div>
                  <div className="h-2 w-12 rounded-full bg-primary/70" />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
