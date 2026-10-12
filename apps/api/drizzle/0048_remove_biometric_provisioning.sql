-- Employee biometric provisioning (enrolment copy between devices) has been removed.
-- Drop its tables, device columns, constraints, locks, and permissions. Safe to re-run.
DROP TABLE IF EXISTS "biometric_provisioning_device_results";--> statement-breakpoint
DROP TABLE IF EXISTS "biometric_provisioning_jobs";--> statement-breakpoint
DROP INDEX IF EXISTS "biometric_devices_one_active_enrollment_source";--> statement-breakpoint
ALTER TABLE "biometric_devices" DROP CONSTRAINT IF EXISTS "chk_biometric_device_provisioning_role";--> statement-breakpoint
ALTER TABLE "biometric_devices" DROP COLUMN IF EXISTS "provisioning_role";--> statement-breakpoint
ALTER TABLE "biometric_devices" DROP COLUMN IF EXISTS "provisioning_enabled";--> statement-breakpoint
ALTER TABLE "biometric_devices" DROP COLUMN IF EXISTS "last_provisioning_at";--> statement-breakpoint
ALTER TABLE "biometric_devices" DROP COLUMN IF EXISTS "last_provisioning_status";--> statement-breakpoint
DELETE FROM "biometric_device_locks" WHERE "owner_type" <> 'ATTENDANCE';--> statement-breakpoint
ALTER TABLE "biometric_device_locks" DROP CONSTRAINT IF EXISTS "chk_biometric_device_lock_owner_type";--> statement-breakpoint
ALTER TABLE "biometric_device_locks" ADD CONSTRAINT "chk_biometric_device_lock_owner_type" CHECK ("owner_type" IN ('ATTENDANCE'));--> statement-breakpoint
DELETE FROM "role_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "name" LIKE 'biometric-provisioning:%');--> statement-breakpoint
DELETE FROM "permissions" WHERE "name" LIKE 'biometric-provisioning:%';
