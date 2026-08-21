CREATE TABLE IF NOT EXISTS "holidays" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name_en" varchar(150) NOT NULL,
  "name_am" varchar(150),
  "type" varchar(40) NOT NULL,
  "start_date" date NOT NULL,
  "end_date" date NOT NULL,
  "description" text,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_holiday_type" CHECK ("holidays"."type" IN ('PUBLIC_HOLIDAY', 'INSTITUTION_OFF_DAY')),
  CONSTRAINT "chk_holiday_date_range" CHECK ("holidays"."start_date" <= "holidays"."end_date")
);

ALTER TABLE "holidays" ADD CONSTRAINT "holidays_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "holidays" ADD CONSTRAINT "holidays_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_holidays_date_range" ON "holidays" ("start_date","end_date");
CREATE INDEX IF NOT EXISTS "idx_holidays_active" ON "holidays" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_holidays_type" ON "holidays" ("type");

ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "holiday_id" uuid;
ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "holiday_days" numeric(4,2) DEFAULT '0' NOT NULL;
ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "is_holiday" boolean DEFAULT false NOT NULL;

ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "attendance_daily_records_holiday_id_holidays_id_fk" FOREIGN KEY ("holiday_id") REFERENCES "public"."holidays"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "attendance_daily_records" ADD CONSTRAINT "chk_attendance_daily_record_holiday_days" CHECK ("attendance_daily_records"."holiday_days" >= 0 AND "attendance_daily_records"."holiday_days" <= 1);

CREATE INDEX IF NOT EXISTS "idx_attendance_daily_records_holiday_id" ON "attendance_daily_records" ("holiday_id");
