CREATE TABLE IF NOT EXISTS "ifmis_export_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pay_month" integer NOT NULL,
  "pay_year" integer NOT NULL,
  "status" varchar(20) DEFAULT 'PROCESSING' NOT NULL,
  "record_count" integer DEFAULT 0 NOT NULL,
  "pushed_by" text NOT NULL,
  "started_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp (6) with time zone,
  "error_message" text,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_ifmis_export_batches_status" CHECK ("status" IN ('PROCESSING', 'SUCCEEDED', 'FAILED')),
  CONSTRAINT "chk_ifmis_export_batches_month" CHECK ("pay_month" BETWEEN 1 AND 12)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ifmis_export_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "batch_id" uuid NOT NULL,
  "employee_id" uuid NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamp (6) with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ux_ifmis_export_items_batch_employee" UNIQUE("batch_id", "employee_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ifmis_export_batches" ADD CONSTRAINT "ifmis_export_batches_pushed_by_user_id_fk" FOREIGN KEY ("pushed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ifmis_export_items" ADD CONSTRAINT "ifmis_export_items_batch_id_ifmis_export_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."ifmis_export_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ifmis_export_items" ADD CONSTRAINT "ifmis_export_items_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ifmis_export_batches_period" ON "ifmis_export_batches" ("pay_year", "pay_month");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_ifmis_export_batches_active_period" ON "ifmis_export_batches" ("pay_year", "pay_month") WHERE "status" IN ('PROCESSING', 'SUCCEEDED');
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_ifmis_export_items_batch" ON "ifmis_export_items" ("batch_id");
--> statement-breakpoint
INSERT INTO "permissions" ("name", "resource", "action", "description", "created_at", "updated_at") VALUES
  ('ifmis-attendance:read', 'ifmis-attendance', 'read', 'View HR-approved attendance prepared for IFMIS', now(), now()),
  ('ifmis-attendance:push', 'ifmis-attendance', 'push', 'Push a complete payroll month to IFMIS', now(), now())
ON CONFLICT ("name") DO UPDATE SET
  "resource" = EXCLUDED."resource", "action" = EXCLUDED."action",
  "description" = EXCLUDED."description", "updated_at" = now();
--> statement-breakpoint
INSERT INTO "roles" ("name", "description", "created_at", "updated_at") VALUES
  ('finance', 'Finance user with IFMIS attendance review and export access', now(), now())
ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description", "updated_at" = now();
--> statement-breakpoint
INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT role_row."id", permission_row."id", now()
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE role_row."name" IN ('super_admin', 'admin', 'finance')
  AND permission_row."name" IN ('ifmis-attendance:read', 'ifmis-attendance:push')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
