-- Enrollment sync: TAAMS keeps the users and face/palm templates enrolled on the master
-- device and provisions them to the other devices over ZKTeco ADMS (push) commands.
-- Additive only: the TCP pull path and attendance tables are untouched.
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "is_enrollment_master" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "enrollment_sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "push_protocol_version" varchar(50);--> statement-breakpoint
ALTER TABLE "biometric_devices" ADD COLUMN IF NOT EXISTS "last_command_poll_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ux_biometric_devices_enrollment_master" ON "biometric_devices" ("is_enrollment_master") WHERE "is_enrollment_master" = true;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "biometric_device_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "pin" varchar(50) NOT NULL,
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE set null,
  "name" varchar(100),
  "privilege" integer DEFAULT 0 NOT NULL,
  "password" varchar(50),
  "card" varchar(50),
  "source_device_id" uuid REFERENCES "biometric_devices"("id") ON DELETE set null,
  "last_captured_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ux_biometric_device_users_pin" UNIQUE ("pin")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_biometric_device_users_employee" ON "biometric_device_users" ("employee_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "biometric_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "device_user_id" uuid NOT NULL REFERENCES "biometric_device_users"("id") ON DELETE cascade,
  "bio_type" integer NOT NULL,
  "bio_no" integer DEFAULT 0 NOT NULL,
  "bio_index" integer DEFAULT 0 NOT NULL,
  "valid" integer DEFAULT 1 NOT NULL,
  "duress" integer DEFAULT 0 NOT NULL,
  "major_ver" integer DEFAULT 0 NOT NULL,
  "minor_ver" integer DEFAULT 0 NOT NULL,
  "format" integer DEFAULT 0 NOT NULL,
  "template_enc" text NOT NULL,
  "template_sha256" varchar(64) NOT NULL,
  "captured_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "ux_biometric_templates_slot" UNIQUE ("device_user_id", "bio_type", "bio_no", "bio_index")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "biometric_sync_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "triggered_by" text REFERENCES "user"("id") ON DELETE set null,
  "scope" varchar(20) NOT NULL,
  "device_id" uuid REFERENCES "biometric_devices"("id") ON DELETE set null,
  "employee_id" uuid REFERENCES "employees"("id") ON DELETE set null,
  "allow_removals" boolean DEFAULT false NOT NULL,
  "users_added" integer DEFAULT 0 NOT NULL,
  "users_updated" integer DEFAULT 0 NOT NULL,
  "users_removed" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "chk_biometric_sync_runs_scope" CHECK ("scope" IN ('ALL', 'DEVICE', 'EMPLOYEE', 'MASTER_REFRESH', 'ROSTER_REFRESH', 'AUTO_REMOVE'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_biometric_sync_runs_created" ON "biometric_sync_runs" ("created_at");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "biometric_device_commands" (
  "id" bigserial PRIMARY KEY NOT NULL,
  "device_id" uuid NOT NULL REFERENCES "biometric_devices"("id") ON DELETE cascade,
  "sync_run_id" uuid REFERENCES "biometric_sync_runs"("id") ON DELETE set null,
  "kind" varchar(30) NOT NULL,
  "pin" varchar(50),
  "template_id" uuid REFERENCES "biometric_templates"("id") ON DELETE cascade,
  "templates_hash" varchar(64),
  "command_text" text,
  "status" varchar(20) DEFAULT 'PENDING' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "return_code" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "sent_at" timestamp,
  "completed_at" timestamp,
  CONSTRAINT "chk_biometric_device_commands_kind" CHECK ("kind" IN ('USER_UPSERT', 'BIODATA_UPSERT', 'USER_DELETE', 'QUERY')),
  CONSTRAINT "chk_biometric_device_commands_status" CHECK ("status" IN ('PENDING', 'SENT', 'SUCCEEDED', 'FAILED', 'CANCELLED'))
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_biometric_device_commands_queue" ON "biometric_device_commands" ("device_id", "status", "id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_biometric_device_commands_run" ON "biometric_device_commands" ("sync_run_id", "status");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "biometric_device_roster" (
  "device_id" uuid NOT NULL REFERENCES "biometric_devices"("id") ON DELETE cascade,
  "pin" varchar(50) NOT NULL,
  "templates_hash" varchar(64),
  "confirmed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "biometric_device_roster_pk" PRIMARY KEY ("device_id", "pin")
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "biometric_device_exclusions" (
  "employee_id" uuid NOT NULL REFERENCES "employees"("id") ON DELETE cascade,
  "device_id" uuid NOT NULL REFERENCES "biometric_devices"("id") ON DELETE cascade,
  "created_by" text REFERENCES "user"("id") ON DELETE set null,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "biometric_device_exclusions_pk" PRIMARY KEY ("employee_id", "device_id")
);
