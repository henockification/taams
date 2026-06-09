import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  json,
  jsonb,
  pgEnum,
  index,
  unique,
  primaryKey,
  vector,
  numeric,
  check,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Define enums
export const userRole = pgEnum('user_role', ['super_admin', 'admin', 'employee']);

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').array().default(['user']),
  createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const authCredentials = pgTable('auth_credentials', {
  userId: text('user_id').primaryKey().references(() => user.id, { onDelete: 'cascade' }),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const authSessions = pgTable('auth_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull().unique(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const authVerificationTokens = pgTable('auth_verification_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  purpose: text('purpose').notNull(),
  identifier: text('identifier').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true, precision: 6 }).notNull(),
  attempts: integer('attempts').notNull().default(0),
  consumedAt: timestamp('consumed_at', { withTimezone: true, precision: 6 }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  identifierPurposeIdx: index('auth_verification_tokens_identifier_purpose_idx').on(table.identifier, table.purpose),
}));

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  resource: text('resource').notNull(),
  action: text('action').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  resourceActionUnique: unique().on(table.resource, table.action),
}));

export const rolePermissions = pgTable('role_permissions', {
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
}));

export const userRoles = pgTable('user_roles', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  roleId: uuid('role_id').notNull().references(() => roles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.roleId] }),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  credential: one(authCredentials),
  sessions: many(authSessions),
  userRoles: many(userRoles),
}));

export const authCredentialsRelations = relations(authCredentials, ({ one }) => ({
  user: one(user, {
    fields: [authCredentials.userId],
    references: [user.id],
  }),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(user, {
    fields: [authSessions.userId],
    references: [user.id],
  }),
}));

export const rolesRelations = relations(roles, ({ many }) => ({
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(user, {
    fields: [userRoles.userId],
    references: [user.id],
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id],
  }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id],
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
  }),
}));

// Export all tables for easy access
export const allTables = {
  user,
  authCredentials,
  authSessions,
  authVerificationTokens,
  roles,
  permissions,
  rolePermissions,
  userRoles,
};
