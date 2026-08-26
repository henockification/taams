ALTER TABLE "leave_balances" ADD COLUMN IF NOT EXISTS "reserved" numeric(8, 2) DEFAULT '0' NOT NULL;

DO $$ BEGIN
 ALTER TABLE "leave_balances" ADD CONSTRAINT "chk_leave_balance_reserved_nonnegative" CHECK ("leave_balances"."reserved" >= 0);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "annual_leave_request_dates" ADD COLUMN IF NOT EXISTS "source" varchar(30) DEFAULT 'ORIGINAL' NOT NULL;
ALTER TABLE "annual_leave_request_dates" ADD COLUMN IF NOT EXISTS "utilization_status" varchar(30) DEFAULT 'SCHEDULED' NOT NULL;
ALTER TABLE "annual_leave_request_dates" ADD COLUMN IF NOT EXISTS "employee_id" uuid;

UPDATE "annual_leave_request_dates" ald
SET "employee_id" = lr."employee_id"
FROM "leave_requests" lr
WHERE lr."id" = ald."leave_request_id" AND ald."employee_id" IS NULL;

ALTER TABLE "annual_leave_request_dates" ALTER COLUMN "employee_id" SET NOT NULL;

DO $$ BEGIN
 ALTER TABLE "annual_leave_request_dates" ADD CONSTRAINT "annual_leave_request_dates_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

UPDATE "annual_leave_request_dates"
SET "utilization_status" = CASE
  WHEN "status" = 'REJECTED' THEN 'CANCELLED'
  WHEN "status" = 'APPROVED' AND "leave_date" < CURRENT_DATE THEN 'CONSUMED'
  ELSE 'SCHEDULED'
END;

WITH future_approved AS (
  SELECT lr."employee_id", lr."fiscal_year_id", SUM(ald."approved_day_value") AS days
  FROM "annual_leave_request_dates" ald
  JOIN "leave_requests" lr ON lr."id" = ald."leave_request_id"
  WHERE lr."status" = 'APPROVED'
    AND lr."fiscal_year_id" IS NOT NULL
    AND ald."status" = 'APPROVED'
    AND ald."leave_date" >= CURRENT_DATE
  GROUP BY lr."employee_id", lr."fiscal_year_id"
)
UPDATE "leave_balances" lb
SET "reserved" = lb."reserved" + fa.days,
    "used" = GREATEST(0, lb."used" - fa.days)
FROM future_approved fa
WHERE lb."employee_id" = fa."employee_id"
  AND lb."fiscal_year_id" = fa."fiscal_year_id";

DO $$ BEGIN
 ALTER TABLE "annual_leave_request_dates" ADD CONSTRAINT "chk_annual_leave_request_dates_source" CHECK ("annual_leave_request_dates"."source" IN ('ORIGINAL', 'CONTINUATION'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "annual_leave_request_dates" ADD CONSTRAINT "chk_annual_leave_request_dates_utilization_status" CHECK ("annual_leave_request_dates"."utilization_status" IN ('SCHEDULED', 'CONSUMED', 'INTERRUPTED', 'CANCELLED'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "leave_interruptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "leave_request_id" uuid NOT NULL,
  "reason" text NOT NULL,
  "recall_authority" text NOT NULL,
  "authority_user_id" text,
  "actual_work_start_date" date NOT NULL,
  "actual_work_end_date" date NOT NULL,
  "status" varchar(30) DEFAULT 'PENDING' NOT NULL,
  "requested_by" text NOT NULL,
  "reviewed_by" text,
  "reviewed_at" timestamp,
  "rejection_reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_leave_interruption_actual_work_range" CHECK ("leave_interruptions"."actual_work_start_date" <= "leave_interruptions"."actual_work_end_date"),
  CONSTRAINT "chk_leave_interruption_status" CHECK ("leave_interruptions"."status" IN ('PENDING', 'APPROVED', 'REJECTED'))
);

DO $$ BEGIN
 ALTER TABLE "leave_interruptions" ADD CONSTRAINT "leave_interruptions_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "leave_interruptions" ADD CONSTRAINT "leave_interruptions_authority_user_id_user_id_fk" FOREIGN KEY ("authority_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "leave_interruptions" ADD CONSTRAINT "leave_interruptions_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "leave_interruptions" ADD CONSTRAINT "leave_interruptions_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_leave_interruptions_request_status" ON "leave_interruptions" USING btree ("leave_request_id", "status");

CREATE TABLE IF NOT EXISTS "leave_interruption_dates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "leave_interruption_id" uuid NOT NULL,
  "kind" varchar(40) NOT NULL,
  "leave_date" date NOT NULL,
  "day_value" numeric(4, 2) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "leave_interruption_dates_kind_date_unique" UNIQUE("leave_interruption_id", "kind", "leave_date"),
  CONSTRAINT "chk_leave_interruption_dates_kind" CHECK ("leave_interruption_dates"."kind" IN ('INTERRUPTED_PROPOSED', 'CONTINUATION_PROPOSED', 'INTERRUPTED_APPROVED', 'CONTINUATION_APPROVED')),
  CONSTRAINT "chk_leave_interruption_dates_day_value" CHECK ("leave_interruption_dates"."day_value" IN (0.50, 1.00))
);

DO $$ BEGIN
 ALTER TABLE "leave_interruption_dates" ADD CONSTRAINT "leave_interruption_dates_leave_interruption_id_leave_interruptions_id_fk" FOREIGN KEY ("leave_interruption_id") REFERENCES "public"."leave_interruptions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_leave_interruption_dates_interruption" ON "leave_interruption_dates" USING btree ("leave_interruption_id");
CREATE INDEX IF NOT EXISTS "idx_leave_interruption_dates_date" ON "leave_interruption_dates" USING btree ("leave_date");

CREATE UNIQUE INDEX IF NOT EXISTS "annual_leave_request_dates_active_employee_date_unique"
ON "annual_leave_request_dates" USING btree ("employee_id", "leave_date")
WHERE "status" IN ('PENDING', 'APPROVED') AND "utilization_status" NOT IN ('INTERRUPTED', 'CANCELLED');

DO $$ BEGIN
 ALTER TABLE "leave_balance_transactions" DROP CONSTRAINT "chk_leave_balance_transaction_type";
EXCEPTION
 WHEN undefined_object THEN null;
END $$;

ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "chk_leave_balance_transaction_type" CHECK ("leave_balance_transactions"."type" IN ('INITIAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'DEDUCTION', 'RESERVATION', 'CONSUMPTION', 'REVERSAL', 'ADJUSTMENT'));
