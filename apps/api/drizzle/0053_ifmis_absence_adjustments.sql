-- Biometric-exempt employees no longer get daily attendance records. The IFMIS export
-- counts them as present except for unpaid leave; finance can override the month's
-- absent days per employee here.
CREATE TABLE IF NOT EXISTS "ifmis_absence_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "pay_month" integer NOT NULL,
  "pay_year" integer NOT NULL,
  "absent_days" numeric(5, 2) NOT NULL,
  "note" text,
  "updated_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ux_ifmis_absence_adjustments_employee_period" UNIQUE ("employee_id", "pay_year", "pay_month"),
  CONSTRAINT "chk_ifmis_absence_adjustments_month" CHECK ("pay_month" BETWEEN 1 AND 12),
  CONSTRAINT "chk_ifmis_absence_adjustments_days" CHECK ("absent_days" >= 0 AND "absent_days" <= 31)
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ifmis_absence_adjustments_period" ON "ifmis_absence_adjustments" ("pay_year", "pay_month");
