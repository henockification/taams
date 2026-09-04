BEGIN;

ALTER TABLE "leave_requests" DROP CONSTRAINT IF EXISTS "chk_leave_request_status";
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "authorized_by" text REFERENCES "user"("id");
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "authorized_at" timestamp;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "authorization_rejected_by" text REFERENCES "user"("id");
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "authorization_rejected_at" timestamp;
ALTER TABLE "leave_requests" ADD COLUMN IF NOT EXISTS "authorization_rejection_reason" text;
UPDATE "leave_requests" SET "status" = 'AUTHORIZED' WHERE "status" = 'APPROVED';
ALTER TABLE "leave_requests" ADD CONSTRAINT "chk_leave_request_status"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'AUTHORIZED', 'REJECTED', 'AUTHORIZATION_REJECTED'));
CREATE INDEX IF NOT EXISTS "idx_leave_requests_status" ON "leave_requests" ("status");

ALTER TABLE "leave_interruptions" DROP CONSTRAINT IF EXISTS "chk_leave_interruption_status";
ALTER TABLE "leave_interruptions" ADD COLUMN IF NOT EXISTS "authorized_by" text REFERENCES "user"("id");
ALTER TABLE "leave_interruptions" ADD COLUMN IF NOT EXISTS "authorized_at" timestamp;
ALTER TABLE "leave_interruptions" ADD COLUMN IF NOT EXISTS "authorization_rejected_by" text REFERENCES "user"("id");
ALTER TABLE "leave_interruptions" ADD COLUMN IF NOT EXISTS "authorization_rejected_at" timestamp;
ALTER TABLE "leave_interruptions" ADD COLUMN IF NOT EXISTS "authorization_rejection_reason" text;
UPDATE "leave_interruptions" SET "status" = 'AUTHORIZED' WHERE "status" = 'APPROVED';
ALTER TABLE "leave_interruptions" ADD CONSTRAINT "chk_leave_interruption_status"
  CHECK ("status" IN ('PENDING', 'APPROVED', 'AUTHORIZED', 'REJECTED', 'AUTHORIZATION_REJECTED'));

INSERT INTO "permissions" ("name", "resource", "action", "description", "created_at", "updated_at")
VALUES ('leave-authorizations:approve', 'leave-authorizations', 'approve', 'Authorize or reject supervisor-approved leave requests', now(), now())
ON CONFLICT ("name") DO UPDATE SET
  "resource" = EXCLUDED."resource",
  "action" = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "updated_at" = now();

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('super_admin', 'human_resource')
  AND p."name" = 'leave-authorizations:approve'
ON CONFLICT DO NOTHING;

COMMIT;
