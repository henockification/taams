ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "duration_days" numeric(4,2) DEFAULT '1' NOT NULL;

ALTER TABLE "holidays" ADD CONSTRAINT "chk_holiday_duration_days" CHECK ("holidays"."duration_days" IN (0.5, 1));
