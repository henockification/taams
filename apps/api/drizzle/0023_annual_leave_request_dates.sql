CREATE TABLE IF NOT EXISTS "annual_leave_request_dates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "leave_request_id" uuid NOT NULL,
  "leave_date" date NOT NULL,
  "requested_day_value" numeric(4, 2) NOT NULL,
  "approved_day_value" numeric(4, 2),
  "status" varchar(30) DEFAULT 'PENDING' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "annual_leave_request_dates_request_date_unique" UNIQUE("leave_request_id", "leave_date"),
  CONSTRAINT "chk_annual_leave_request_dates_requested_value" CHECK ("annual_leave_request_dates"."requested_day_value" IN (0.50, 1.00)),
  CONSTRAINT "chk_annual_leave_request_dates_approved_value" CHECK ("annual_leave_request_dates"."approved_day_value" IS NULL OR "annual_leave_request_dates"."approved_day_value" IN (0.00, 0.50, 1.00)),
  CONSTRAINT "chk_annual_leave_request_dates_status" CHECK ("annual_leave_request_dates"."status" IN ('PENDING', 'APPROVED', 'REJECTED'))
);

DO $$ BEGIN
 ALTER TABLE "annual_leave_request_dates" ADD CONSTRAINT "annual_leave_request_dates_leave_request_id_leave_requests_id_fk" FOREIGN KEY ("leave_request_id") REFERENCES "public"."leave_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_annual_leave_request_dates_request" ON "annual_leave_request_dates" USING btree ("leave_request_id");
CREATE INDEX IF NOT EXISTS "idx_annual_leave_request_dates_date" ON "annual_leave_request_dates" USING btree ("leave_date");
