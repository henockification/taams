ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "early_break_minutes" integer NOT NULL DEFAULT 0;
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "chk_attendance_daily_record_early_break_minutes" CHECK ("early_break_minutes" >= 0);
