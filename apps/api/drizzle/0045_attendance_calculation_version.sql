-- Existing records default to version 0, so records calculated by the previous
-- attendance rules are recalculated the next time they are listed.
ALTER TABLE "attendance_daily_records"
ADD COLUMN IF NOT EXISTS "calculation_version" integer NOT NULL DEFAULT 0;
