BEGIN;

CREATE TEMP TABLE _seed_permissions (
  name text PRIMARY KEY,
  resource text NOT NULL,
  action text NOT NULL,
  description text
) ON COMMIT DROP;

INSERT INTO _seed_permissions (name, resource, action, description) VALUES
  ('dashboard:read', 'dashboard', 'read', 'View employee dashboard'),
  ('executive-dashboard:read', 'executive-dashboard', 'read', 'View executive dashboard'),
  ('hr-dashboard:read', 'hr-dashboard', 'read', 'View HR dashboard'),
  ('department-head-dashboard:read', 'department-head-dashboard', 'read', 'View supervisor dashboard'),
  ('permanent-employees:read', 'permanent-employees', 'read', 'View permanent employee imports'),
  ('employees:read', 'employees', 'read', 'View employees'),
  ('employees:create', 'employees', 'create', 'Create employees'),
  ('employees:update', 'employees', 'update', 'Update employees'),
  ('temporary-assignment:read', 'temporary-assignment', 'read', 'View temporary department assignments'),
  ('temporary-assignment:add', 'temporary-assignment', 'add', 'Create temporary department assignments'),
  ('temporary-assignment:edit', 'temporary-assignment', 'edit', 'Update temporary department assignments'),
  ('leave-fiscal-years:read', 'leave-fiscal-years', 'read', 'View leave fiscal years'),
  ('leave-types:read', 'leave-types', 'read', 'View leave types'),
  ('leave-balances:read', 'leave-balances', 'read', 'View leave balances'),
  ('leave-transfer:read', 'leave-transfer', 'read', 'View leave carry-forward'),
  ('leave-request-approvals:approve', 'leave-request-approvals', 'approve', 'Approve or reject supervised leave requests'),
  ('leave-authorizations:approve', 'leave-authorizations', 'approve', 'Authorize or reject supervisor-approved leave requests'),
  ('annual-leave-requests:read', 'annual-leave-requests', 'read', 'View annual leave requests'),
  ('other-leave-requests:read', 'other-leave-requests', 'read', 'View other leave requests'),
  ('overtime-requests:read', 'overtime-requests', 'read', 'View overtime assignments'),
  ('overtime-requests:approve', 'overtime-requests', 'approve', 'Assign and approve overtime for supervised employees'),
  ('manual-punch-requests:read', 'manual-punch-requests', 'read', 'View attendance correction requests'),
  ('manual-punch-requests:approve', 'manual-punch-requests', 'approve', 'Approve attendance correction requests'),
  ('work-schedules:read', 'work-schedules', 'read', 'View work schedules'),
  ('holidays:read', 'holidays', 'read', 'View holidays and institution off days'),
  ('holidays:create', 'holidays', 'create', 'Create holidays and institution off days'),
  ('holidays:update', 'holidays', 'update', 'Update holidays and institution off days'),
  ('shifts:read', 'shifts', 'read', 'View shifts'),
  ('schedule-assignments:read', 'schedule-assignments', 'read', 'View schedule assignments'),
  ('biometric-devices:read', 'biometric-devices', 'read', 'View biometric devices'),
  ('biometric-provisioning:read', 'biometric-provisioning', 'read', 'View biometric provisioning jobs and previews'),
  ('biometric-provisioning:execute', 'biometric-provisioning', 'execute', 'Preview, confirm, and retry biometric provisioning'),
  ('biometric-exemptions:read', 'biometric-exemptions', 'read', 'View biometric exemption requests'),
  ('biometric-exemptions:approve', 'biometric-exemptions', 'approve', 'Approve biometric exemption requests'),
  ('attendance-punches:read', 'attendance-punches', 'read', 'View attendance punches'),
  ('attendance-approvals:approve', 'attendance-approvals', 'approve', 'Approve supervised daily attendance'),
  ('hr-attendance-approvals:approve', 'hr-attendance-approvals', 'approve', 'Approve daily attendance for payroll readiness'),
  ('ifmis-attendance:read', 'ifmis-attendance', 'read', 'View HR-approved attendance prepared for IFMIS'),
  ('ifmis-attendance:push', 'ifmis-attendance', 'push', 'Push a complete payroll month to IFMIS'),
  ('reports-attendance-daily:read', 'reports-attendance-daily', 'read', 'View attendance daily report'),
  ('reports-attendance-punches:read', 'reports-attendance-punches', 'read', 'View attendance punches report'),
  ('reports-late-attendance:read', 'reports-late-attendance', 'read', 'View late attendance report'),
  ('reports-overtime:read', 'reports-overtime', 'read', 'View overtime report'),
  ('reports-leave-balances:read', 'reports-leave-balances', 'read', 'View leave balances report'),
  ('reports-leave-requests:read', 'reports-leave-requests', 'read', 'View leave requests report'),
  ('reports-employees:read', 'reports-employees', 'read', 'View employee roster report'),
  ('reports-device-sync:read', 'reports-device-sync', 'read', 'View device sync report'),
  ('reports-audit:read', 'reports-audit', 'read', 'View audit trail reports'),
  ('users:read', 'users', 'read', 'View users'),
  ('users:create', 'users', 'create', 'Create users'),
  ('users:update', 'users', 'update', 'Update users'),
  ('users:delete', 'users', 'delete', 'Delete users'),
  ('users:assign-roles', 'users', 'assign-roles', 'Assign roles to users'),
  ('roles:read', 'roles', 'read', 'View roles'),
  ('roles:create', 'roles', 'create', 'Create roles'),
  ('roles:update', 'roles', 'update', 'Update roles'),
  ('roles:delete', 'roles', 'delete', 'Delete roles'),
  ('roles:assign-permissions', 'roles', 'assign-permissions', 'Assign permissions to roles'),
  ('permissions:read', 'permissions', 'read', 'View permissions'),
  ('permissions:create', 'permissions', 'create', 'Create permissions'),
  ('permissions:update', 'permissions', 'update', 'Update permissions'),
  ('permissions:delete', 'permissions', 'delete', 'Delete permissions'),
  ('notification-logs:read', 'notification-logs', 'read', 'View notification logs'),
  ('notification-logs:retry', 'notification-logs', 'retry', 'Retry failed notifications'),
  ('auth:sessions:revoke', 'auth_sessions', 'revoke', 'Revoke user sessions'),
  ('system:manage', 'system', 'manage', 'Manage the system');

INSERT INTO permissions (name, resource, action, description, created_at, updated_at)
SELECT name, resource, action, description, now(), now()
FROM _seed_permissions
ON CONFLICT (name) DO UPDATE SET
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  updated_at = now();

CREATE TEMP TABLE _seed_roles (
  name text PRIMARY KEY,
  description text,
  permission_names text[] NOT NULL
) ON COMMIT DROP;

INSERT INTO _seed_roles (name, description, permission_names) VALUES
  ('super_admin', 'Unrestricted system administrator', ARRAY(SELECT name FROM _seed_permissions)),
  ('admin', 'System administrator with user, configuration, attendance, leave, and report access', ARRAY(SELECT name FROM _seed_permissions WHERE name <> 'system:manage')),
  ('executive', 'Executive user with organization-wide dashboard and reporting visibility', ARRAY[
    'executive-dashboard:read', 'hr-dashboard:read', 'department-head-dashboard:read',
    'reports-attendance-daily:read', 'reports-attendance-punches:read', 'reports-late-attendance:read',
    'reports-overtime:read', 'reports-leave-balances:read', 'reports-leave-requests:read',
    'reports-employees:read', 'reports-device-sync:read', 'reports-audit:read', 'notification-logs:read'
  ]),
  ('human_resource', 'Human resources user with employee, leave, attendance, schedule, and report access', ARRAY[
    'hr-dashboard:read', 'employees:read', 'employees:create', 'employees:update', 'permanent-employees:read',
    'temporary-assignment:read', 'temporary-assignment:add', 'temporary-assignment:edit',
    'leave-fiscal-years:read', 'leave-types:read', 'leave-balances:read', 'leave-transfer:read',
    'leave-request-approvals:approve', 'leave-authorizations:approve', 'annual-leave-requests:read', 'other-leave-requests:read',
    'overtime-requests:read', 'manual-punch-requests:read', 'manual-punch-requests:approve',
    'work-schedules:read', 'holidays:read', 'holidays:create', 'holidays:update', 'shifts:read',
    'schedule-assignments:read', 'biometric-devices:read', 'biometric-provisioning:read',
    'biometric-provisioning:execute', 'biometric-exemptions:read',
    'attendance-punches:read', 'hr-attendance-approvals:approve',
    'reports-attendance-daily:read', 'reports-attendance-punches:read', 'reports-late-attendance:read',
    'reports-overtime:read', 'reports-leave-balances:read', 'reports-leave-requests:read',
    'reports-employees:read', 'reports-device-sync:read', 'reports-audit:read', 'notification-logs:read'
  ]),
  ('finance', 'Finance user with IFMIS attendance review and export access', ARRAY[
    'ifmis-attendance:read', 'ifmis-attendance:push'
  ]),
  ('supervisor', 'Supervisor with supervised employee workflow approvals', ARRAY[
    'department-head-dashboard:read', 'leave-request-approvals:approve', 'annual-leave-requests:read',
    'other-leave-requests:read', 'overtime-requests:read', 'overtime-requests:approve',
    'manual-punch-requests:read', 'manual-punch-requests:approve', 'biometric-exemptions:read',
    'biometric-exemptions:approve', 'attendance-approvals:approve', 'reports-attendance-daily:read',
    'reports-attendance-punches:read', 'reports-late-attendance:read', 'reports-overtime:read',
    'reports-leave-requests:read', 'reports-employees:read'
  ]),
  ('employee', 'Standard employee self-service access', ARRAY[
    'dashboard:read', 'annual-leave-requests:read', 'other-leave-requests:read',
    'overtime-requests:read', 'manual-punch-requests:read', 'biometric-exemptions:read'
  ]);

INSERT INTO roles (name, description, created_at, updated_at)
SELECT name, description, now(), now()
FROM _seed_roles
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = now();

INSERT INTO role_permissions (role_id, permission_id, created_at)
SELECT r.id, p.id, now()
FROM _seed_roles sr
JOIN roles r ON r.name = sr.name
JOIN LATERAL unnest(sr.permission_names) AS wanted_permission(name) ON true
JOIN permissions p ON p.name = wanted_permission.name
ON CONFLICT (role_id, permission_id) DO NOTHING;

DELETE FROM role_permissions
WHERE role_id IN (
  SELECT id FROM roles WHERE lower(name) = 'supervisor'
)
AND permission_id IN (
  SELECT id FROM permissions WHERE name LIKE 'temporary-assignment:%'
);

WITH aliases(alias_name, canonical_name) AS (
  VALUES
    ('hr', 'human_resource'),
    ('hr_manager', 'human_resource'),
    ('hr_clerk', 'human_resource'),
    ('manager', 'supervisor'),
    ('department_manager', 'supervisor'),
    ('department_head', 'supervisor')
),
alias_roles AS (
  SELECT old_role.id AS old_role_id, new_role.id AS new_role_id
  FROM aliases
  JOIN roles old_role ON lower(old_role.name) = aliases.alias_name
  JOIN roles new_role ON lower(new_role.name) = aliases.canonical_name
),
moved_user_roles AS (
  INSERT INTO user_roles (user_id, role_id, created_at)
  SELECT DISTINCT user_roles.user_id, alias_roles.new_role_id, now()
  FROM user_roles
  JOIN alias_roles ON alias_roles.old_role_id = user_roles.role_id
  ON CONFLICT (user_id, role_id) DO NOTHING
  RETURNING 1
),
updated_users AS (
  UPDATE "user"
  SET
    role = (
      SELECT ARRAY(
        SELECT DISTINCT mapped.role_name
        FROM unnest(coalesce("user".role, ARRAY[]::text[])) AS existing_role(role_name)
        CROSS JOIN LATERAL (
          SELECT CASE
            WHEN lower(existing_role.role_name) IN ('hr', 'hr_manager', 'hr_clerk') THEN 'human_resource'
            WHEN lower(existing_role.role_name) IN ('manager', 'department_manager', 'department_head') THEN 'supervisor'
            ELSE lower(existing_role.role_name)
          END AS role_name
        ) mapped
        WHERE mapped.role_name <> ALL(ARRAY['hr', 'hr_manager', 'hr_clerk', 'manager', 'department_manager', 'department_head'])
        ORDER BY mapped.role_name
      )
    ),
    "updatedAt" = now()
  WHERE EXISTS (
    SELECT 1
    FROM unnest(coalesce("user".role, ARRAY[]::text[])) AS existing_role(role_name)
    WHERE lower(existing_role.role_name) IN ('hr', 'hr_manager', 'hr_clerk', 'manager', 'department_manager', 'department_head')
  )
  RETURNING 1
),
deleted_links AS (
  DELETE FROM role_permissions
  WHERE role_id IN (SELECT old_role_id FROM alias_roles)
  RETURNING 1
),
deleted_user_roles AS (
  DELETE FROM user_roles
  WHERE role_id IN (SELECT old_role_id FROM alias_roles)
  RETURNING 1
)
DELETE FROM roles
WHERE id IN (SELECT old_role_id FROM alias_roles);

COMMIT;
