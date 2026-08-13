CREATE TABLE "attendance_daily_record_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attendance_daily_record_id" uuid NOT NULL,
	"adjusted_by" text NOT NULL,
	"previous_attendance_days" numeric(4, 2) NOT NULL,
	"new_attendance_days" numeric(4, 2) NOT NULL,
	"previous_leave_days" numeric(4, 2) NOT NULL,
	"new_leave_days" numeric(4, 2) NOT NULL,
	"previous_payable_days" numeric(4, 2) NOT NULL,
	"new_payable_days" numeric(4, 2) NOT NULL,
	"previous_absence_days" numeric(4, 2) NOT NULL,
	"new_absence_days" numeric(4, 2) NOT NULL,
	"previous_payroll_note" text,
	"new_payroll_note" text,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_daily_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"attendance_date" date NOT NULL,
	"first_punch_id" uuid,
	"last_punch_id" uuid,
	"check_in_at" timestamp,
	"check_out_at" timestamp,
	"total_punches" integer DEFAULT 0 NOT NULL,
	"attendance_days" numeric(4, 2) DEFAULT '0' NOT NULL,
	"leave_days" numeric(4, 2) DEFAULT '0' NOT NULL,
	"payable_days" numeric(4, 2) DEFAULT '0' NOT NULL,
	"absence_days" numeric(4, 2) DEFAULT '1' NOT NULL,
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
	CONSTRAINT "chk_attendance_daily_record_attendance_days" CHECK ("attendance_daily_records"."attendance_days" >= 0 AND "attendance_daily_records"."attendance_days" <= 1),
	CONSTRAINT "chk_attendance_daily_record_leave_days" CHECK ("attendance_daily_records"."leave_days" >= 0 AND "attendance_daily_records"."leave_days" <= 1),
	CONSTRAINT "chk_attendance_daily_record_payable_days" CHECK ("attendance_daily_records"."payable_days" >= 0 AND "attendance_daily_records"."payable_days" <= 1),
	CONSTRAINT "chk_attendance_daily_record_absence_days" CHECK ("attendance_daily_records"."absence_days" >= 0 AND "attendance_daily_records"."absence_days" <= 1)
);
--> statement-breakpoint
CREATE TABLE "hr_units" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" varchar(150) NOT NULL,
	"name_am" varchar(150),
	"code" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "hr_units_name_en_unique" UNIQUE("name_en"),
	CONSTRAINT "hr_units_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user_hr_units" (
	"user_id" text NOT NULL,
	"hr_unit_id" uuid NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_hr_units_user_id_hr_unit_id_pk" PRIMARY KEY("user_id","hr_unit_id")
);
--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "hr_unit_id" uuid;--> statement-breakpoint
ALTER TABLE "attendance_daily_record_adjustments" ADD CONSTRAINT "attendance_daily_record_adjustments_attendance_daily_record_id_attendance_daily_records_id_fk" FOREIGN KEY ("attendance_daily_record_id") REFERENCES "public"."attendance_daily_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_daily_record_adjustments" ADD CONSTRAINT "attendance_daily_record_adjustments_adjusted_by_user_id_fk" FOREIGN KEY ("adjusted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_first_punch_id_attendance_punches_id_fk" FOREIGN KEY ("first_punch_id") REFERENCES "public"."attendance_punches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_last_punch_id_attendance_punches_id_fk" FOREIGN KEY ("last_punch_id") REFERENCES "public"."attendance_punches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_supervisor_approved_by_user_id_fk" FOREIGN KEY ("supervisor_approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_hr_approved_by_user_id_fk" FOREIGN KEY ("hr_approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_returned_by_user_id_fk" FOREIGN KEY ("returned_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hr_units" ADD CONSTRAINT "user_hr_units_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_hr_units" ADD CONSTRAINT "user_hr_units_hr_unit_id_hr_units_id_fk" FOREIGN KEY ("hr_unit_id") REFERENCES "public"."hr_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_attendance_daily_record_adjustments_record_id" ON "attendance_daily_record_adjustments" USING btree ("attendance_daily_record_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_daily_record_adjustments_adjusted_by" ON "attendance_daily_record_adjustments" USING btree ("adjusted_by");--> statement-breakpoint
CREATE INDEX "idx_attendance_daily_record_adjustments_created_at" ON "attendance_daily_record_adjustments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ux_attendance_daily_records_employee_date" ON "attendance_daily_records" USING btree ("employee_id","attendance_date");--> statement-breakpoint
CREATE INDEX "idx_attendance_daily_records_employee_id" ON "attendance_daily_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_daily_records_attendance_date" ON "attendance_daily_records" USING btree ("attendance_date");--> statement-breakpoint
CREATE INDEX "idx_attendance_daily_records_status" ON "attendance_daily_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_hr_units_user_id_idx" ON "user_hr_units" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_hr_units_hr_unit_id_idx" ON "user_hr_units" USING btree ("hr_unit_id");--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_hr_unit_id_hr_units_id_fk" FOREIGN KEY ("hr_unit_id") REFERENCES "public"."hr_units"("id") ON DELETE no action ON UPDATE no action;