ALTER TABLE "employees" DROP CONSTRAINT IF EXISTS "employees_hr_unit_id_hr_units_id_fk";
DROP INDEX IF EXISTS "employees_hr_unit_id_idx";
ALTER TABLE "employees" DROP COLUMN IF EXISTS "hr_unit_id";

DROP TABLE IF EXISTS "user_hr_units";
DROP TABLE IF EXISTS "hr_units";

DELETE FROM "permissions"
WHERE "name" IN (
  'hr-units:read',
  'hr-units:add',
  'hr-units:edit',
  'user-hr-units:edit'
);
