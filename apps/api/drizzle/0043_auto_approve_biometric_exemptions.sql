ALTER TABLE "biometric_exemptions"
ALTER COLUMN "status" SET DEFAULT 'APPROVED';

ALTER TABLE "biometric_exemptions"
ALTER COLUMN "is_active" SET DEFAULT true;

-- Pending rows were created inactive. Clear any inconsistent active flag first so
-- the partial unique indexes cannot block the deterministic promotion below.
UPDATE "biometric_exemptions"
SET "is_active" = false
WHERE "status" = 'PENDING_SUPERVISOR';

WITH ranked_pending AS (
  SELECT
    pending."id",
    ROW_NUMBER() OVER (
      PARTITION BY pending."employee_id", pending."position_id"
      ORDER BY pending."created_at" DESC, pending."id" DESC
    ) AS pending_rank
  FROM "biometric_exemptions" pending
  WHERE pending."status" = 'PENDING_SUPERVISOR'
),
promotion_plan AS (
  SELECT
    ranked."id",
    ranked."pending_rank" = 1
      AND NOT EXISTS (
        SELECT 1
        FROM "biometric_exemptions" active
        JOIN "biometric_exemptions" candidate ON candidate."id" = ranked."id"
        WHERE active."is_active" = true
          AND active."id" <> candidate."id"
          AND active."employee_id" IS NOT DISTINCT FROM candidate."employee_id"
          AND active."position_id" IS NOT DISTINCT FROM candidate."position_id"
      ) AS should_activate
  FROM ranked_pending ranked
)
UPDATE "biometric_exemptions" exemption
SET
  "status" = 'APPROVED',
  "is_active" = plan.should_activate,
  "approved_by" = COALESCE(
    exemption."approved_by",
    exemption."requested_by",
    exemption."created_by",
    exemption."updated_by"
  ),
  "approved_at" = COALESCE(exemption."approved_at", exemption."created_at", NOW()),
  "rejected_by" = NULL,
  "rejected_at" = NULL,
  "rejection_reason" = NULL,
  "updated_by" = COALESCE(
    exemption."approved_by",
    exemption."requested_by",
    exemption."created_by",
    exemption."updated_by"
  ),
  "updated_at" = NOW()
FROM promotion_plan plan
WHERE exemption."id" = plan."id";

