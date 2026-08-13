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
  uniqueIndex,
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

export const hrUnits = pgTable('hr_units', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameEn: varchar('name_en', { length: 150 }).notNull().unique(),
  nameAm: varchar('name_am', { length: 150 }),
  code: varchar('code', { length: 50 }).unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
});

export const userHrUnits = pgTable('user_hr_units', {
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  hrUnitId: uuid('hr_unit_id').notNull().references(() => hrUnits.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.hrUnitId] }),
  userIdx: index('user_hr_units_user_id_idx').on(table.userId),
  hrUnitIdx: index('user_hr_units_hr_unit_id_idx').on(table.hrUnitId),
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

export const biometricExemptions = pgTable('biometric_exemptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id, { onDelete: 'cascade' }),
  positionId: uuid('position_id').references(() => positions.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').references(() => user.id),
  updatedBy: text('updated_by').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  employeeOrPositionCheck: check('chk_biometric_exemption_target', sql`num_nonnulls(${table.employeeId}, ${table.positionId}) = 1`),
  activeEmployeeUnique: uniqueIndex('biometric_exemptions_active_employee_unique')
    .on(table.employeeId)
    .where(sql`${table.isActive} = true AND ${table.employeeId} IS NOT NULL`),
  activePositionUnique: uniqueIndex('biometric_exemptions_active_position_unique')
    .on(table.positionId)
    .where(sql`${table.isActive} = true AND ${table.positionId} IS NOT NULL`),
  employeeIdx: index('biometric_exemptions_employee_id_idx').on(table.employeeId),
  positionIdx: index('biometric_exemptions_position_id_idx').on(table.positionId),
  activeIdx: index('biometric_exemptions_active_idx').on(table.isActive),
}));

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
  hrUnitId: uuid('hr_unit_id').references(() => hrUnits.id),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
  positionId: uuid('position_id').references(() => positions.id),
  positionName: varchar('position_name', { length: 200 }),
  employmentStatus: varchar('employment_status', { length: 30 }).notNull().default('ACTIVE'),
  employmentType: varchar('employment_type', { length: 30 }).notNull().default('PERMANENT'),
  hireDate: date('hire_date'),
  terminationDate: date('termination_date'),
  sourceIdNo: varchar('source_id_no', { length: 50 }),
  sourceEmployeeCode: varchar('source_employee_code', { length: 50 }),
  sourceEmploymentStatus: varchar('source_employment_status', { length: 100 }),
  sourceDepartmentName: varchar('source_department_name', { length: 200 }),
  sourcePositionName: varchar('source_position_name', { length: 200 }),
  sourcePositionCode: varchar('source_position_code', { length: 50 }),
  salary: numeric('salary', { precision: 14, scale: 2 }),
  salaryStep: varchar('salary_step', { length: 50 }),
  sourceImportedAt: timestamp('source_imported_at', { withTimezone: true, precision: 6 }),
  sourceRawPayload: jsonb('source_raw_payload'),
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

export const biometricDevices = pgTable('biometric_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceName: varchar('device_name', { length: 150 }).notNull(),
  deviceCode: varchar('device_code', { length: 100 }).notNull().unique(),
  ipAddress: varchar('ip_address', { length: 100 }),
  port: integer('port').default(4370),
  locationName: varchar('location_name', { length: 150 }),
  departmentId: uuid('department_id').references(() => departments.id),
  deviceType: varchar('device_type', { length: 50 }).notNull().default('BIOMETRIC'),
  connectionType: varchar('connection_type', { length: 50 }).notNull().default('TCP_IP'),
  vendor: varchar('vendor', { length: 50 }).notNull().default('ZKTECO'),
  protocol: varchar('protocol', { length: 50 }).notNull().default('TCP_IP'),
  integrationMode: varchar('integration_mode', { length: 30 }).notNull().default('HYBRID'),
  preferredMode: varchar('preferred_mode', { length: 30 }).notNull().default('PUSH_ADMS'),
  pushEnabled: boolean('push_enabled').notNull().default(true),
  pullEnabled: boolean('pull_enabled').notNull().default(true),
  pushSecret: varchar('push_secret', { length: 200 }),
  communicationKey: varchar('communication_key', { length: 100 }),
  serialNumber: varchar('serial_number', { length: 150 }),
  model: varchar('model', { length: 150 }),
  manufacturer: varchar('manufacturer', { length: 150 }),
  isActive: boolean('is_active').notNull().default(true),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: false }),
  lastSuccessfulSyncAt: timestamp('last_successful_sync_at', { withTimezone: false }),
  lastFailedSyncAt: timestamp('last_failed_sync_at', { withTimezone: false }),
  lastPushAt: timestamp('last_push_at', { withTimezone: false }),
  lastPullAt: timestamp('last_pull_at', { withTimezone: false }),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: false }),
  lastErrorMessage: text('last_error_message'),
  syncIntervalMinutes: integer('sync_interval_minutes').notNull().default(5),
  autoSyncEnabled: boolean('auto_sync_enabled').notNull().default(true),
  healthStatus: varchar('health_status', { length: 30 }).notNull().default('UNKNOWN'),
  fallbackToPull: boolean('fallback_to_pull').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  deviceTypeCheck: check('chk_device_type', sql`${table.deviceType} IN ('BIOMETRIC', 'RFID', 'FACE_RECOGNITION', 'MOBILE', 'WEB')`),
  connectionTypeCheck: check('chk_connection_type', sql`${table.connectionType} IN ('TCP_IP', 'USB', 'WIFI', 'API')`),
  integrationModeCheck: check('chk_device_integration_mode', sql`${table.integrationMode} IN ('PUSH_ADMS', 'TCP_PULL', 'HYBRID', 'MANUAL_ONLY', 'DISABLED')`),
  healthStatusCheck: check('chk_device_health_status', sql`${table.healthStatus} IN ('ONLINE', 'OFFLINE', 'UNKNOWN', 'ERROR')`),
}));

export const attendanceSyncBatches = pgTable('attendance_sync_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: uuid('device_id').references(() => biometricDevices.id),
  syncStartedAt: timestamp('sync_started_at', { withTimezone: false }).notNull().defaultNow(),
  syncCompletedAt: timestamp('sync_completed_at', { withTimezone: false }),
  syncStatus: varchar('sync_status', { length: 30 }).notNull().default('STARTED'),
  totalRecords: integer('total_records').notNull().default(0),
  successfulRecords: integer('successful_records').notNull().default(0),
  failedRecords: integer('failed_records').notNull().default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  syncStatusCheck: check('chk_sync_status', sql`${table.syncStatus} IN ('STARTED', 'COMPLETED', 'FAILED', 'PARTIAL')`),
  deviceIdIdx: index('idx_attendance_sync_batches_device_id').on(table.deviceId),
}));

export const attendancePunches = pgTable('attendance_punches', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').references(() => employees.id),
  biometricId: varchar('biometric_id', { length: 100 }).notNull(),
  deviceId: uuid('device_id').references(() => biometricDevices.id),
  syncBatchId: uuid('sync_batch_id').references(() => attendanceSyncBatches.id),
  externalUid: varchar('external_uid', { length: 200 }),
  punchTime: timestamp('punch_time', { withTimezone: false }).notNull(),
  punchType: varchar('punch_type', { length: 30 }).notNull().default('UNKNOWN'),
  verificationType: varchar('verification_type', { length: 50 }),
  devicePunchId: varchar('device_punch_id', { length: 150 }),
  source: varchar('source', { length: 30 }).notNull().default('DEVICE'),
  isProcessed: boolean('is_processed').notNull().default(false),
  isManual: boolean('is_manual').notNull().default(false),
  manualReason: text('manual_reason'),
  approvedBy: text('approved_by').references(() => user.id),
  approvedAt: timestamp('approved_at', { withTimezone: false }),
  processedAt: timestamp('processed_at', { withTimezone: false }),
  rawPayload: jsonb('raw_payload'),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  punchTypeCheck: check('chk_punch_type', sql`${table.punchType} IN ('IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN')`),
  punchSourceCheck: check('chk_punch_source', sql`${table.source} IN ('DEVICE', 'MANUAL', 'IMPORT', 'MOBILE', 'WEB')`),
  uniquePunch: uniqueIndex('ux_attendance_punch_unique').on(
    table.biometricId,
    table.punchTime,
    sql`COALESCE(${table.deviceId}, '00000000-0000-0000-0000-000000000000'::uuid)`,
  ),
  externalUidUnique: uniqueIndex('ux_attendance_punch_external_uid').on(table.deviceId, table.externalUid).where(sql`${table.externalUid} IS NOT NULL`),
  employeeIdIdx: index('idx_attendance_punches_employee_id').on(table.employeeId),
  biometricIdIdx: index('idx_attendance_punches_biometric_id').on(table.biometricId),
  punchTimeIdx: index('idx_attendance_punches_punch_time').on(table.punchTime),
  employeeTimeIdx: index('idx_attendance_punches_employee_time').on(table.employeeId, table.punchTime),
  processedIdx: index('idx_attendance_punches_processed').on(table.isProcessed),
}));

export const attendanceDailyRecords = pgTable('attendance_daily_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  attendanceDate: date('attendance_date').notNull(),
  firstPunchId: uuid('first_punch_id').references(() => attendancePunches.id),
  lastPunchId: uuid('last_punch_id').references(() => attendancePunches.id),
  checkInAt: timestamp('check_in_at', { withTimezone: false }),
  checkOutAt: timestamp('check_out_at', { withTimezone: false }),
  totalPunches: integer('total_punches').notNull().default(0),
  attendanceDays: numeric('attendance_days', { precision: 4, scale: 2 }).notNull().default('0'),
  leaveDays: numeric('leave_days', { precision: 4, scale: 2 }).notNull().default('0'),
  payableDays: numeric('payable_days', { precision: 4, scale: 2 }).notNull().default('0'),
  absenceDays: numeric('absence_days', { precision: 4, scale: 2 }).notNull().default('1'),
  isBiometricExempt: boolean('is_biometric_exempt').notNull().default(false),
  payrollNote: text('payroll_note'),
  status: varchar('status', { length: 30 }).notNull().default('PENDING_SUPERVISOR'),
  supervisorApprovedBy: text('supervisor_approved_by').references(() => user.id),
  supervisorApprovedAt: timestamp('supervisor_approved_at', { withTimezone: false }),
  hrApprovedBy: text('hr_approved_by').references(() => user.id),
  hrApprovedAt: timestamp('hr_approved_at', { withTimezone: false }),
  returnedBy: text('returned_by').references(() => user.id),
  returnedAt: timestamp('returned_at', { withTimezone: false }),
  returnReason: text('return_reason'),
  payrollReadyAt: timestamp('payroll_ready_at', { withTimezone: false }),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  statusCheck: check('chk_attendance_daily_record_status', sql`${table.status} IN ('PENDING_SUPERVISOR', 'RETURNED', 'SUPERVISOR_APPROVED', 'HR_APPROVED')`),
  attendanceDaysCheck: check('chk_attendance_daily_record_attendance_days', sql`${table.attendanceDays} >= 0 AND ${table.attendanceDays} <= 1`),
  leaveDaysCheck: check('chk_attendance_daily_record_leave_days', sql`${table.leaveDays} >= 0 AND ${table.leaveDays} <= 1`),
  payableDaysCheck: check('chk_attendance_daily_record_payable_days', sql`${table.payableDays} >= 0 AND ${table.payableDays} <= 1`),
  absenceDaysCheck: check('chk_attendance_daily_record_absence_days', sql`${table.absenceDays} >= 0 AND ${table.absenceDays} <= 1`),
  employeeDateUnique: uniqueIndex('ux_attendance_daily_records_employee_date').on(table.employeeId, table.attendanceDate),
  employeeIdIdx: index('idx_attendance_daily_records_employee_id').on(table.employeeId),
  attendanceDateIdx: index('idx_attendance_daily_records_attendance_date').on(table.attendanceDate),
  statusIdx: index('idx_attendance_daily_records_status').on(table.status),
}));

export const attendanceDailyRecordAdjustments = pgTable('attendance_daily_record_adjustments', {
  id: uuid('id').primaryKey().defaultRandom(),
  attendanceDailyRecordId: uuid('attendance_daily_record_id').notNull().references(() => attendanceDailyRecords.id),
  adjustedBy: text('adjusted_by').notNull().references(() => user.id),
  previousAttendanceDays: numeric('previous_attendance_days', { precision: 4, scale: 2 }).notNull(),
  newAttendanceDays: numeric('new_attendance_days', { precision: 4, scale: 2 }).notNull(),
  previousLeaveDays: numeric('previous_leave_days', { precision: 4, scale: 2 }).notNull(),
  newLeaveDays: numeric('new_leave_days', { precision: 4, scale: 2 }).notNull(),
  previousPayableDays: numeric('previous_payable_days', { precision: 4, scale: 2 }).notNull(),
  newPayableDays: numeric('new_payable_days', { precision: 4, scale: 2 }).notNull(),
  previousAbsenceDays: numeric('previous_absence_days', { precision: 4, scale: 2 }).notNull(),
  newAbsenceDays: numeric('new_absence_days', { precision: 4, scale: 2 }).notNull(),
  previousPayrollNote: text('previous_payroll_note'),
  newPayrollNote: text('new_payroll_note'),
  reason: text('reason'),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  recordIdIdx: index('idx_attendance_daily_record_adjustments_record_id').on(table.attendanceDailyRecordId),
  adjustedByIdx: index('idx_attendance_daily_record_adjustments_adjusted_by').on(table.adjustedBy),
  createdAtIdx: index('idx_attendance_daily_record_adjustments_created_at').on(table.createdAt),
}));

export const manualPunchRequests = pgTable('manual_punch_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  requestedPunchTime: timestamp('requested_punch_time', { withTimezone: false }).notNull(),
  requestedPunchType: varchar('requested_punch_type', { length: 30 }).notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('PENDING'),
  requestedBy: text('requested_by').notNull().references(() => user.id),
  approvedBy: text('approved_by').references(() => user.id),
  approvedAt: timestamp('approved_at', { withTimezone: false }),
  rejectedBy: text('rejected_by').references(() => user.id),
  rejectedAt: timestamp('rejected_at', { withTimezone: false }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  manualPunchStatusCheck: check('chk_manual_punch_status', sql`${table.status} IN ('PENDING', 'APPROVED', 'REJECTED')`),
  manualRequestedPunchTypeCheck: check('chk_manual_requested_punch_type', sql`${table.requestedPunchType} IN ('IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN')`),
}));

export const leaveFiscalYears = pgTable('leave_fiscal_years', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  startsAt: date('starts_at').notNull(),
  endsAt: date('ends_at').notNull(),
  isActive: boolean('is_active').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  dateRangeCheck: check('chk_leave_fiscal_year_date_range', sql`${table.startsAt} <= ${table.endsAt}`),
}));

export const leaveTypes = pgTable('leave_types', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  nameEn: varchar('name_en', { length: 150 }).notNull(),
  nameAm: varchar('name_am', { length: 150 }),
  description: text('description'),
  deductsAnnualBalance: boolean('deducts_annual_balance').notNull().default(false),
  requiresBalance: boolean('requires_balance').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
});

export const leaveBalances = pgTable('leave_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  fiscalYearId: uuid('fiscal_year_id').notNull().references(() => leaveFiscalYears.id),
  employmentTypeSnapshot: varchar('employment_type_snapshot', { length: 30 }).notNull(),
  opening: numeric('opening', { precision: 8, scale: 2 }).notNull().default('0'),
  transferredIn: numeric('transferred_in', { precision: 8, scale: 2 }).notNull().default('0'),
  used: numeric('used', { precision: 8, scale: 2 }).notNull().default('0'),
  available: numeric('available', { precision: 8, scale: 2 }).notNull().default('0'),
  createdBy: text('created_by').references(() => user.id),
  updatedBy: text('updated_by').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  balanceEmployeeFiscalYearUnique: unique('leave_balances_employee_fiscal_year_unique').on(table.employeeId, table.fiscalYearId),
  employmentTypeSnapshotCheck: check('chk_leave_balance_employment_type', sql`${table.employmentTypeSnapshot} IN ('PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY')`),
  nonNegativeOpeningCheck: check('chk_leave_balance_opening_nonnegative', sql`${table.opening} >= 0`),
  nonNegativeTransferredInCheck: check('chk_leave_balance_transferred_in_nonnegative', sql`${table.transferredIn} >= 0`),
  nonNegativeUsedCheck: check('chk_leave_balance_used_nonnegative', sql`${table.used} >= 0`),
  nonNegativeAvailableCheck: check('chk_leave_balance_available_nonnegative', sql`${table.available} >= 0`),
}));

export const leaveBalanceTransactions = pgTable('leave_balance_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaveBalanceId: uuid('leave_balance_id').notNull().references(() => leaveBalances.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  fiscalYearId: uuid('fiscal_year_id').notNull().references(() => leaveFiscalYears.id),
  leaveRequestId: uuid('leave_request_id'),
  linkedTransactionId: uuid('linked_transaction_id'),
  type: varchar('type', { length: 40 }).notNull(),
  days: numeric('days', { precision: 8, scale: 2 }).notNull(),
  note: text('note'),
  createdBy: text('created_by').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  transactionTypeCheck: check('chk_leave_balance_transaction_type', sql`${table.type} IN ('INITIAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'DEDUCTION', 'REVERSAL', 'ADJUSTMENT')`),
}));

export const leaveRequests = pgTable('leave_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  leaveTypeId: uuid('leave_type_id').notNull().references(() => leaveTypes.id),
  fiscalYearId: uuid('fiscal_year_id').references(() => leaveFiscalYears.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  requestedDays: numeric('requested_days', { precision: 8, scale: 2 }).notNull(),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('PENDING'),
  requestedBy: text('requested_by').notNull().references(() => user.id),
  approvedBy: text('approved_by').references(() => user.id),
  approvedAt: timestamp('approved_at', { withTimezone: false }),
  rejectedBy: text('rejected_by').references(() => user.id),
  rejectedAt: timestamp('rejected_at', { withTimezone: false }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  leaveRequestDateRangeCheck: check('chk_leave_request_date_range', sql`${table.startDate} <= ${table.endDate}`),
  leaveRequestStatusCheck: check('chk_leave_request_status', sql`${table.status} IN ('PENDING', 'APPROVED', 'REJECTED')`),
  leaveRequestedDaysPositiveCheck: check('chk_leave_request_days_positive', sql`${table.requestedDays} > 0`),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  credential: one(authCredentials),
  sessions: many(authSessions),
  userRoles: many(userRoles),
  userHrUnits: many(userHrUnits),
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

export const hrUnitsRelations = relations(hrUnits, ({ many }) => ({
  employees: many(employees),
  userHrUnits: many(userHrUnits),
}));

export const userHrUnitsRelations = relations(userHrUnits, ({ one }) => ({
  user: one(user, {
    fields: [userHrUnits.userId],
    references: [user.id],
  }),
  hrUnit: one(hrUnits, {
    fields: [userHrUnits.hrUnitId],
    references: [hrUnits.id],
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
  hrUnit: one(hrUnits, {
    fields: [employees.hrUnitId],
    references: [hrUnits.id],
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

export const biometricExemptionsRelations = relations(biometricExemptions, ({ one }) => ({
  employee: one(employees, {
    fields: [biometricExemptions.employeeId],
    references: [employees.id],
  }),
  position: one(positions, {
    fields: [biometricExemptions.positionId],
    references: [positions.id],
  }),
  createdByUser: one(user, {
    fields: [biometricExemptions.createdBy],
    references: [user.id],
    relationName: 'biometricExemptionCreatedBy',
  }),
  updatedByUser: one(user, {
    fields: [biometricExemptions.updatedBy],
    references: [user.id],
    relationName: 'biometricExemptionUpdatedBy',
  }),
}));

export const biometricDevicesRelations = relations(biometricDevices, ({ one, many }) => ({
  department: one(departments, {
    fields: [biometricDevices.departmentId],
    references: [departments.id],
  }),
  syncBatches: many(attendanceSyncBatches),
  punches: many(attendancePunches),
}));

export const attendanceSyncBatchesRelations = relations(attendanceSyncBatches, ({ one, many }) => ({
  device: one(biometricDevices, {
    fields: [attendanceSyncBatches.deviceId],
    references: [biometricDevices.id],
  }),
  punches: many(attendancePunches),
}));

export const attendancePunchesRelations = relations(attendancePunches, ({ one }) => ({
  employee: one(employees, {
    fields: [attendancePunches.employeeId],
    references: [employees.id],
  }),
  approver: one(user, {
    fields: [attendancePunches.approvedBy],
    references: [user.id],
  }),
  device: one(biometricDevices, {
    fields: [attendancePunches.deviceId],
    references: [biometricDevices.id],
  }),
  syncBatch: one(attendanceSyncBatches, {
    fields: [attendancePunches.syncBatchId],
    references: [attendanceSyncBatches.id],
  }),
}));

export const attendanceDailyRecordsRelations = relations(attendanceDailyRecords, ({ one, many }) => ({
  employee: one(employees, {
    fields: [attendanceDailyRecords.employeeId],
    references: [employees.id],
  }),
  firstPunch: one(attendancePunches, {
    fields: [attendanceDailyRecords.firstPunchId],
    references: [attendancePunches.id],
    relationName: 'attendanceDailyRecordFirstPunch',
  }),
  lastPunch: one(attendancePunches, {
    fields: [attendanceDailyRecords.lastPunchId],
    references: [attendancePunches.id],
    relationName: 'attendanceDailyRecordLastPunch',
  }),
  supervisorApprover: one(user, {
    fields: [attendanceDailyRecords.supervisorApprovedBy],
    references: [user.id],
    relationName: 'attendanceDailyRecordSupervisorApprover',
  }),
  hrApprover: one(user, {
    fields: [attendanceDailyRecords.hrApprovedBy],
    references: [user.id],
    relationName: 'attendanceDailyRecordHrApprover',
  }),
  returner: one(user, {
    fields: [attendanceDailyRecords.returnedBy],
    references: [user.id],
    relationName: 'attendanceDailyRecordReturner',
  }),
  adjustments: many(attendanceDailyRecordAdjustments),
}));

export const attendanceDailyRecordAdjustmentsRelations = relations(attendanceDailyRecordAdjustments, ({ one }) => ({
  attendanceDailyRecord: one(attendanceDailyRecords, {
    fields: [attendanceDailyRecordAdjustments.attendanceDailyRecordId],
    references: [attendanceDailyRecords.id],
  }),
  adjuster: one(user, {
    fields: [attendanceDailyRecordAdjustments.adjustedBy],
    references: [user.id],
    relationName: 'attendanceDailyRecordAdjustmentAdjuster',
  }),
}));

export const manualPunchRequestsRelations = relations(manualPunchRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [manualPunchRequests.employeeId],
    references: [employees.id],
  }),
  requester: one(user, {
    fields: [manualPunchRequests.requestedBy],
    references: [user.id],
    relationName: 'manualPunchRequestRequester',
  }),
  approver: one(user, {
    fields: [manualPunchRequests.approvedBy],
    references: [user.id],
    relationName: 'manualPunchRequestApprover',
  }),
  rejecter: one(user, {
    fields: [manualPunchRequests.rejectedBy],
    references: [user.id],
    relationName: 'manualPunchRequestRejecter',
  }),
}));

export const leaveFiscalYearsRelations = relations(leaveFiscalYears, ({ many }) => ({
  balances: many(leaveBalances),
  requests: many(leaveRequests),
}));

export const leaveTypesRelations = relations(leaveTypes, ({ many }) => ({
  requests: many(leaveRequests),
}));

export const leaveBalancesRelations = relations(leaveBalances, ({ one, many }) => ({
  employee: one(employees, {
    fields: [leaveBalances.employeeId],
    references: [employees.id],
  }),
  fiscalYear: one(leaveFiscalYears, {
    fields: [leaveBalances.fiscalYearId],
    references: [leaveFiscalYears.id],
  }),
  transactions: many(leaveBalanceTransactions),
}));

export const leaveBalanceTransactionsRelations = relations(leaveBalanceTransactions, ({ one }) => ({
  leaveBalance: one(leaveBalances, {
    fields: [leaveBalanceTransactions.leaveBalanceId],
    references: [leaveBalances.id],
  }),
  employee: one(employees, {
    fields: [leaveBalanceTransactions.employeeId],
    references: [employees.id],
  }),
  fiscalYear: one(leaveFiscalYears, {
    fields: [leaveBalanceTransactions.fiscalYearId],
    references: [leaveFiscalYears.id],
  }),
  leaveRequest: one(leaveRequests, {
    fields: [leaveBalanceTransactions.leaveRequestId],
    references: [leaveRequests.id],
  }),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [leaveRequests.employeeId],
    references: [employees.id],
  }),
  leaveType: one(leaveTypes, {
    fields: [leaveRequests.leaveTypeId],
    references: [leaveTypes.id],
  }),
  fiscalYear: one(leaveFiscalYears, {
    fields: [leaveRequests.fiscalYearId],
    references: [leaveFiscalYears.id],
  }),
  requester: one(user, {
    fields: [leaveRequests.requestedBy],
    references: [user.id],
    relationName: 'leaveRequestRequester',
  }),
  approver: one(user, {
    fields: [leaveRequests.approvedBy],
    references: [user.id],
    relationName: 'leaveRequestApprover',
  }),
  rejecter: one(user, {
    fields: [leaveRequests.rejectedBy],
    references: [user.id],
    relationName: 'leaveRequestRejecter',
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
  hrUnits,
  userHrUnits,
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
  biometricExemptions,
  biometricDevices,
  attendanceSyncBatches,
  attendancePunches,
  attendanceDailyRecords,
  attendanceDailyRecordAdjustments,
  manualPunchRequests,
  leaveFiscalYears,
  leaveTypes,
  leaveBalances,
  leaveBalanceTransactions,
  leaveRequests,
};
