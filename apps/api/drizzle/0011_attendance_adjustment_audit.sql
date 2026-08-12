CREATE TABLE IF NOT EXISTS "attendance_daily_record_adjustments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "attendance_daily_record_id" uuid NOT NULL,
  "adjusted_by" text NOT NULL,
  "previous_attendance_days" numeric(4,2) NOT NULL,
  "new_attendance_days" numeric(4,2) NOT NULL,
  "previous_leave_days" numeric(4,2) NOT NULL,
  "new_leave_days" numeric(4,2) NOT NULL,
  "previous_payable_days" numeric(4,2) NOT NULL,
  "new_payable_days" numeric(4,2) NOT NULL,
  "previous_absence_days" numeric(4,2) NOT NULL,
  "new_absence_days" numeric(4,2) NOT NULL,
  "previous_payroll_note" text,
  "new_payroll_note" text,
  "reason" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "attendance_daily_record_adjustments" ADD CONSTRAINT "attendance_daily_record_adjustments_record_id_fk" FOREIGN KEY ("attendance_daily_record_id") REFERENCES "attendance_daily_records"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_record_adjustments" ADD CONSTRAINT "attendance_daily_record_adjustments_adjusted_by_user_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_attendance_daily_record_adjustments_record_id" ON "attendance_daily_record_adjustments" ("attendance_daily_record_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_daily_record_adjustments_adjusted_by" ON "attendance_daily_record_adjustments" ("adjusted_by");
CREATE INDEX IF NOT EXISTS "idx_attendance_daily_record_adjustments_created_at" ON "attendance_daily_record_adjustments" ("created_at");
