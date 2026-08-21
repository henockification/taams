ALTER TABLE "attendance_daily_records" ADD COLUMN "overtime_minutes" integer DEFAULT 0 NOT NULL;
ALTER TABLE "attendance_daily_records" ADD COLUMN "overtime_hours" numeric(8, 2) DEFAULT '0' NOT NULL;
ALTER TABLE "attendance_daily_records" ADD COLUMN "overtime_days" numeric(8, 2) DEFAULT '0' NOT NULL;

CREATE TABLE "overtime_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "attendance_daily_record_id" uuid,
  "overtime_date" date NOT NULL,
  "start_at" timestamp NOT NULL,
  "end_at" timestamp NOT NULL,
  "requested_minutes" integer NOT NULL,
  "approved_minutes" integer DEFAULT 0 NOT NULL,
  "overtime_days" numeric(8, 2) DEFAULT '0' NOT NULL,
  "reason" text NOT NULL,
  "status" varchar(30) DEFAULT 'PENDING' NOT NULL,
  "requested_by" text NOT NULL,
  "approved_by" text,
  "approved_at" timestamp,
  "rejected_by" text,
  "rejected_at" timestamp,
  "rejection_reason" text,
  "payroll_note" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_overtime_request_status" CHECK ("overtime_requests"."status" IN ('PENDING', 'APPROVED', 'REJECTED')),
  CONSTRAINT "chk_overtime_request_date_range" CHECK ("overtime_requests"."start_at" < "overtime_requests"."end_at"),
  CONSTRAINT "chk_overtime_request_requested_minutes" CHECK ("overtime_requests"."requested_minutes" > 0),
  CONSTRAINT "chk_overtime_request_approved_minutes" CHECK ("overtime_requests"."approved_minutes" >= 0),
  CONSTRAINT "chk_overtime_request_overtime_days" CHECK ("overtime_requests"."overtime_days" >= 0)
);

ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_attendance_daily_record_id_attendance_daily_records_id_fk" FOREIGN KEY ("attendance_daily_record_id") REFERENCES "attendance_daily_records"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "overtime_requests" ADD CONSTRAINT "overtime_requests_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "chk_attendance_daily_record_overtime_minutes" CHECK ("attendance_daily_records"."overtime_minutes" >= 0);
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "chk_attendance_daily_record_overtime_hours" CHECK ("attendance_daily_records"."overtime_hours" >= 0);
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "chk_attendance_daily_record_overtime_days" CHECK ("attendance_daily_records"."overtime_days" >= 0);
CREATE INDEX "idx_overtime_requests_employee_date" ON "overtime_requests" USING btree ("employee_id","overtime_date");
CREATE INDEX "idx_overtime_requests_status" ON "overtime_requests" USING btree ("status");
