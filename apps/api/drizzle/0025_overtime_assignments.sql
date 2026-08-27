ALTER TABLE "overtime_requests" ALTER COLUMN "status" SET DEFAULT 'ASSIGNED';
UPDATE "overtime_requests" SET "status" = 'ASSIGNED' WHERE "status" = 'PENDING';
ALTER TABLE "overtime_requests" DROP CONSTRAINT IF EXISTS "chk_overtime_request_status";
ALTER TABLE "overtime_requests" ADD CONSTRAINT "chk_overtime_request_status" CHECK ("overtime_requests"."status" IN ('ASSIGNED', 'APPROVED', 'REJECTED'));
