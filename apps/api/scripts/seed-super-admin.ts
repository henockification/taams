import 'dotenv/config';
import { randomUUID } from 'crypto';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import {
  authCredentials,
  permissions,
  rolePermissions,
  roles,
  user,
  userRoles,
} from '../db/schema';
import * as schema from '../db/schema';
import { hashPassword } from '../lib/password';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const DEFAULT_PERMISSIONS = [
  { name: 'dashboard:read', resource: 'dashboard', action: 'read', description: 'View dashboard' },
  { name: 'executive-dashboard:read', resource: 'executive-dashboard', action: 'read', description: 'View executive dashboard' },
  { name: 'hr-dashboard:read', resource: 'hr-dashboard', action: 'read', description: 'View HR dashboard' },
  { name: 'department-head-dashboard:read', resource: 'department-head-dashboard', action: 'read', description: 'View supervisor dashboard' },
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
  { name: 'auth:sessions:revoke', resource: 'auth_sessions', action: 'revoke', description: 'Revoke user sessions' },
  { name: 'system:manage', resource: 'system', action: 'manage', description: 'Manage the system' },
];

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

async function main() {
  const connectionString = requireEnv('DATABASE_URL');
  const adminEmail = (process.env.SUPER_ADMIN_EMAIL || 'super.admin@taams.local').trim().toLowerCase();
  const adminName = (process.env.SUPER_ADMIN_NAME || 'Super Admin').trim();
  const adminPassword = requireEnv('SUPER_ADMIN_PASSWORD');
  const now = new Date();

  const client = postgres(connectionString, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    const result = await db.transaction(async (tx) => {
      await tx
        .insert(permissions)
        .values(DEFAULT_PERMISSIONS)
        .onConflictDoUpdate({
          target: permissions.name,
          set: {
            description: permissions.description,
            updatedAt: now,
          },
        });

      const seededPermissions = await tx.select().from(permissions);

      const [superAdminRole] = await tx
        .insert(roles)
        .values({
          name: 'super_admin',
          description: 'Unrestricted system administrator',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: roles.name,
          set: {
            description: 'Unrestricted system administrator',
            updatedAt: now,
          },
        })
        .returning();

      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, superAdminRole.id));

      if (seededPermissions.length > 0) {
        await tx.insert(rolePermissions).values(
          seededPermissions.map((permission) => ({
            roleId: superAdminRole.id,
            permissionId: permission.id,
            createdAt: now,
          }))
        );
      }

      const existingUser = await tx.query.user.findFirst({
        where: eq(user.email, adminEmail),
      });

      const adminUserId = existingUser?.id ?? `user_${randomUUID()}`;

      if (existingUser) {
        await tx
          .update(user)
          .set({
            name: adminName,
            emailVerified: true,
            role: ['super_admin'],
            updatedAt: now,
          })
          .where(eq(user.id, adminUserId));
      } else {
        await tx.insert(user).values({
          id: adminUserId,
          name: adminName,
          email: adminEmail,
          emailVerified: true,
          role: ['super_admin'],
          createdAt: now,
          updatedAt: now,
        });
      }

      await tx
        .insert(userRoles)
        .values({
          userId: adminUserId,
          roleId: superAdminRole.id,
          createdAt: now,
        })
        .onConflictDoNothing({
          target: [userRoles.userId, userRoles.roleId],
        });

      const passwordHash = await hashPassword(adminPassword);

      await tx
        .insert(authCredentials)
        .values({
          userId: adminUserId,
          passwordHash,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: authCredentials.userId,
          set: {
            passwordHash,
            updatedAt: now,
          },
        });

      return {
        email: adminEmail,
        userId: adminUserId,
        roleId: superAdminRole.id,
        permissionsCount: seededPermissions.length,
      };
    });

    console.log('Super admin seed complete');
    console.log(`Email: ${result.email}`);
    console.log(`User ID: ${result.userId}`);
    console.log(`Role ID: ${result.roleId}`);
    console.log(`Permissions assigned: ${result.permissionsCount}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Failed to seed super admin');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
