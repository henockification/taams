CREATE TABLE IF NOT EXISTS "attendance_daily_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "attendance_date" date NOT NULL,
  "first_punch_id" uuid,
  "last_punch_id" uuid,
  "check_in_at" timestamp,
  "check_out_at" timestamp,
  "total_punches" integer DEFAULT 0 NOT NULL,
  "attendance_days" numeric(4,2) DEFAULT '0' NOT NULL,
  "leave_days" numeric(4,2) DEFAULT '0' NOT NULL,
  "payable_days" numeric(4,2) DEFAULT '0' NOT NULL,
  "absence_days" numeric(4,2) DEFAULT '1' NOT NULL,
  "is_biometric_exempt" boolean DEFAULT false NOT NULL,
  "payroll_note" text,
  "status" varchar(30) DEFAULT 'PENDING_SUPERVISOR' NOT NULL,
  "supervisor_approved_by" text,
  "supervisor_approved_at" timestamp,
  "hr_approved_by" text,
  "hr_approved_at" timestamp,
  "returned_by" text,
  "returned_at" timestamp,
  "return_reason" text,
  "payroll_ready_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_attendance_daily_record_status" CHECK ("attendance_daily_records"."status" IN ('PENDING_SUPERVISOR', 'RETURNED', 'SUPERVISOR_APPROVED', 'HR_APPROVED')),
  CONSTRAINT "chk_attendance_daily_record_attendance_days" CHECK ("attendance_days" >= 0 AND "attendance_days" <= 1),
  CONSTRAINT "chk_attendance_daily_record_leave_days" CHECK ("leave_days" >= 0 AND "leave_days" <= 1),
  CONSTRAINT "chk_attendance_daily_record_payable_days" CHECK ("payable_days" >= 0 AND "payable_days" <= 1),
  CONSTRAINT "chk_attendance_daily_record_absence_days" CHECK ("absence_days" >= 0 AND "absence_days" <= 1)
);

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_first_punch_id_attendance_punches_id_fk" FOREIGN KEY ("first_punch_id") REFERENCES "attendance_punches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_last_punch_id_attendance_punches_id_fk" FOREIGN KEY ("last_punch_id") REFERENCES "attendance_punches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_supervisor_approved_by_user_id_fk" FOREIGN KEY ("supervisor_approved_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_hr_approved_by_user_id_fk" FOREIGN KEY ("hr_approved_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_returned_by_user_id_fk" FOREIGN KEY ("returned_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ux_attendance_daily_records_employee_date" ON "attendance_daily_records" ("employee_id","attendance_date");
CREATE INDEX IF NOT EXISTS "idx_attendance_daily_records_employee_id" ON "attendance_daily_records" ("employee_id");
CREATE INDEX IF NOT EXISTS "idx_attendance_daily_records_attendance_date" ON "attendance_daily_records" ("attendance_date");
CREATE INDEX IF NOT EXISTS "idx_attendance_daily_records_status" ON "attendance_daily_records" ("status");
