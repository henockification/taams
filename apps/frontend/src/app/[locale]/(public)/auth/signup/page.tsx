"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function SignUpPage() {
  const t = useTranslations("auth");

  return (
    <AuthShell
      eyebrow={t("brandEyebrow")}
      title={t("signupDisabledTitle")}
      description={t("signupDisabledDescription")}
    >
      <Card className="border-border/80 shadow-sm">
        <CardContent className="space-y-4 pt-6 text-center">
          <p className="text-sm leading-6 text-muted-foreground">
            {t("signupDisabledHelp")}
          </p>
          <Button className="w-full" asChild>
            <Link href="/auth/signin">{t("backToSignIn")}</Link>
          </Button>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
