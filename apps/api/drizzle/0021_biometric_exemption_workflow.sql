ALTER TABLE "biometric_exemptions" ADD COLUMN "supporting_evidence_name" text;
ALTER TABLE "biometric_exemptions" ADD COLUMN "supporting_evidence_url" text;
ALTER TABLE "biometric_exemptions" ADD COLUMN "supporting_evidence_mime_type" varchar(150);
ALTER TABLE "biometric_exemptions" ADD COLUMN "supporting_evidence_size" integer;
ALTER TABLE "biometric_exemptions" ADD COLUMN "status" varchar(30) DEFAULT 'PENDING_SUPERVISOR' NOT NULL;
ALTER TABLE "biometric_exemptions" ADD COLUMN "requested_by" text;
ALTER TABLE "biometric_exemptions" ADD COLUMN "approved_by" text;
ALTER TABLE "biometric_exemptions" ADD COLUMN "approved_at" timestamp(6) with time zone;
ALTER TABLE "biometric_exemptions" ADD COLUMN "rejected_by" text;
ALTER TABLE "biometric_exemptions" ADD COLUMN "rejected_at" timestamp(6) with time zone;
ALTER TABLE "biometric_exemptions" ADD COLUMN "rejection_reason" text;

UPDATE "biometric_exemptions"
SET "status" = CASE WHEN "is_active" = true THEN 'APPROVED' ELSE 'INACTIVE' END;

ALTER TABLE "biometric_exemptions" ALTER COLUMN "is_active" SET DEFAULT false;
ALTER TABLE "biometric_exemptions" ADD CONSTRAINT "chk_biometric_exemption_status" CHECK ("biometric_exemptions"."status" IN ('PENDING_SUPERVISOR', 'APPROVED', 'REJECTED', 'INACTIVE'));
ALTER TABLE "biometric_exemptions" ADD CONSTRAINT "biometric_exemptions_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "biometric_exemptions" ADD CONSTRAINT "biometric_exemptions_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "biometric_exemptions" ADD CONSTRAINT "biometric_exemptions_rejected_by_user_id_fk" FOREIGN KEY ("rejected_by") REFERENCES "user"("id") ON DELETE no action ON UPDATE no action;
