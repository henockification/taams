ALTER TABLE "attendance_daily_records"
ADD COLUMN IF NOT EXISTS "session_evaluations" jsonb NOT NULL DEFAULT '[]'::jsonb;
