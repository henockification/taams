-- Replaces the dated education leave fields with a single indefinite absence flag
-- (EDUCATION | WORK_ABROAD | LEAVE_WITHOUT_PAY). Flagged employees are excluded from
-- attendance and the IFMIS export until the flag is cleared.
ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "absence_reason" varchar(30);--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "employees" ADD CONSTRAINT "chk_employee_absence_reason" CHECK ("absence_reason" IS NULL OR "absence_reason" IN ('EDUCATION', 'WORK_ABROAD', 'LEAVE_WITHOUT_PAY'));
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'employees' AND column_name = 'education_leave_type') THEN
    -- Employees still away on education leave keep their flag.
    UPDATE "employees" SET "absence_reason" = 'EDUCATION'
    WHERE "absence_reason" IS NULL
      AND "education_leave_type" IS NOT NULL
      AND ("education_leave_returned_on" IS NULL OR "education_leave_returned_on" > CURRENT_DATE);
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "chk_employee_education_leave_type";--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN IF EXISTS "education_leave_type";--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN IF EXISTS "education_leave_start";--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN IF EXISTS "education_leave_expected_return";--> statement-breakpoint
ALTER TABLE "employees" DROP COLUMN IF EXISTS "education_leave_returned_on";
