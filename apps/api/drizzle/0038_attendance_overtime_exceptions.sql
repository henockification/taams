CREATE TABLE IF NOT EXISTS "attendance_overtime_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "attendance_daily_record_id" uuid REFERENCES "attendance_daily_records"("id") ON DELETE CASCADE,
  "overtime_date" date NOT NULL,
  "observed_start_at" timestamp,
  "observed_end_at" timestamp,
  "detected_minutes" integer NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "reviewed_by" text REFERENCES "user"("id"),
  "reviewed_at" timestamp,
  "review_note" text,
  "created_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_attendance_overtime_exception_minutes" CHECK ("detected_minutes" > 0),
  CONSTRAINT "chk_attendance_overtime_exception_status" CHECK ("status" IN ('REVIEW_REQUIRED', 'DISMISSED', 'CONVERTED')),
  CONSTRAINT "ux_attendance_overtime_exception_employee_date" UNIQUE ("employee_id", "overtime_date")
);
CREATE INDEX IF NOT EXISTS "idx_attendance_overtime_exception_employee_date" ON "attendance_overtime_exceptions" ("employee_id", "overtime_date");
