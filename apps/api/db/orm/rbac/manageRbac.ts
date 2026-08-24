import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { permissions, rolePermissions, roles, user, userRoles } from '../../schema';

type DbClient = typeof db | any;
const RESERVED_ROLE_NAMES = new Set(['super_admin', 'admin', 'executive', 'human_resource', 'supervisor', 'employee']);
const RESERVED_ROLE_MESSAGE = 'This role name is reserved by the system and cannot be created or assigned to a custom role.';

export type CreateRoleInput = {
  name: string;
  description?: string;
  permissionIds?: string[];
};

export type UpdateRoleInput = {
  name?: string;
  description?: string | null;
};

export type CreatePermissionInput = {
  name: string;
  resource: string;
  action: string;
  description?: string;
};

export type UpdatePermissionInput = {
  name?: string;
  resource?: string;
  action?: string;
  description?: string | null;
};

export type CreateUserInput = {
  id: string;
  name: string;
  email: string;
  emailVerified?: boolean;
  image?: string;
  roleIds?: string[];
};

export type UpdateUserInput = {
  name?: string;
  email?: string;
  emailVerified?: boolean;
  image?: string | null;
  roleIds?: string[];
};

export async function getRoles() {
  return db.query.roles.findMany({
    with: {
      rolePermissions: {
        with: {
          permission: true,
        },
      },
    },
    orderBy: (table, { asc }) => [asc(table.name)],
  });
}

export async function getPermissions() {
  return db.select().from(permissions).orderBy(permissions.resource, permissions.action);
}

export async function createPermission(input: CreatePermissionInput) {
  const [permission] = await db
    .insert(permissions)
    .values({
      name: input.name,
      resource: input.resource,
      action: input.action,
      description: input.description,
    })
    .returning();

  return permission;
}

export async function updatePermission(permissionId: string, input: UpdatePermissionInput) {
  await assertPermissionExists(permissionId);

  const updateData: Record<string, unknown> = {};
  if (input.name !== undefined) updateData.name = input.name;
  if (input.resource !== undefined) updateData.resource = input.resource;
  if (input.action !== undefined) updateData.action = input.action;
  if (input.description !== undefined) updateData.description = input.description;

  if (Object.keys(updateData).length > 0) {
    const [permission] = await db
      .update(permissions)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(permissions.id, permissionId))
      .returning();

    return permission;
  }

  return getPermissionById(permissionId);
}

export async function createRole(input: CreateRoleInput) {
  return db.transaction(async (tx) => {
    assertRoleNameIsNotReserved(input.name);

    if (input.permissionIds?.length) {
      await assertPermissionsExist(input.permissionIds, tx);
    }

    const [role] = await tx
      .insert(roles)
      .values({
        name: normalizeRoleName(input.name),
        description: input.description,
      })
      .returning();

    if (input.permissionIds?.length) {
      await tx.insert(rolePermissions).values(
        input.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        }))
      );
    }

    return getRoleById(role.id, tx);
  });
}

export async function updateRole(roleId: string, input: UpdateRoleInput) {
  return db.transaction(async (tx) => {
    await assertRoleExists(roleId, tx);

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) {
      assertRoleNameIsNotReserved(input.name);
      updateData.name = normalizeRoleName(input.name);
    }
    if (input.description !== undefined) updateData.description = input.description;

    if (Object.keys(updateData).length > 0) {
      await tx
        .update(roles)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(roles.id, roleId));
    }

    return getRoleById(roleId, tx);
  });
}

export async function assignPermissionsToRole(roleId: string, permissionIds: string[]) {
  return db.transaction(async (tx) => {
    await assertRoleExists(roleId, tx);

    if (permissionIds.length) {
      await assertPermissionsExist(permissionIds, tx);
    }

    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

    if (permissionIds.length) {
      await tx.insert(rolePermissions).values(
        permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        }))
      );
    }

    await tx.update(roles).set({ updatedAt: new Date() }).where(eq(roles.id, roleId));

    return getRoleById(roleId, tx);
  });
}

export async function createUserWithRoles(input: CreateUserInput) {
  return db.transaction(async (tx) => {
    const roleNames = input.roleIds?.length ? await getRoleNamesByIds(input.roleIds, tx) : ['user'];

    const [createdUser] = await tx
      .insert(user)
      .values({
        id: input.id,
        name: input.name,
        email: input.email,
        emailVerified: input.emailVerified ?? true,
        image: input.image,
        role: roleNames,
      })
      .returning();

    if (input.roleIds?.length) {
      await tx.insert(userRoles).values(
        input.roleIds.map((roleId) => ({
          userId: createdUser.id,
          roleId,
        }))
      );
    }

    return getUserWithRoles(createdUser.id, tx);
  });
}

export async function updateUserWithRoles(userId: string, input: UpdateUserInput) {
  return db.transaction(async (tx) => {
    await assertUserExists(userId, tx);

    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.email !== undefined) updateData.email = input.email;
    if (input.emailVerified !== undefined) updateData.emailVerified = input.emailVerified;
    if (input.image !== undefined) updateData.image = input.image;

    if (input.roleIds !== undefined) {
      const roleNames = input.roleIds.length ? await getRoleNamesByIds(input.roleIds, tx) : ['user'];
      updateData.role = roleNames;

      await tx.delete(userRoles).where(eq(userRoles.userId, userId));

      if (input.roleIds.length) {
        await tx.insert(userRoles).values(
          input.roleIds.map((roleId) => ({
            userId,
            roleId,
          }))
        );
      }
    }

    if (Object.keys(updateData).length > 0) {
      await tx
        .update(user)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(user.id, userId));
    }

    return getUserWithRoles(userId, tx);
  });
}

export async function assignRolesToUser(userId: string, roleIds: string[]) {
  return updateUserWithRoles(userId, { roleIds });
}

export async function userHasPermission(userId: string, permissionName: string) {
  const rows = await db
    .select({ permissionId: permissions.id })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(and(eq(userRoles.userId, userId), eq(permissions.name, permissionName)))
    .limit(1);

  return rows.length > 0;
}

export async function getUserPermissionNames(userId: string) {
  const rows = await db
    .select({ name: permissions.name })
    .from(userRoles)
    .innerJoin(rolePermissions, eq(userRoles.roleId, rolePermissions.roleId))
    .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
    .where(eq(userRoles.userId, userId));

  return [...new Set(rows.map((row) => row.name))];
}

async function getRoleById(roleId: string, tx: DbClient = db) {
  return tx.query.roles.findFirst({
    where: eq(roles.id, roleId),
    with: {
      rolePermissions: {
        with: {
          permission: true,
        },
      },
    },
  });
}

async function getPermissionById(permissionId: string, tx: DbClient = db) {
  return tx.query.permissions.findFirst({
    where: eq(permissions.id, permissionId),
  });
}

async function getUserWithRoles(userId: string, tx: DbClient = db) {
  return tx.query.user.findFirst({
    where: eq(user.id, userId),
    with: {
      userRoles: {
        with: {
          role: true,
        },
      },
    },
  });
}

async function assertUserExists(userId: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { id: true },
  });

  if (!found) {
    throw new Error('User not found');
  }
}

async function assertRoleExists(roleId: string, tx: DbClient = db) {
  const found = await tx.query.roles.findFirst({
    where: eq(roles.id, roleId),
    columns: { id: true },
  });

  if (!found) {
    throw new Error('Role not found');
  }
}

async function assertPermissionExists(permissionId: string, tx: DbClient = db) {
  const found = await tx.query.permissions.findFirst({
    where: eq(permissions.id, permissionId),
    columns: { id: true },
  });

  if (!found) {
    throw new Error('Permission not found');
  }
}

async function assertPermissionsExist(permissionIds: string[], tx: DbClient = db) {
  const uniquePermissionIds = [...new Set(permissionIds)];
  const found = await tx
    .select({ id: permissions.id })
    .from(permissions)
    .where(inArray(permissions.id, uniquePermissionIds));

  if (found.length !== uniquePermissionIds.length) {
    throw new Error('One or more permissions were not found');
  }
}

async function getRoleNamesByIds(roleIds: string[], tx: DbClient = db) {
  const uniqueRoleIds = [...new Set(roleIds)];
  const foundRoles = await tx
    .select({ id: roles.id, name: roles.name })
    .from(roles)
    .where(inArray(roles.id, uniqueRoleIds));

  if (foundRoles.length !== uniqueRoleIds.length) {
    throw new Error('One or more roles were not found');
  }

  return foundRoles.map((role: { name: string }) => role.name);
}

function normalizeRoleName(name: string) {
  return name.trim().toLowerCase();
}

function assertRoleNameIsNotReserved(name: string) {
  if (RESERVED_ROLE_NAMES.has(normalizeRoleName(name))) {
    throw new Error(RESERVED_ROLE_MESSAGE);
  }
}
