ALTER TABLE "departments" ADD COLUMN "is_contract" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "departments" AS d
SET "is_contract" = true
WHERE EXISTS (
  SELECT 1 FROM "employees" AS e
  WHERE e."department_id" = d."id" AND e."employment_type" = 'CONTRACT'
)
AND NOT EXISTS (
  SELECT 1 FROM "employees" AS e
  WHERE e."department_id" = d."id" AND e."employment_type" <> 'CONTRACT'
);
