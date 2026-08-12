ALTER TABLE "attendance_daily_records" ALTER COLUMN "check_in_at" DROP NOT NULL;

ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "attendance_days" numeric(4,2) DEFAULT '0' NOT NULL;
ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "leave_days" numeric(4,2) DEFAULT '0' NOT NULL;
ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "payable_days" numeric(4,2) DEFAULT '0' NOT NULL;
ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "absence_days" numeric(4,2) DEFAULT '1' NOT NULL;
ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "is_biometric_exempt" boolean DEFAULT false NOT NULL;
ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "payroll_note" text;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "chk_attendance_daily_record_attendance_days" CHECK ("attendance_days" >= 0 AND "attendance_days" <= 1);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "chk_attendance_daily_record_leave_days" CHECK ("leave_days" >= 0 AND "leave_days" <= 1);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "chk_attendance_daily_record_payable_days" CHECK ("payable_days" >= 0 AND "payable_days" <= 1);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "chk_attendance_daily_record_absence_days" CHECK ("absence_days" >= 0 AND "absence_days" <= 1);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
