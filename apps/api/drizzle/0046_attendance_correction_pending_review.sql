-- Attendance corrections are decided by the supervisor only: new requests start
-- as PENDING_REVIEW instead of waiting for an HR review step.
ALTER TABLE "manual_punch_requests" DROP CONSTRAINT IF EXISTS "chk_manual_punch_status";--> statement-breakpoint
ALTER TABLE "manual_punch_requests" ADD CONSTRAINT "chk_manual_punch_status" CHECK ("manual_punch_requests"."status" IN ('PENDING', 'APPROVED', 'REJECTED', 'PENDING_REVIEW', 'PENDING_HR_REVIEW', 'HR_REVIEWED', 'HR_REJECTED', 'SUPERVISOR_APPROVED', 'SUPERVISOR_REJECTED'));--> statement-breakpoint
ALTER TABLE "manual_punch_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW';--> statement-breakpoint
UPDATE "manual_punch_requests" SET "status" = 'PENDING_REVIEW' WHERE "status" IN ('PENDING', 'PENDING_HR_REVIEW', 'HR_REVIEWED');
