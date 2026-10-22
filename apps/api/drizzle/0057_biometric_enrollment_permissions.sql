-- Biometric enrollment gets its own permissions; it used to share biometric-devices:read,
-- so the Permissions page could not grant it separately from device monitoring.
BEGIN;

INSERT INTO "permissions" ("name", "resource", "action", "description", "created_at", "updated_at")
VALUES
  ('biometric-enrollment:read', 'biometric-enrollment', 'read', 'View biometric enrollment status and sync runs', now(), now()),
  ('biometric-enrollment:push', 'biometric-enrollment', 'push', 'Sync, provision and remove employee enrollments on biometric devices', now(), now())
ON CONFLICT ("name") DO UPDATE SET
  "resource" = EXCLUDED."resource",
  "action" = EXCLUDED."action",
  "description" = EXCLUDED."description",
  "updated_at" = now();

INSERT INTO "role_permissions" ("role_id", "permission_id", "created_at")
SELECT r."id", p."id", now()
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."name" IN ('super_admin', 'admin', 'system_admin')
  AND p."name" IN ('biometric-enrollment:read', 'biometric-enrollment:push')
ON CONFLICT DO NOTHING;

COMMIT;
