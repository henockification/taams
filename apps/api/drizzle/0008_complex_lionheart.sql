CREATE TABLE "attendance_punches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"biometric_id" varchar(100) NOT NULL,
	"device_id" uuid,
	"sync_batch_id" uuid,
	"external_uid" varchar(200),
	"punch_time" timestamp NOT NULL,
	"punch_type" varchar(30) DEFAULT 'UNKNOWN' NOT NULL,
	"verification_type" varchar(50),
	"device_punch_id" varchar(150),
	"source" varchar(30) DEFAULT 'DEVICE' NOT NULL,
	"is_processed" boolean DEFAULT false NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"manual_reason" text,
	"approved_by" text,
	"approved_at" timestamp,
	"processed_at" timestamp,
	"raw_payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_punch_type" CHECK ("attendance_punches"."punch_type" IN ('IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN')),
	CONSTRAINT "chk_punch_source" CHECK ("attendance_punches"."source" IN ('DEVICE', 'MANUAL', 'IMPORT', 'MOBILE', 'WEB'))
);
--> statement-breakpoint
CREATE TABLE "attendance_sync_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid,
	"sync_started_at" timestamp DEFAULT now() NOT NULL,
	"sync_completed_at" timestamp,
	"sync_status" varchar(30) DEFAULT 'STARTED' NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"successful_records" integer DEFAULT 0 NOT NULL,
	"failed_records" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_sync_status" CHECK ("attendance_sync_batches"."sync_status" IN ('STARTED', 'COMPLETED', 'FAILED', 'PARTIAL'))
);
--> statement-breakpoint
CREATE TABLE "biometric_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_name" varchar(150) NOT NULL,
	"device_code" varchar(100) NOT NULL,
	"ip_address" varchar(100),
	"port" integer DEFAULT 4370,
	"location_name" varchar(150),
	"department_id" uuid,
	"device_type" varchar(50) DEFAULT 'BIOMETRIC' NOT NULL,
	"connection_type" varchar(50) DEFAULT 'TCP_IP' NOT NULL,
	"vendor" varchar(50) DEFAULT 'ZKTECO' NOT NULL,
	"protocol" varchar(50) DEFAULT 'TCP_IP' NOT NULL,
	"integration_mode" varchar(30) DEFAULT 'HYBRID' NOT NULL,
	"preferred_mode" varchar(30) DEFAULT 'PUSH_ADMS' NOT NULL,
	"push_enabled" boolean DEFAULT true NOT NULL,
	"pull_enabled" boolean DEFAULT true NOT NULL,
	"push_secret" varchar(200),
	"communication_key" varchar(100),
	"serial_number" varchar(150),
	"model" varchar(150),
	"manufacturer" varchar(150),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_sync_at" timestamp,
	"last_successful_sync_at" timestamp,
	"last_failed_sync_at" timestamp,
	"last_push_at" timestamp,
	"last_pull_at" timestamp,
	"last_seen_at" timestamp,
	"last_error_message" text,
	"sync_interval_minutes" integer DEFAULT 5 NOT NULL,
	"auto_sync_enabled" boolean DEFAULT true NOT NULL,
	"health_status" varchar(30) DEFAULT 'UNKNOWN' NOT NULL,
	"fallback_to_pull" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "biometric_devices_device_code_unique" UNIQUE("device_code"),
	CONSTRAINT "chk_device_type" CHECK ("biometric_devices"."device_type" IN ('BIOMETRIC', 'RFID', 'FACE_RECOGNITION', 'MOBILE', 'WEB')),
	CONSTRAINT "chk_connection_type" CHECK ("biometric_devices"."connection_type" IN ('TCP_IP', 'USB', 'WIFI', 'API')),
	CONSTRAINT "chk_device_integration_mode" CHECK ("biometric_devices"."integration_mode" IN ('PUSH_ADMS', 'TCP_PULL', 'HYBRID', 'MANUAL_ONLY', 'DISABLED')),
	CONSTRAINT "chk_device_health_status" CHECK ("biometric_devices"."health_status" IN ('ONLINE', 'OFFLINE', 'UNKNOWN', 'ERROR'))
);
--> statement-breakpoint
CREATE TABLE "biometric_exemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid,
	"position_id" uuid,
	"reason" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_biometric_exemption_target" CHECK (num_nonnulls("biometric_exemptions"."employee_id", "biometric_exemptions"."position_id") = 1)
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" varchar(150) NOT NULL,
	"name_am" varchar(150),
	"code" varchar(50),
	"parent_department_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "departments_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "employee_supervisors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"supervisor_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"effective_from" date DEFAULT CURRENT_DATE NOT NULL,
	"effective_to" date,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_employee_not_own_supervisor" CHECK ("employee_supervisors"."employee_id" <> "employee_supervisors"."supervisor_id")
);
--> statement-breakpoint
CREATE TABLE "employee_work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"work_schedule_id" uuid NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"employee_code" varchar(50) NOT NULL,
	"payroll_id" varchar(50),
	"biometric_id" varchar(50),
	"first_name_en" varchar(100) NOT NULL,
	"middle_name_en" varchar(100),
	"last_name_en" varchar(100) NOT NULL,
	"first_name_am" varchar(100),
	"middle_name_am" varchar(100),
	"last_name_am" varchar(100),
	"gender" varchar(20),
	"phone_number" varchar(50),
	"email" varchar(150),
	"department_id" uuid NOT NULL,
	"position_id" uuid,
	"position_name" varchar(200),
	"employment_status" varchar(30) DEFAULT 'ACTIVE' NOT NULL,
	"employment_type" varchar(30) DEFAULT 'PERMANENT' NOT NULL,
	"hire_date" date,
	"termination_date" date,
	"source_id_no" varchar(50),
	"source_employee_code" varchar(50),
	"source_employment_status" varchar(100),
	"source_department_name" varchar(200),
	"source_position_name" varchar(200),
	"source_position_code" varchar(50),
	"salary" numeric(14, 2),
	"salary_step" varchar(50),
	"source_imported_at" timestamp (6) with time zone,
	"source_raw_payload" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_code_unique" UNIQUE("employee_code"),
	CONSTRAINT "employees_payroll_id_unique" UNIQUE("payroll_id"),
	CONSTRAINT "employees_biometric_id_unique" UNIQUE("biometric_id"),
	CONSTRAINT "chk_employee_status" CHECK ("employees"."employment_status" IN ('ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED')),
	CONSTRAINT "chk_employee_type" CHECK ("employees"."employment_type" IN ('PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY'))
);
--> statement-breakpoint
CREATE TABLE "leave_balance_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"leave_balance_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"leave_request_id" uuid,
	"linked_transaction_id" uuid,
	"type" varchar(40) NOT NULL,
	"days" numeric(8, 2) NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_leave_balance_transaction_type" CHECK ("leave_balance_transactions"."type" IN ('INITIAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'DEDUCTION', 'REVERSAL', 'ADJUSTMENT'))
);
--> statement-breakpoint
CREATE TABLE "leave_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"fiscal_year_id" uuid NOT NULL,
	"employment_type_snapshot" varchar(30) NOT NULL,
	"opening" numeric(8, 2) DEFAULT '0' NOT NULL,
	"transferred_in" numeric(8, 2) DEFAULT '0' NOT NULL,
	"used" numeric(8, 2) DEFAULT '0' NOT NULL,
	"available" numeric(8, 2) DEFAULT '0' NOT NULL,
	"created_by" text,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_balances_employee_fiscal_year_unique" UNIQUE("employee_id","fiscal_year_id"),
	CONSTRAINT "chk_leave_balance_employment_type" CHECK ("leave_balances"."employment_type_snapshot" IN ('PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY')),
	CONSTRAINT "chk_leave_balance_opening_nonnegative" CHECK ("leave_balances"."opening" >= 0),
	CONSTRAINT "chk_leave_balance_transferred_in_nonnegative" CHECK ("leave_balances"."transferred_in" >= 0),
	CONSTRAINT "chk_leave_balance_used_nonnegative" CHECK ("leave_balances"."used" >= 0),
	CONSTRAINT "chk_leave_balance_available_nonnegative" CHECK ("leave_balances"."available" >= 0)
);
--> statement-breakpoint
CREATE TABLE "leave_fiscal_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"starts_at" date NOT NULL,
	"ends_at" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_fiscal_years_name_unique" UNIQUE("name"),
	CONSTRAINT "chk_leave_fiscal_year_date_range" CHECK ("leave_fiscal_years"."starts_at" <= "leave_fiscal_years"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "leave_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"leave_type_id" uuid NOT NULL,
	"fiscal_year_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"requested_days" numeric(8, 2) NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"requested_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"rejected_by" text,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_leave_request_date_range" CHECK ("leave_requests"."start_date" <= "leave_requests"."end_date"),
	CONSTRAINT "chk_leave_request_status" CHECK ("leave_requests"."status" IN ('PENDING', 'APPROVED', 'REJECTED')),
	CONSTRAINT "chk_leave_request_days_positive" CHECK ("leave_requests"."requested_days" > 0)
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name_en" varchar(150) NOT NULL,
	"name_am" varchar(150),
	"description" text,
	"deducts_annual_balance" boolean DEFAULT false NOT NULL,
	"requires_balance" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "manual_punch_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"requested_punch_time" timestamp NOT NULL,
	"requested_punch_type" varchar(30) NOT NULL,
	"reason" text NOT NULL,
	"status" varchar(30) DEFAULT 'PENDING' NOT NULL,
	"requested_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"rejected_by" text,
	"rejected_at" timestamp,
	"rejection_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chk_manual_punch_status" CHECK ("manual_punch_requests"."status" IN ('PENDING', 'APPROVED', 'REJECTED')),
	CONSTRAINT "chk_manual_requested_punch_type" CHECK ("manual_punch_requests"."requested_punch_type" IN ('IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN'))
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" varchar(150) NOT NULL,
	"name_am" varchar(150),
	"code" varchar(50),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "shift_breaks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_am" varchar(100),
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"is_paid" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_segments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shift_id" uuid NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_am" varchar(100),
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"sort_order" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_am" varchar(100),
	"grace_period_minutes" integer DEFAULT 0 NOT NULL,
	"late_after_minutes" integer DEFAULT 0 NOT NULL,
	"early_out_before_minutes" integer DEFAULT 0 NOT NULL,
	"is_overnight" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_schedule_days" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_schedule_id" uuid NOT NULL,
	"day_of_week" varchar(20) NOT NULL,
	"shift_id" uuid,
	"is_off_day" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_schedule_days_schedule_day_unique" UNIQUE("work_schedule_id","day_of_week")
);
--> statement-breakpoint
CREATE TABLE "work_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_am" varchar(100),
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_device_id_biometric_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."biometric_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_sync_batch_id_attendance_sync_batches_id_fk" FOREIGN KEY ("sync_batch_id") REFERENCES "public"."attendance_sync_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_punches" ADD CONSTRAINT "attendance_punches_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_sync_batches" ADD CONSTRAINT "attendance_sync_batches_device_id_biometric_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."biometric_devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_devices" ADD CONSTRAINT "biometric_devices_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_exemptions" ADD CONSTRAINT "biometric_exemptions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_exemptions" ADD CONSTRAINT "biometric_exemptions_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_exemptions" ADD CONSTRAINT "biometric_exemptions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "biometric_exemptions" ADD CONSTRAINT "biometric_exemptions_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_department_id_departments_id_fk" FOREIGN KEY ("parent_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_supervisors" ADD CONSTRAINT "employee_supervisors_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_supervisors" ADD CONSTRAINT "employee_supervisors_supervisor_id_employees_id_fk" FOREIGN KEY ("supervisor_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_work_schedules" ADD CONSTRAINT "employee_work_schedules_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_work_schedules" ADD CONSTRAINT "employee_work_schedules_work_schedule_id_work_schedules_id_fk" FOREIGN KEY ("work_schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_leave_balance_id_leave_balances_id_fk" FOREIGN KEY ("leave_balance_id") REFERENCES "public"."leave_balances"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_fiscal_year_id_leave_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."leave_fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_transactions" ADD CONSTRAINT "leave_balance_transactions_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_fiscal_year_id_leave_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."leave_fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balances" ADD CONSTRAINT "leave_balances_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_fiscal_year_id_leave_fiscal_years_id_fk" FOREIGN KEY ("fiscal_year_id") REFERENCES "public"."leave_fiscal_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_punch_requests" ADD CONSTRAINT "manual_punch_requests_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_punch_requests" ADD CONSTRAINT "manual_punch_requests_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_punch_requests" ADD CONSTRAINT "manual_punch_requests_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_punch_requests" ADD CONSTRAINT "manual_punch_requests_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_breaks" ADD CONSTRAINT "shift_breaks_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_segments" ADD CONSTRAINT "shift_segments_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_work_schedule_id_work_schedules_id_fk" FOREIGN KEY ("work_schedule_id") REFERENCES "public"."work_schedules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_schedule_days" ADD CONSTRAINT "work_schedule_days_shift_id_shifts_id_fk" FOREIGN KEY ("shift_id") REFERENCES "public"."shifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_attendance_punch_unique" ON "attendance_punches" USING btree ("biometric_id","punch_time",COALESCE("device_id", '00000000-0000-0000-0000-000000000000'::uuid));--> statement-breakpoint
CREATE UNIQUE INDEX "ux_attendance_punch_external_uid" ON "attendance_punches" USING btree ("device_id","external_uid") WHERE "attendance_punches"."external_uid" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_attendance_punches_employee_id" ON "attendance_punches" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_punches_biometric_id" ON "attendance_punches" USING btree ("biometric_id");--> statement-breakpoint
CREATE INDEX "idx_attendance_punches_punch_time" ON "attendance_punches" USING btree ("punch_time");--> statement-breakpoint
CREATE INDEX "idx_attendance_punches_employee_time" ON "attendance_punches" USING btree ("employee_id","punch_time");--> statement-breakpoint
CREATE INDEX "idx_attendance_punches_processed" ON "attendance_punches" USING btree ("is_processed");--> statement-breakpoint
CREATE INDEX "idx_attendance_sync_batches_device_id" ON "attendance_sync_batches" USING btree ("device_id");--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_exemptions_active_employee_unique" ON "biometric_exemptions" USING btree ("employee_id") WHERE "biometric_exemptions"."is_active" = true AND "biometric_exemptions"."employee_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "biometric_exemptions_active_position_unique" ON "biometric_exemptions" USING btree ("position_id") WHERE "biometric_exemptions"."is_active" = true AND "biometric_exemptions"."position_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "biometric_exemptions_employee_id_idx" ON "biometric_exemptions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "biometric_exemptions_position_id_idx" ON "biometric_exemptions" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX "biometric_exemptions_active_idx" ON "biometric_exemptions" USING btree ("is_active");