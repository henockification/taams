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
  vector,
  numeric,
  check,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// Define enums
export const userRole = pgEnum('user_role', ['owner', 'admin', 'agent', 'analyst']);
export const packageType = pgEnum('package_type', ['REGULAR', 'SEASONAL', 'HOLIDAY', 'LIMITED']);
export const inventoryMovementType = pgEnum('inventory_movement_type', [
  'RECEIVE',
  'SALE',
  'RETURN',
  'ADJUSTMENT',
  'RESERVE',
  'RELEASE_RESERVE',
]);
export const orderFulfillmentType = pgEnum('order_fulfillment_type', ['PICKUP', 'DELIVERY']);
export const orderStatus = pgEnum('order_status', [
  'PENDING',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
  'CANCEL_REQUESTED',
  'REFUNDING',
  'PAID',
  'PARTIALLY_REFUNDED',
]);
export const orderPaymentStatus = pgEnum('order_payment_status', [
  'UNPAID',
  'ASSUMED_PAID',
  'PAID',
  'REFUNDED',
]);
export const inventoryReservationStatus = pgEnum('inventory_reservation_status', [
  'ACTIVE',
  'RELEASED',
  'CAPTURED',
  'EXPIRED',
]);
export const shipmentStatus = pgEnum('shipment_status', [
  'pending',
  'label_created',
  'in_transit',
  'delivered',
  'exception',
  'canceled',
]);


// Better Auth tables (matching Better Auth expectations exactly)
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

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt', { withTimezone: true, precision: 6 }).notNull(),
  token: text('token').unique(),
  createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  expiresAt: timestamp('expiresAt', { withTimezone: true, precision: 6 }),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true, precision: 6 }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true, precision: 6 }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  providerAccountUnique: unique().on(table.providerId, table.accountId),
}));

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true, precision: 6 }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  identifierValueUnique: unique().on(table.identifier, table.value),
}));

// Better Auth relations
export const betterAuthUsersRelations = relations(user, ({ one, many }) => ({
  accounts: many(account),
  sessions: many(session),
}));

export const sessionsRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountsRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

// Relations

// Export all tables for easy access
export const allTables = {
  user,
  session,
  account,
  verification
};
