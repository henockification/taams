UPDATE "employees"
SET "biometric_id" = "employee_code"
WHERE "biometric_id" IS DISTINCT FROM "employee_code";
