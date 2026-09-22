CREATE TABLE IF NOT EXISTS "ismis_leave_import_batches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "source_file_name" varchar(255) NOT NULL,
  "imported_by" text NOT NULL REFERENCES "user"("id"),
  "status" varchar(30) NOT NULL DEFAULT 'PENDING',
  "row_count" integer NOT NULL DEFAULT 0,
  "matched_count" integer NOT NULL DEFAULT 0,
  "unmatched_count" integer NOT NULL DEFAULT 0,
  "completed_by" text REFERENCES "user"("id"),
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "chk_ismis_leave_import_status" CHECK ("status" IN ('PENDING', 'COMPLETED', 'REJECTED'))
);

CREATE TABLE IF NOT EXISTS "ismis_leave_days" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "batch_id" uuid NOT NULL REFERENCES "ismis_leave_import_batches"("id") ON DELETE CASCADE,
  "source_employee_id" varchar(80) NOT NULL,
  "employee_id" uuid REFERENCES "employees"("id"),
  "source_name" varchar(255),
  "source_leave_type" varchar(150),
  "source_start_date" varchar(30) NOT NULL,
  "source_end_date" varchar(30) NOT NULL,
  "source_leave_days" numeric(8,2),
  "attendance_date" date NOT NULL,
  "match_status" varchar(20) NOT NULL,
  "note" text,
  CONSTRAINT "ux_ismis_leave_days_batch_employee_date" UNIQUE ("batch_id", "source_employee_id", "attendance_date")
);
CREATE INDEX IF NOT EXISTS "idx_ismis_leave_days_batch_date" ON "ismis_leave_days" ("batch_id", "attendance_date");
CREATE INDEX IF NOT EXISTS "idx_ismis_leave_days_employee_date" ON "ismis_leave_days" ("employee_id", "attendance_date");

CREATE TABLE IF NOT EXISTS "attendance_leave_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "date_from" date NOT NULL,
  "date_to" date NOT NULL,
  "batch_id" uuid NOT NULL REFERENCES "ismis_leave_import_batches"("id"),
  "checked_by" text NOT NULL REFERENCES "user"("id"),
  "checked_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "idx_attendance_leave_verifications_period" ON "attendance_leave_verifications" ("date_from", "date_to");
