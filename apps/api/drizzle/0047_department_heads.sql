-- A department head sees attendance for their department and every department below it
-- in the organization structure (supervisor report). One employee may head several departments.
ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "head_employee_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "departments" ADD CONSTRAINT "departments_head_employee_id_employees_id_fk" FOREIGN KEY ("head_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_departments_head_employee_id" ON "departments" USING btree ("head_employee_id");
