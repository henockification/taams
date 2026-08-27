import 'dotenv/config';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import { permissions, rolePermissions, roles } from '../db/schema';
import * as schema from '../db/schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const PERMISSIONS = [
  { name: 'dashboard:read', resource: 'dashboard', action: 'read', description: 'View employee dashboard' },
  { name: 'executive-dashboard:read', resource: 'executive-dashboard', action: 'read', description: 'View executive dashboard' },
  { name: 'hr-dashboard:read', resource: 'hr-dashboard', action: 'read', description: 'View HR dashboard' },
  { name: 'department-head-dashboard:read', resource: 'department-head-dashboard', action: 'read', description: 'View supervisor dashboard' },
  { name: 'permanent-employees:read', resource: 'permanent-employees', action: 'read', description: 'View permanent employee imports' },
  { name: 'employees:read', resource: 'employees', action: 'read', description: 'View employees' },
  { name: 'employees:create', resource: 'employees', action: 'create', description: 'Create employees' },
  { name: 'employees:update', resource: 'employees', action: 'update', description: 'Update employees' },
  { name: 'leave-fiscal-years:read', resource: 'leave-fiscal-years', action: 'read', description: 'View leave fiscal years' },
  { name: 'leave-types:read', resource: 'leave-types', action: 'read', description: 'View leave types' },
  { name: 'leave-balances:read', resource: 'leave-balances', action: 'read', description: 'View leave balances' },
  { name: 'leave-transfer:read', resource: 'leave-transfer', action: 'read', description: 'View leave carry-forward' },
  { name: 'leave-request-approvals:approve', resource: 'leave-request-approvals', action: 'approve', description: 'Approve or reject supervised leave requests' },
  { name: 'annual-leave-requests:read', resource: 'annual-leave-requests', action: 'read', description: 'View annual leave requests' },
  { name: 'other-leave-requests:read', resource: 'other-leave-requests', action: 'read', description: 'View other leave requests' },
  { name: 'overtime-requests:read', resource: 'overtime-requests', action: 'read', description: 'View overtime assignments' },
  { name: 'overtime-requests:approve', resource: 'overtime-requests', action: 'approve', description: 'Assign and approve overtime for supervised employees' },
  { name: 'manual-punch-requests:read', resource: 'manual-punch-requests', action: 'read', description: 'View attendance correction requests' },
  { name: 'manual-punch-requests:approve', resource: 'manual-punch-requests', action: 'approve', description: 'Approve attendance correction requests' },
  { name: 'work-schedules:read', resource: 'work-schedules', action: 'read', description: 'View work schedules' },
  { name: 'holidays:read', resource: 'holidays', action: 'read', description: 'View holidays and institution off days' },
  { name: 'holidays:create', resource: 'holidays', action: 'create', description: 'Create holidays and institution off days' },
  { name: 'holidays:update', resource: 'holidays', action: 'update', description: 'Update holidays and institution off days' },
  { name: 'shifts:read', resource: 'shifts', action: 'read', description: 'View shifts' },
  { name: 'schedule-assignments:read', resource: 'schedule-assignments', action: 'read', description: 'View schedule assignments' },
  { name: 'biometric-devices:read', resource: 'biometric-devices', action: 'read', description: 'View biometric devices' },
  { name: 'biometric-exemptions:read', resource: 'biometric-exemptions', action: 'read', description: 'View biometric exemption requests' },
  { name: 'biometric-exemptions:approve', resource: 'biometric-exemptions', action: 'approve', description: 'Approve biometric exemption requests' },
  { name: 'attendance-punches:read', resource: 'attendance-punches', action: 'read', description: 'View attendance punches' },
  { name: 'attendance-approvals:approve', resource: 'attendance-approvals', action: 'approve', description: 'Approve supervised daily attendance' },
  { name: 'hr-attendance-approvals:approve', resource: 'hr-attendance-approvals', action: 'approve', description: 'Approve daily attendance for payroll readiness' },
  { name: 'reports-attendance-daily:read', resource: 'reports-attendance-daily', action: 'read', description: 'View attendance daily report' },
  { name: 'reports-attendance-punches:read', resource: 'reports-attendance-punches', action: 'read', description: 'View attendance punches report' },
  { name: 'reports-late-attendance:read', resource: 'reports-late-attendance', action: 'read', description: 'View late attendance report' },
  { name: 'reports-overtime:read', resource: 'reports-overtime', action: 'read', description: 'View overtime report' },
  { name: 'reports-leave-balances:read', resource: 'reports-leave-balances', action: 'read', description: 'View leave balances report' },
  { name: 'reports-leave-requests:read', resource: 'reports-leave-requests', action: 'read', description: 'View leave requests report' },
  { name: 'reports-employees:read', resource: 'reports-employees', action: 'read', description: 'View employee roster report' },
  { name: 'reports-device-sync:read', resource: 'reports-device-sync', action: 'read', description: 'View device sync report' },
  { name: 'users:read', resource: 'users', action: 'read', description: 'View users' },
  { name: 'users:create', resource: 'users', action: 'create', description: 'Create users' },
  { name: 'users:update', resource: 'users', action: 'update', description: 'Update users' },
  { name: 'users:delete', resource: 'users', action: 'delete', description: 'Delete users' },
  { name: 'users:assign-roles', resource: 'users', action: 'assign-roles', description: 'Assign roles to users' },
  { name: 'roles:read', resource: 'roles', action: 'read', description: 'View roles' },
  { name: 'roles:create', resource: 'roles', action: 'create', description: 'Create roles' },
  { name: 'roles:update', resource: 'roles', action: 'update', description: 'Update roles' },
  { name: 'roles:delete', resource: 'roles', action: 'delete', description: 'Delete roles' },
  { name: 'roles:assign-permissions', resource: 'roles', action: 'assign-permissions', description: 'Assign permissions to roles' },
  { name: 'permissions:read', resource: 'permissions', action: 'read', description: 'View permissions' },
  { name: 'permissions:create', resource: 'permissions', action: 'create', description: 'Create permissions' },
  { name: 'permissions:update', resource: 'permissions', action: 'update', description: 'Update permissions' },
  { name: 'permissions:delete', resource: 'permissions', action: 'delete', description: 'Delete permissions' },
  { name: 'notification-logs:read', resource: 'notification-logs', action: 'read', description: 'View notification logs' },
  { name: 'notification-logs:retry', resource: 'notification-logs', action: 'retry', description: 'Retry failed notifications' },
  { name: 'auth:sessions:revoke', resource: 'auth_sessions', action: 'revoke', description: 'Revoke user sessions' },
  { name: 'system:manage', resource: 'system', action: 'manage', description: 'Manage the system' },
] as const;

const SYSTEM_ROLES = [
  {
    name: 'super_admin',
    description: 'Unrestricted system administrator',
    permissions: PERMISSIONS.map((permission) => permission.name),
    replacePermissions: true,
  },
  {
    name: 'admin',
    description: 'System administrator with user, configuration, attendance, leave, and report access',
    permissions: PERMISSIONS.map((permission) => permission.name).filter((name) => name !== 'system:manage'),
  },
  {
    name: 'executive',
    description: 'Executive user with organization-wide dashboard and reporting visibility',
    permissions: [
      'executive-dashboard:read',
      'hr-dashboard:read',
      'department-head-dashboard:read',
      'reports-attendance-daily:read',
      'reports-attendance-punches:read',
      'reports-late-attendance:read',
      'reports-overtime:read',
      'reports-leave-balances:read',
      'reports-leave-requests:read',
      'reports-employees:read',
      'reports-device-sync:read',
      'notification-logs:read',
    ],
  },
  {
    name: 'human_resource',
    description: 'Human resources user with employee, leave, attendance, schedule, and report access',
    permissions: [
      'hr-dashboard:read',
      'employees:read',
      'employees:create',
      'employees:update',
      'permanent-employees:read',
      'leave-fiscal-years:read',
      'leave-types:read',
      'leave-balances:read',
      'leave-transfer:read',
      'leave-request-approvals:approve',
      'annual-leave-requests:read',
      'other-leave-requests:read',
      'overtime-requests:read',
      'manual-punch-requests:read',
      'manual-punch-requests:approve',
      'work-schedules:read',
      'holidays:read',
      'holidays:create',
      'holidays:update',
      'shifts:read',
      'schedule-assignments:read',
      'biometric-devices:read',
      'biometric-exemptions:read',
      'attendance-punches:read',
      'hr-attendance-approvals:approve',
      'reports-attendance-daily:read',
      'reports-attendance-punches:read',
      'reports-late-attendance:read',
      'reports-overtime:read',
      'reports-leave-balances:read',
      'reports-leave-requests:read',
      'reports-employees:read',
      'reports-device-sync:read',
      'notification-logs:read',
    ],
  },
  {
    name: 'supervisor',
    description: 'Supervisor with supervised employee workflow approvals',
    permissions: [
      'department-head-dashboard:read',
      'leave-request-approvals:approve',
      'annual-leave-requests:read',
      'other-leave-requests:read',
      'overtime-requests:read',
      'overtime-requests:approve',
      'manual-punch-requests:read',
      'manual-punch-requests:approve',
      'biometric-exemptions:read',
      'biometric-exemptions:approve',
      'attendance-approvals:approve',
      'reports-attendance-daily:read',
      'reports-attendance-punches:read',
      'reports-late-attendance:read',
      'reports-overtime:read',
      'reports-leave-requests:read',
      'reports-employees:read',
    ],
  },
  {
    name: 'employee',
    description: 'Standard employee self-service access',
    permissions: [
      'dashboard:read',
      'annual-leave-requests:read',
      'other-leave-requests:read',
      'overtime-requests:read',
      'manual-punch-requests:read',
      'biometric-exemptions:read',
    ],
  },
] as const;

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function excluded(columnName: string) {
  return sql.raw(`excluded."${columnName}"`);
}

async function main() {
  const connectionString = requireEnv('DATABASE_URL');
  const now = new Date();
  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    const result = await db.transaction(async (tx) => {
      await tx
        .insert(permissions)
        .values(PERMISSIONS)
        .onConflictDoUpdate({
          target: permissions.name,
          set: {
            resource: excluded('resource'),
            action: excluded('action'),
            description: excluded('description'),
            updatedAt: now,
          },
        });

      const seededPermissions = await tx.select().from(permissions);
      const permissionByName = new Map(seededPermissions.map((permission) => [permission.name, permission]));
      let roleCount = 0;
      let rolePermissionCount = 0;

      for (const systemRole of SYSTEM_ROLES) {
        const [role] = await tx
          .insert(roles)
          .values({
            name: systemRole.name,
            description: systemRole.description,
            createdAt: now,
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: roles.name,
            set: {
              description: systemRole.description,
              updatedAt: now,
            },
          })
          .returning();

        roleCount += 1;

        if ('replacePermissions' in systemRole && systemRole.replacePermissions) {
          await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
        }

        const permissionIds = systemRole.permissions
          .map((permissionName) => permissionByName.get(permissionName)?.id)
          .filter((permissionId): permissionId is string => Boolean(permissionId));

        if (permissionIds.length === 0) continue;

        await tx
          .insert(rolePermissions)
          .values(
            permissionIds.map((permissionId) => ({
              roleId: role.id,
              permissionId,
              createdAt: now,
            }))
          )
          .onConflictDoNothing({
            target: [rolePermissions.roleId, rolePermissions.permissionId],
          });

        rolePermissionCount += permissionIds.length;
      }

      await tx.execute(sql`
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
          JOIN ${roles} old_role ON lower(old_role.name) = aliases.alias_name
          JOIN ${roles} new_role ON lower(new_role.name) = aliases.canonical_name
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
        WHERE id IN (SELECT old_role_id FROM alias_roles)
      `);

      return {
        permissionsCount: PERMISSIONS.length,
        roleCount,
        rolePermissionCount,
      };
    });

    console.log('System role seed complete');
    console.log(`Permissions ensured: ${result.permissionsCount}`);
    console.log(`Roles ensured: ${result.roleCount}`);
    console.log(`Role permission links ensured: ${result.rolePermissionCount}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to seed system roles');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
