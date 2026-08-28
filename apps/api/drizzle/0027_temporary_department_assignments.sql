CREATE TABLE IF NOT EXISTS "temporary_department_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "employee_id" uuid NOT NULL,
  "source_department_id" uuid NOT NULL,
  "target_department_id" uuid NOT NULL,
  "effective_from" date NOT NULL,
  "effective_to" date NOT NULL,
  "reason" text NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_temporary_department_assignment_departments_differ" CHECK ("temporary_department_assignments"."source_department_id" <> "temporary_department_assignments"."target_department_id"),
  CONSTRAINT "chk_temporary_department_assignment_date_range" CHECK ("temporary_department_assignments"."effective_from" <= "temporary_department_assignments"."effective_to")
);
--> statement-breakpoint
ALTER TABLE "temporary_department_assignments" ADD CONSTRAINT "temporary_department_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "temporary_department_assignments" ADD CONSTRAINT "temporary_department_assignments_source_department_id_departments_id_fk" FOREIGN KEY ("source_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "temporary_department_assignments" ADD CONSTRAINT "temporary_department_assignments_target_department_id_departments_id_fk" FOREIGN KEY ("target_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "temporary_department_assignments" ADD CONSTRAINT "temporary_department_assignments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_temporary_department_assignments_employee" ON "temporary_department_assignments" ("employee_id","effective_from","effective_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_temporary_department_assignments_target_department" ON "temporary_department_assignments" ("target_department_id","effective_from","effective_to");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_temporary_department_assignments_active" ON "temporary_department_assignments" ("is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_temporary_department_assignments_no_overlap" ON "temporary_department_assignments" ("employee_id","effective_from","effective_to") WHERE "is_active" = true;
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "temporary_department_assignments"
  ADD CONSTRAINT "temporary_department_assignments_no_active_overlap"
  EXCLUDE USING gist (
    "employee_id" WITH =,
    daterange("effective_from", "effective_to", '[]') WITH &&
  )
  WHERE ("is_active" = true);
