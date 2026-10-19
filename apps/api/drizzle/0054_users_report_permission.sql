-- Users report: who holds which roles, with login and email status, exportable to Excel.
BEGIN;

INSERT INTO "permissions" ("name", "resource", "action", "description", "created_at", "updated_at")
VALUES ('reports-users:read', 'reports-users', 'read', 'View users report', now(), now())
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
  AND p."name" = 'reports-users:read'
ON CONFLICT DO NOTHING;

COMMIT;
