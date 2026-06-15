import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  date,
  time,
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
import type { AnyPgColumn } from 'drizzle-orm/pg-core/columns/common';
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

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameEn: varchar('name_en', { length: 150 }).notNull(),
  nameAm: varchar('name_am', { length: 150 }),
  code: varchar('code', { length: 50 }).unique(),
  parentDepartmentId: uuid('parent_department_id').references((): AnyPgColumn => departments.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameEn: varchar('name_en', { length: 150 }).notNull(),
  nameAm: varchar('name_am', { length: 150 }),
  code: varchar('code', { length: 50 }).unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  nameAm: varchar('name_am', { length: 100 }),
  gracePeriodMinutes: integer('grace_period_minutes').notNull().default(0),
  lateAfterMinutes: integer('late_after_minutes').notNull().default(0),
  earlyOutBeforeMinutes: integer('early_out_before_minutes').notNull().default(0),
  isOvernight: boolean('is_overnight').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const shiftSegments = pgTable('shift_segments', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  nameAm: varchar('name_am', { length: 100 }),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  sortOrder: integer('sort_order').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const shiftBreaks = pgTable('shift_breaks', {
  id: uuid('id').primaryKey().defaultRandom(),
  shiftId: uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  nameAm: varchar('name_am', { length: 100 }),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  isPaid: boolean('is_paid').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const workSchedules = pgTable('work_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameEn: varchar('name_en', { length: 100 }).notNull(),
  nameAm: varchar('name_am', { length: 100 }),
  description: text('description'),
  isDefault: boolean('is_default').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const workScheduleDays = pgTable('work_schedule_days', {
  id: uuid('id').primaryKey().defaultRandom(),
  workScheduleId: uuid('work_schedule_id').notNull().references(() => workSchedules.id, { onDelete: 'cascade' }),
  dayOfWeek: varchar('day_of_week', { length: 20 }).notNull(),
  shiftId: uuid('shift_id').references(() => shifts.id),
  isOffDay: boolean('is_off_day').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  workScheduleDayUnique: unique('work_schedule_days_schedule_day_unique').on(table.workScheduleId, table.dayOfWeek),
}));

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').references(() => user.id),
  employeeCode: varchar('employee_code', { length: 50 }).notNull().unique(),
  payrollId: varchar('payroll_id', { length: 50 }).unique(),
  biometricId: varchar('biometric_id', { length: 50 }).unique(),
  firstNameEn: varchar('first_name_en', { length: 100 }).notNull(),
  middleNameEn: varchar('middle_name_en', { length: 100 }),
  lastNameEn: varchar('last_name_en', { length: 100 }).notNull(),
  firstNameAm: varchar('first_name_am', { length: 100 }),
  middleNameAm: varchar('middle_name_am', { length: 100 }),
  lastNameAm: varchar('last_name_am', { length: 100 }),
  gender: varchar('gender', { length: 20 }),
  phoneNumber: varchar('phone_number', { length: 50 }),
  email: varchar('email', { length: 150 }),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
  positionId: uuid('position_id').references(() => positions.id),
  employmentStatus: varchar('employment_status', { length: 30 }).notNull().default('ACTIVE'),
  employmentType: varchar('employment_type', { length: 30 }).notNull().default('PERMANENT'),
  hireDate: date('hire_date'),
  terminationDate: date('termination_date'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  employeeStatusCheck: check('chk_employee_status', sql`${table.employmentStatus} IN ('ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED')`),
  employeeTypeCheck: check('chk_employee_type', sql`${table.employmentType} IN ('PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY')`),
}));

export const employeeWorkSchedules = pgTable('employee_work_schedules', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  workScheduleId: uuid('work_schedule_id').notNull().references(() => workSchedules.id),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const employeeSupervisors = pgTable('employee_supervisors', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  supervisorId: uuid('supervisor_id').notNull().references(() => employees.id),
  isPrimary: boolean('is_primary').notNull().default(true),
  effectiveFrom: date('effective_from').notNull().default(sql`CURRENT_DATE`),
  effectiveTo: date('effective_to'),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  employeeNotOwnSupervisorCheck: check('chk_employee_not_own_supervisor', sql`${table.employeeId} <> ${table.supervisorId}`),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  credential: one(authCredentials),
  sessions: many(authSessions),
  userRoles: many(userRoles),
  employees: many(employees),
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

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  parentDepartment: one(departments, {
    fields: [departments.parentDepartmentId],
    references: [departments.id],
    relationName: 'departmentHierarchy',
  }),
  childDepartments: many(departments, {
    relationName: 'departmentHierarchy',
  }),
  employees: many(employees),
}));

export const positionsRelations = relations(positions, ({ many }) => ({
  employees: many(employees),
}));

export const shiftsRelations = relations(shifts, ({ many }) => ({
  segments: many(shiftSegments),
  breaks: many(shiftBreaks),
}));

export const shiftSegmentsRelations = relations(shiftSegments, ({ one }) => ({
  shift: one(shifts, {
    fields: [shiftSegments.shiftId],
    references: [shifts.id],
  }),
}));

export const shiftBreaksRelations = relations(shiftBreaks, ({ one }) => ({
  shift: one(shifts, {
    fields: [shiftBreaks.shiftId],
    references: [shifts.id],
  }),
}));

export const workSchedulesRelations = relations(workSchedules, ({ many }) => ({
  employeeWorkSchedules: many(employeeWorkSchedules),
  days: many(workScheduleDays),
}));

export const workScheduleDaysRelations = relations(workScheduleDays, ({ one }) => ({
  workSchedule: one(workSchedules, {
    fields: [workScheduleDays.workScheduleId],
    references: [workSchedules.id],
  }),
  shift: one(shifts, {
    fields: [workScheduleDays.shiftId],
    references: [shifts.id],
  }),
}));

export const employeeWorkSchedulesRelations = relations(employeeWorkSchedules, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeWorkSchedules.employeeId],
    references: [employees.id],
  }),
  workSchedule: one(workSchedules, {
    fields: [employeeWorkSchedules.workScheduleId],
    references: [workSchedules.id],
  }),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(user, {
    fields: [employees.userId],
    references: [user.id],
  }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  position: one(positions, {
    fields: [employees.positionId],
    references: [positions.id],
  }),
  supervisorAssignments: many(employeeSupervisors, {
    relationName: 'employeeSupervisorAssignments',
  }),
  subordinateAssignments: many(employeeSupervisors, {
    relationName: 'employeeSubordinateAssignments',
  }),
  workSchedules: many(employeeWorkSchedules),
}));

export const employeeSupervisorsRelations = relations(employeeSupervisors, ({ one }) => ({
  employee: one(employees, {
    fields: [employeeSupervisors.employeeId],
    references: [employees.id],
    relationName: 'employeeSupervisorAssignments',
  }),
  supervisor: one(employees, {
    fields: [employeeSupervisors.supervisorId],
    references: [employees.id],
    relationName: 'employeeSubordinateAssignments',
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
  departments,
  positions,
  shifts,
  shiftSegments,
  shiftBreaks,
  workSchedules,
  workScheduleDays,
  employeeWorkSchedules,
  employees,
  employeeSupervisors,
};
