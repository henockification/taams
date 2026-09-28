ALTER TABLE "attendance_daily_records"
ADD COLUMN IF NOT EXISTS "is_off_day" boolean NOT NULL DEFAULT false;
