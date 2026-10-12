-- Employees away for long-term education (abroad or local) are excluded from attendance
-- and from the IFMIS export for the days between the start date and their return.
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "education_leave_type" varchar(20);--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "education_leave_start" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "education_leave_expected_return" date;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "education_leave_returned_on" date;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "employees" ADD CONSTRAINT "chk_employee_education_leave_type" CHECK ("education_leave_type" IS NULL OR "education_leave_type" IN ('ABROAD', 'LOCAL'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
