CREATE TABLE IF NOT EXISTS "supervisor_delegations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "supervisor_user_id" text NOT NULL REFERENCES "user"("id"),
  "supervisor_employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "delegate_user_id" text NOT NULL REFERENCES "user"("id"),
  "delegate_employee_id" uuid NOT NULL REFERENCES "employees"("id"),
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  "revoked_by" text REFERENCES "user"("id"),
  "created_by" text NOT NULL REFERENCES "user"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chk_supervisor_delegation_user_not_self" CHECK ("supervisor_user_id" <> "delegate_user_id"),
  CONSTRAINT "chk_supervisor_delegation_employee_not_self" CHECK ("supervisor_employee_id" <> "delegate_employee_id"),
  CONSTRAINT "chk_supervisor_delegation_date_range" CHECK ("starts_at" < "ends_at")
);

CREATE INDEX IF NOT EXISTS "idx_supervisor_delegations_supervisor" ON "supervisor_delegations" ("supervisor_user_id", "starts_at", "ends_at");
CREATE INDEX IF NOT EXISTS "idx_supervisor_delegations_delegate" ON "supervisor_delegations" ("delegate_user_id", "starts_at", "ends_at");

ALTER TABLE "attendance_punches" ADD COLUMN IF NOT EXISTS "supervisor_delegation_id" uuid REFERENCES "supervisor_delegations"("id");
ALTER TABLE "attendance_daily_records" ADD COLUMN IF NOT EXISTS "supervisor_delegation_id" uuid REFERENCES "supervisor_delegations"("id");
ALTER TABLE "attendance_daily_record_adjustments" ADD COLUMN IF NOT EXISTS "supervisor_delegation_id" uuid REFERENCES "supervisor_delegations"("id");
ALTER TABLE "manual_punch_requests" ADD COLUMN IF NOT EXISTS "supervisor_delegation_id" uuid REFERENCES "supervisor_delegations"("id");
ALTER TABLE "overtime_requests" ADD COLUMN IF NOT EXISTS "requested_supervisor_delegation_id" uuid REFERENCES "supervisor_delegations"("id");
ALTER TABLE "overtime_requests" ADD COLUMN IF NOT EXISTS "supervisor_delegation_id" uuid REFERENCES "supervisor_delegations"("id");
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "supervisor_delegation_id" uuid REFERENCES "supervisor_delegations"("id");
ALTER TABLE "leave_interruptions" ADD COLUMN IF NOT EXISTS "supervisor_delegation_id" uuid REFERENCES "supervisor_delegations"("id");
