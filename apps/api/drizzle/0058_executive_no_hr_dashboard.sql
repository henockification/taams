-- Executives have their own dashboard; the HR dashboard menu and API are for HR and system
-- administrators. Executives who also hold human_resource keep it through that role.
DELETE FROM "role_permissions" rp
USING "roles" r, "permissions" p
WHERE rp."role_id" = r."id"
  AND rp."permission_id" = p."id"
  AND r."name" = 'executive'
  AND p."name" = 'hr-dashboard:read';
