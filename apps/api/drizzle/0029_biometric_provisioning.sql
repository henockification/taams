ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "firmware_version" varchar(150);
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "platform_version" varchar(150);
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "fingerprint_algorithm" varchar(150);
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "provisioning_role" varchar(30) DEFAULT 'TARGET' NOT NULL;
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "provisioning_enabled" boolean DEFAULT false NOT NULL;
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "last_provisioning_at" timestamp;
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "last_provisioning_status" varchar(30);

DO $$ BEGIN
  ALTER TABLE "biometric_devices" ADD CONSTRAINT "chk_biometric_device_provisioning_role"
    CHECK ("provisioning_role" IN ('ENROLLMENT_SOURCE', 'TARGET'));
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "biometric_devices_one_active_enrollment_source"
  ON "biometric_devices" ("provisioning_role")
  WHERE "provisioning_role" = 'ENROLLMENT_SOURCE' AND "is_active" = true;

CREATE TABLE IF NOT EXISTS "biometric_provisioning_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "preview_job_id" uuid,
  "source_device_id" uuid NOT NULL,
  "mode" varchar(30) NOT NULL,
  "status" varchar(30) DEFAULT 'QUEUED' NOT NULL,
  "is_preview" boolean DEFAULT true NOT NULL,
  "requested_employee_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "requested_target_device_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "summary" jsonb,
  "error_message" text,
  "requested_by" text NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_biometric_provisioning_job_mode" CHECK ("mode" IN ('FULL_SYNC', 'EMPLOYEE_UPSERT', 'EMPLOYEE_REMOVE')),
  CONSTRAINT "chk_biometric_provisioning_job_status" CHECK ("status" IN ('QUEUED', 'RUNNING', 'PREVIEW_READY', 'WAITING_CONFIRMATION', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELED'))
);

DO $$ BEGIN
  ALTER TABLE "biometric_provisioning_jobs" ADD CONSTRAINT "biometric_provisioning_jobs_preview_job_id_fk"
    FOREIGN KEY ("preview_job_id") REFERENCES "biometric_provisioning_jobs"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "biometric_provisioning_jobs" ADD CONSTRAINT "biometric_provisioning_jobs_source_device_id_fk"
    FOREIGN KEY ("source_device_id") REFERENCES "biometric_devices"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
  ALTER TABLE "biometric_provisioning_jobs" ADD CONSTRAINT "biometric_provisioning_jobs_requested_by_fk"
    FOREIGN KEY ("requested_by") REFERENCES "user"("id");
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_biometric_provisioning_jobs_status_created"
  ON "biometric_provisioning_jobs" ("status", "created_at");

CREATE TABLE IF NOT EXISTS "biometric_provisioning_device_results" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "job_id" uuid NOT NULL,
  "device_id" uuid NOT NULL,
  "status" varchar(30) DEFAULT 'PENDING' NOT NULL,
  "added_users" integer DEFAULT 0 NOT NULL,
  "updated_users" integer DEFAULT 0 NOT NULL,
  "removed_users" integer DEFAULT 0 NOT NULL,
  "missing_templates" integer DEFAULT 0 NOT NULL,
  "uid_conflicts" integer DEFAULT 0 NOT NULL,
  "differences" jsonb,
  "error_message" text,
  "attempts" integer DEFAULT 0 NOT NULL,
  "started_at" timestamp,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "biometric_provisioning_results_job_device_unique" UNIQUE ("job_id", "device_id"),
  CONSTRAINT "chk_biometric_provisioning_result_status" CHECK ("status" IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED')),
  CONSTRAINT "biometric_provisioning_results_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "biometric_provisioning_jobs"("id") ON DELETE CASCADE,
  CONSTRAINT "biometric_provisioning_results_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id")
);

CREATE TABLE IF NOT EXISTS "biometric_device_locks" (
  "device_id" uuid PRIMARY KEY NOT NULL,
  "owner_type" varchar(30) NOT NULL,
  "owner_id" varchar(100) NOT NULL,
  "acquired_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp NOT NULL,
  CONSTRAINT "chk_biometric_device_lock_owner_type" CHECK ("owner_type" IN ('ATTENDANCE', 'PROVISIONING')),
  CONSTRAINT "biometric_device_locks_device_id_fk" FOREIGN KEY ("device_id") REFERENCES "biometric_devices"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_biometric_device_locks_expires" ON "biometric_device_locks" ("expires_at");

INSERT INTO "permissions" ("name", "resource", "action", "description", "created_at", "updated_at") VALUES
  ('biometric-provisioning:read', 'biometric-provisioning', 'read', 'View biometric provisioning jobs and previews', now(), now()),
  ('biometric-provisioning:execute', 'biometric-provisioning', 'execute', 'Preview, confirm, and retry biometric provisioning', now(), now())
ON CONFLICT ("name") DO UPDATE SET
  "resource" = EXCLUDED."resource",
  "action" = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "updated_at" = now();

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT role_row."id", permission_row."id", now()
FROM "roles" role_row
CROSS JOIN "permissions" permission_row
WHERE lower(role_row."name") IN ('super_admin', 'admin', 'human_resource', 'hr')
  AND permission_row."name" IN ('biometric-provisioning:read', 'biometric-provisioning:execute')
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
