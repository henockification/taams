CREATE TABLE IF NOT EXISTS "hr_department_assignments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "department_id" uuid NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hr_department_assignments" ADD CONSTRAINT "hr_department_assignments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hr_department_assignments" ADD CONSTRAINT "hr_department_assignments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hr_department_assignments" ADD CONSTRAINT "hr_department_assignments_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "hr_department_assignments" ADD CONSTRAINT "hr_department_assignments_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "hr_department_assignments_active_user_department_unique" ON "hr_department_assignments" ("user_id","department_id") WHERE "is_active" = true;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hr_department_assignments_user_active" ON "hr_department_assignments" ("user_id","is_active");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_hr_department_assignments_department_active" ON "hr_department_assignments" ("department_id","is_active");
