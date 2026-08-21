ALTER TABLE "manual_punch_requests" ADD COLUMN "supporting_document_name" text;
ALTER TABLE "manual_punch_requests" ADD COLUMN "supporting_document_url" text;
ALTER TABLE "manual_punch_requests" ADD COLUMN "supporting_document_mime_type" varchar(150);
ALTER TABLE "manual_punch_requests" ADD COLUMN "supporting_document_size" integer;
ALTER TABLE "manual_punch_requests" ADD COLUMN "hr_reviewed_by" text;
ALTER TABLE "manual_punch_requests" ADD COLUMN "hr_reviewed_at" timestamp;
ALTER TABLE "manual_punch_requests" ADD COLUMN "hr_review_note" text;

ALTER TABLE "manual_punch_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING_HR_REVIEW';
UPDATE "manual_punch_requests" SET "status" = 'PENDING_HR_REVIEW' WHERE "status" = 'PENDING';
UPDATE "manual_punch_requests" SET "status" = 'SUPERVISOR_APPROVED' WHERE "status" = 'APPROVED';
UPDATE "manual_punch_requests" SET "status" = 'SUPERVISOR_REJECTED' WHERE "status" = 'REJECTED';

ALTER TABLE "manual_punch_requests" DROP CONSTRAINT IF EXISTS "chk_manual_punch_status";
ALTER TABLE "manual_punch_requests" ADD CONSTRAINT "chk_manual_punch_status" CHECK ("manual_punch_requests"."status" IN ('PENDING', 'APPROVED', 'REJECTED', 'PENDING_HR_REVIEW', 'HR_REVIEWED', 'HR_REJECTED', 'SUPERVISOR_APPROVED', 'SUPERVISOR_REJECTED'));

ALTER TABLE "manual_punch_requests" ADD CONSTRAINT "manual_punch_requests_hr_reviewed_by_user_id_fk" FOREIGN KEY ("hr_reviewed_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
