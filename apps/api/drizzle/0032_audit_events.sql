CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
  "actor_user_id" text,
  "actor_name" text,
  "actor_email" text,
  "actor_type" varchar(20) DEFAULT 'USER' NOT NULL,
  "action" varchar(80) NOT NULL,
  "outcome" varchar(20) DEFAULT 'SUCCESS' NOT NULL,
  "resource_type" varchar(80) NOT NULL,
  "resource_id" text,
  "resource_label" text,
  "employee_id" uuid,
  "department_id" uuid,
  "supervisor_delegation_id" uuid,
  "ip_address" text,
  "user_agent" text,
  "request_id" text,
  "changes" jsonb,
  "metadata" jsonb
);

DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
 WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
 WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
 WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_supervisor_delegation_id_fk" FOREIGN KEY ("supervisor_delegation_id") REFERENCES "supervisor_delegations"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
 WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "chk_audit_events_actor_type" CHECK ("actor_type" IN ('USER', 'SYSTEM', 'DEVICE'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "audit_events" ADD CONSTRAINT "chk_audit_events_outcome" CHECK ("outcome" IN ('SUCCESS', 'DENIED', 'FAILED'));
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_audit_events_occurred_at" ON "audit_events" ("occurred_at");
CREATE INDEX IF NOT EXISTS "idx_audit_events_actor_occurred_at" ON "audit_events" ("actor_user_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_audit_events_resource" ON "audit_events" ("resource_type", "resource_id");
CREATE INDEX IF NOT EXISTS "idx_audit_events_action_occurred_at" ON "audit_events" ("action", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_audit_events_employee_occurred_at" ON "audit_events" ("employee_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "idx_audit_events_department_occurred_at" ON "audit_events" ("department_id", "occurred_at");
