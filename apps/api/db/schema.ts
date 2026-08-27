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
  supportingEvidenceName: text('supporting_evidence_name'),
  supportingEvidenceUrl: text('supporting_evidence_url'),
  supportingEvidenceMimeType: varchar('supporting_evidence_mime_type', { length: 150 }),
  supportingEvidenceSize: integer('supporting_evidence_size'),
  status: varchar('status', { length: 30 }).notNull().default('PENDING_SUPERVISOR'),
  isActive: boolean('is_active').notNull().default(false),
  requestedBy: text('requested_by').references(() => user.id),
  approvedBy: text('approved_by').references(() => user.id),
  approvedAt: timestamp('approved_at', { withTimezone: true, precision: 6 }),
  rejectedBy: text('rejected_by').references(() => user.id),
  rejectedAt: timestamp('rejected_at', { withTimezone: true, precision: 6 }),
  rejectionReason: text('rejection_reason'),
  createdBy: text('created_by').references(() => user.id),
  updatedBy: text('updated_by').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  employeeOrPositionCheck: check('chk_biometric_exemption_target', sql`num_nonnulls(${table.employeeId}, ${table.positionId}) = 1`),
  statusCheck: check('chk_biometric_exemption_status', sql`${table.status} IN ('PENDING_SUPERVISOR', 'APPROVED', 'REJECTED', 'INACTIVE')`),
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

export const holidays = pgTable('holidays', {
  id: uuid('id').primaryKey().defaultRandom(),
  nameEn: varchar('name_en', { length: 150 }).notNull(),
  nameAm: varchar('name_am', { length: 150 }),
  type: varchar('type', { length: 40 }).notNull(),
  durationDays: numeric('duration_days', { precision: 4, scale: 2 }).notNull().default('1'),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: text('created_by').references(() => user.id),
  updatedBy: text('updated_by').references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  typeCheck: check('chk_holiday_type', sql`${table.type} IN ('PUBLIC_HOLIDAY', 'INSTITUTION_OFF_DAY')`),
  durationDaysCheck: check('chk_holiday_duration_days', sql`${table.durationDays} IN (0.5, 1)`),
  dateRangeCheck: check('chk_holiday_date_range', sql`${table.startDate} <= ${table.endDate}`),
  dateRangeIdx: index('idx_holidays_date_range').on(table.startDate, table.endDate),
  activeIdx: index('idx_holidays_active').on(table.isActive),
  typeIdx: index('idx_holidays_type').on(table.type),
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

export const supervisorDelegations = pgTable('supervisor_delegations', {
  id: uuid('id').primaryKey().defaultRandom(),
  supervisorUserId: text('supervisor_user_id').notNull().references(() => user.id),
  supervisorEmployeeId: uuid('supervisor_employee_id').notNull().references(() => employees.id),
  delegateUserId: text('delegate_user_id').notNull().references(() => user.id),
  delegateEmployeeId: uuid('delegate_employee_id').notNull().references(() => employees.id),
  startsAt: timestamp('starts_at', { withTimezone: true, precision: 6 }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true, precision: 6 }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true, precision: 6 }),
  revokedBy: text('revoked_by').references(() => user.id),
  createdBy: text('created_by').notNull().references(() => user.id),
  createdAt: timestamp('created_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, precision: 6 }).notNull().defaultNow(),
}, (table) => ({
  supervisorIdx: index('idx_supervisor_delegations_supervisor').on(table.supervisorUserId, table.startsAt, table.endsAt),
  delegateIdx: index('idx_supervisor_delegations_delegate').on(table.delegateUserId, table.startsAt, table.endsAt),
  userNotOwnDelegateCheck: check('chk_supervisor_delegation_user_not_self', sql`${table.supervisorUserId} <> ${table.delegateUserId}`),
  employeeNotOwnDelegateCheck: check('chk_supervisor_delegation_employee_not_self', sql`${table.supervisorEmployeeId} <> ${table.delegateEmployeeId}`),
  dateRangeCheck: check('chk_supervisor_delegation_date_range', sql`${table.startsAt} < ${table.endsAt}`),
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
  supervisorDelegationId: uuid('supervisor_delegation_id').references(() => supervisorDelegations.id),
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
  holidayId: uuid('holiday_id').references(() => holidays.id),
  holidayDays: numeric('holiday_days', { precision: 4, scale: 2 }).notNull().default('0'),
  isHoliday: boolean('is_holiday').notNull().default(false),
  payableDays: numeric('payable_days', { precision: 4, scale: 2 }).notNull().default('0'),
  absenceDays: numeric('absence_days', { precision: 4, scale: 2 }).notNull().default('1'),
  overtimeMinutes: integer('overtime_minutes').notNull().default(0),
  overtimeHours: numeric('overtime_hours', { precision: 8, scale: 2 }).notNull().default('0'),
  overtimeDays: numeric('overtime_days', { precision: 8, scale: 2 }).notNull().default('0'),
  isBiometricExempt: boolean('is_biometric_exempt').notNull().default(false),
  payrollNote: text('payroll_note'),
  status: varchar('status', { length: 30 }).notNull().default('PENDING_SUPERVISOR'),
  supervisorApprovedBy: text('supervisor_approved_by').references(() => user.id),
  supervisorApprovedAt: timestamp('supervisor_approved_at', { withTimezone: false }),
  supervisorDelegationId: uuid('supervisor_delegation_id').references(() => supervisorDelegations.id),
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
  holidayDaysCheck: check('chk_attendance_daily_record_holiday_days', sql`${table.holidayDays} >= 0 AND ${table.holidayDays} <= 1`),
  payableDaysCheck: check('chk_attendance_daily_record_payable_days', sql`${table.payableDays} >= 0 AND ${table.payableDays} <= 1`),
  absenceDaysCheck: check('chk_attendance_daily_record_absence_days', sql`${table.absenceDays} >= 0 AND ${table.absenceDays} <= 1`),
  overtimeMinutesCheck: check('chk_attendance_daily_record_overtime_minutes', sql`${table.overtimeMinutes} >= 0`),
  overtimeHoursCheck: check('chk_attendance_daily_record_overtime_hours', sql`${table.overtimeHours} >= 0`),
  overtimeDaysCheck: check('chk_attendance_daily_record_overtime_days', sql`${table.overtimeDays} >= 0`),
  employeeDateUnique: uniqueIndex('ux_attendance_daily_records_employee_date').on(table.employeeId, table.attendanceDate),
  employeeIdIdx: index('idx_attendance_daily_records_employee_id').on(table.employeeId),
  attendanceDateIdx: index('idx_attendance_daily_records_attendance_date').on(table.attendanceDate),
  holidayIdIdx: index('idx_attendance_daily_records_holiday_id').on(table.holidayId),
  statusIdx: index('idx_attendance_daily_records_status').on(table.status),
}));

export const notificationLogs = pgTable('notification_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: varchar('event_type', { length: 80 }).notNull(),
  channel: varchar('channel', { length: 20 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('PENDING'),
  recipientUserId: text('recipient_user_id').references(() => user.id, { onDelete: 'set null' }),
  recipientEmployeeId: uuid('recipient_employee_id').references(() => employees.id, { onDelete: 'set null' }),
  recipientName: text('recipient_name'),
  destination: text('destination'),
  subject: text('subject'),
  message: text('message').notNull(),
  locale: varchar('locale', { length: 10 }).notNull().default('en'),
  relatedEntityType: varchar('related_entity_type', { length: 80 }),
  relatedEntityId: uuid('related_entity_id'),
  metadata: jsonb('metadata'),
  attempts: integer('attempts').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: false }),
  nextAttemptAt: timestamp('next_attempt_at', { withTimezone: false }),
  providerMessageId: text('provider_message_id'),
  providerResponse: jsonb('provider_response'),
  errorMessage: text('error_message'),
  sentAt: timestamp('sent_at', { withTimezone: false }),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  channelCheck: check('chk_notification_logs_channel', sql`${table.channel} IN ('EMAIL', 'SMS')`),
  statusCheck: check('chk_notification_logs_status', sql`${table.status} IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED')`),
  eventTypeIdx: index('idx_notification_logs_event_type').on(table.eventType),
  channelStatusIdx: index('idx_notification_logs_channel_status').on(table.channel, table.status),
  createdAtIdx: index('idx_notification_logs_created_at').on(table.createdAt),
  recipientUserIdx: index('idx_notification_logs_recipient_user_id').on(table.recipientUserId),
  recipientEmployeeIdx: index('idx_notification_logs_recipient_employee_id').on(table.recipientEmployeeId),
  relatedEntityIdx: index('idx_notification_logs_related_entity').on(table.relatedEntityType, table.relatedEntityId),
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
  supervisorDelegationId: uuid('supervisor_delegation_id').references(() => supervisorDelegations.id),
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
  supportingDocumentName: text('supporting_document_name'),
  supportingDocumentUrl: text('supporting_document_url'),
  supportingDocumentMimeType: varchar('supporting_document_mime_type', { length: 150 }),
  supportingDocumentSize: integer('supporting_document_size'),
  status: varchar('status', { length: 30 }).notNull().default('PENDING_HR_REVIEW'),
  requestedBy: text('requested_by').notNull().references(() => user.id),
  hrReviewedBy: text('hr_reviewed_by').references(() => user.id),
  hrReviewedAt: timestamp('hr_reviewed_at', { withTimezone: false }),
  hrReviewNote: text('hr_review_note'),
  approvedBy: text('approved_by').references(() => user.id),
  approvedAt: timestamp('approved_at', { withTimezone: false }),
  rejectedBy: text('rejected_by').references(() => user.id),
  rejectedAt: timestamp('rejected_at', { withTimezone: false }),
  rejectionReason: text('rejection_reason'),
  supervisorDelegationId: uuid('supervisor_delegation_id').references(() => supervisorDelegations.id),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  manualPunchStatusCheck: check('chk_manual_punch_status', sql`${table.status} IN ('PENDING', 'APPROVED', 'REJECTED', 'PENDING_HR_REVIEW', 'HR_REVIEWED', 'HR_REJECTED', 'SUPERVISOR_APPROVED', 'SUPERVISOR_REJECTED')`),
  manualRequestedPunchTypeCheck: check('chk_manual_requested_punch_type', sql`${table.requestedPunchType} IN ('IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN')`),
}));

export const overtimeRequests = pgTable('overtime_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  attendanceDailyRecordId: uuid('attendance_daily_record_id').references(() => attendanceDailyRecords.id),
  overtimeDate: date('overtime_date').notNull(),
  startAt: timestamp('start_at', { withTimezone: false }).notNull(),
  endAt: timestamp('end_at', { withTimezone: false }).notNull(),
  requestedMinutes: integer('requested_minutes').notNull(),
  approvedMinutes: integer('approved_minutes').notNull().default(0),
  overtimeDays: numeric('overtime_days', { precision: 8, scale: 2 }).notNull().default('0'),
  reason: text('reason').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('ASSIGNED'),
  requestedBy: text('requested_by').notNull().references(() => user.id),
  requestedSupervisorDelegationId: uuid('requested_supervisor_delegation_id').references(() => supervisorDelegations.id),
  approvedBy: text('approved_by').references(() => user.id),
  approvedAt: timestamp('approved_at', { withTimezone: false }),
  rejectedBy: text('rejected_by').references(() => user.id),
  rejectedAt: timestamp('rejected_at', { withTimezone: false }),
  rejectionReason: text('rejection_reason'),
  supervisorDelegationId: uuid('supervisor_delegation_id').references(() => supervisorDelegations.id),
  payrollNote: text('payroll_note'),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  overtimeStatusCheck: check('chk_overtime_request_status', sql`${table.status} IN ('ASSIGNED', 'APPROVED', 'REJECTED')`),
  overtimeDateRangeCheck: check('chk_overtime_request_date_range', sql`${table.startAt} < ${table.endAt}`),
  overtimeRequestedMinutesCheck: check('chk_overtime_request_requested_minutes', sql`${table.requestedMinutes} > 0`),
  overtimeApprovedMinutesCheck: check('chk_overtime_request_approved_minutes', sql`${table.approvedMinutes} >= 0`),
  overtimeDaysCheck: check('chk_overtime_request_overtime_days', sql`${table.overtimeDays} >= 0`),
  employeeDateIdx: index('idx_overtime_requests_employee_date').on(table.employeeId, table.overtimeDate),
  statusIdx: index('idx_overtime_requests_status').on(table.status),
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
  allowedDays: numeric('allowed_days', { precision: 8, scale: 2 }),
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
  reserved: numeric('reserved', { precision: 8, scale: 2 }).notNull().default('0'),
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
  nonNegativeReservedCheck: check('chk_leave_balance_reserved_nonnegative', sql`${table.reserved} >= 0`),
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
  transactionTypeCheck: check('chk_leave_balance_transaction_type', sql`${table.type} IN ('INITIAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'DEDUCTION', 'RESERVATION', 'CONSUMPTION', 'REVERSAL', 'ADJUSTMENT')`),
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
  supervisorDelegationId: uuid('supervisor_delegation_id').references(() => supervisorDelegations.id),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  leaveRequestDateRangeCheck: check('chk_leave_request_date_range', sql`${table.startDate} <= ${table.endDate}`),
  leaveRequestStatusCheck: check('chk_leave_request_status', sql`${table.status} IN ('PENDING', 'APPROVED', 'REJECTED')`),
  leaveRequestedDaysPositiveCheck: check('chk_leave_request_days_positive', sql`${table.requestedDays} > 0`),
}));

export const annualLeaveRequestDates = pgTable('annual_leave_request_dates', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaveRequestId: uuid('leave_request_id').notNull().references(() => leaveRequests.id, { onDelete: 'cascade' }),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  leaveDate: date('leave_date').notNull(),
  requestedDayValue: numeric('requested_day_value', { precision: 4, scale: 2 }).notNull(),
  approvedDayValue: numeric('approved_day_value', { precision: 4, scale: 2 }),
  status: varchar('status', { length: 30 }).notNull().default('PENDING'),
  source: varchar('source', { length: 30 }).notNull().default('ORIGINAL'),
  utilizationStatus: varchar('utilization_status', { length: 30 }).notNull().default('SCHEDULED'),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  requestDateUnique: unique('annual_leave_request_dates_request_date_unique').on(table.leaveRequestId, table.leaveDate),
  activeEmployeeDateUnique: uniqueIndex('annual_leave_request_dates_active_employee_date_unique')
    .on(table.employeeId, table.leaveDate)
    .where(sql`${table.status} IN ('PENDING', 'APPROVED') AND ${table.utilizationStatus} NOT IN ('INTERRUPTED', 'CANCELLED')`),
  requestedDayValueCheck: check('chk_annual_leave_request_dates_requested_value', sql`${table.requestedDayValue} IN (0.50, 1.00)`),
  approvedDayValueCheck: check('chk_annual_leave_request_dates_approved_value', sql`${table.approvedDayValue} IS NULL OR ${table.approvedDayValue} IN (0.00, 0.50, 1.00)`),
  statusCheck: check('chk_annual_leave_request_dates_status', sql`${table.status} IN ('PENDING', 'APPROVED', 'REJECTED')`),
  sourceCheck: check('chk_annual_leave_request_dates_source', sql`${table.source} IN ('ORIGINAL', 'CONTINUATION')`),
  utilizationStatusCheck: check('chk_annual_leave_request_dates_utilization_status', sql`${table.utilizationStatus} IN ('SCHEDULED', 'CONSUMED', 'INTERRUPTED', 'CANCELLED')`),
}));

export const leaveInterruptions = pgTable('leave_interruptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaveRequestId: uuid('leave_request_id').notNull().references(() => leaveRequests.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  recallAuthority: text('recall_authority').notNull(),
  authorityUserId: text('authority_user_id').references(() => user.id),
  actualWorkStartDate: date('actual_work_start_date').notNull(),
  actualWorkEndDate: date('actual_work_end_date').notNull(),
  status: varchar('status', { length: 30 }).notNull().default('PENDING'),
  requestedBy: text('requested_by').notNull().references(() => user.id),
  reviewedBy: text('reviewed_by').references(() => user.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: false }),
  rejectionReason: text('rejection_reason'),
  supervisorDelegationId: uuid('supervisor_delegation_id').references(() => supervisorDelegations.id),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  actualWorkDateRangeCheck: check('chk_leave_interruption_actual_work_range', sql`${table.actualWorkStartDate} <= ${table.actualWorkEndDate}`),
  statusCheck: check('chk_leave_interruption_status', sql`${table.status} IN ('PENDING', 'APPROVED', 'REJECTED')`),
  requestStatusIdx: index('idx_leave_interruptions_request_status').on(table.leaveRequestId, table.status),
}));

export const leaveInterruptionDates = pgTable('leave_interruption_dates', {
  id: uuid('id').primaryKey().defaultRandom(),
  leaveInterruptionId: uuid('leave_interruption_id').notNull().references(() => leaveInterruptions.id, { onDelete: 'cascade' }),
  kind: varchar('kind', { length: 40 }).notNull(),
  leaveDate: date('leave_date').notNull(),
  dayValue: numeric('day_value', { precision: 4, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: false }).notNull().defaultNow(),
}, (table) => ({
  interruptionKindDateUnique: unique('leave_interruption_dates_kind_date_unique').on(table.leaveInterruptionId, table.kind, table.leaveDate),
  kindCheck: check('chk_leave_interruption_dates_kind', sql`${table.kind} IN ('INTERRUPTED_PROPOSED', 'CONTINUATION_PROPOSED', 'INTERRUPTED_APPROVED', 'CONTINUATION_APPROVED')`),
  dayValueCheck: check('chk_leave_interruption_dates_day_value', sql`${table.dayValue} IN (0.50, 1.00)`),
}));

export const userRelations = relations(user, ({ one, many }) => ({
  credential: one(authCredentials),
  sessions: many(authSessions),
  userRoles: many(userRoles),
  employees: many(employees),
  supervisorDelegations: many(supervisorDelegations, { relationName: 'supervisorDelegationSupervisorUser' }),
  delegatedSupervisorDelegations: many(supervisorDelegations, { relationName: 'supervisorDelegationDelegateUser' }),
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

export const holidaysRelations = relations(holidays, ({ one, many }) => ({
  createdByUser: one(user, {
    fields: [holidays.createdBy],
    references: [user.id],
    relationName: 'holidayCreatedBy',
  }),
  updatedByUser: one(user, {
    fields: [holidays.updatedBy],
    references: [user.id],
    relationName: 'holidayUpdatedBy',
  }),
  attendanceDailyRecords: many(attendanceDailyRecords),
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
  supervisorDelegations: many(supervisorDelegations, {
    relationName: 'supervisorDelegationSupervisorEmployee',
  }),
  delegatedSupervisorDelegations: many(supervisorDelegations, {
    relationName: 'supervisorDelegationDelegateEmployee',
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

export const supervisorDelegationsRelations = relations(supervisorDelegations, ({ one }) => ({
  supervisorUser: one(user, {
    fields: [supervisorDelegations.supervisorUserId],
    references: [user.id],
    relationName: 'supervisorDelegationSupervisorUser',
  }),
  supervisorEmployee: one(employees, {
    fields: [supervisorDelegations.supervisorEmployeeId],
    references: [employees.id],
    relationName: 'supervisorDelegationSupervisorEmployee',
  }),
  delegateUser: one(user, {
    fields: [supervisorDelegations.delegateUserId],
    references: [user.id],
    relationName: 'supervisorDelegationDelegateUser',
  }),
  delegateEmployee: one(employees, {
    fields: [supervisorDelegations.delegateEmployeeId],
    references: [employees.id],
    relationName: 'supervisorDelegationDelegateEmployee',
  }),
  revoker: one(user, {
    fields: [supervisorDelegations.revokedBy],
    references: [user.id],
    relationName: 'supervisorDelegationRevoker',
  }),
  creator: one(user, {
    fields: [supervisorDelegations.createdBy],
    references: [user.id],
    relationName: 'supervisorDelegationCreator',
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
  holiday: one(holidays, {
    fields: [attendanceDailyRecords.holidayId],
    references: [holidays.id],
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

export const notificationLogsRelations = relations(notificationLogs, ({ one }) => ({
  recipientUser: one(user, {
    fields: [notificationLogs.recipientUserId],
    references: [user.id],
    relationName: 'notificationLogRecipientUser',
  }),
  recipientEmployee: one(employees, {
    fields: [notificationLogs.recipientEmployeeId],
    references: [employees.id],
    relationName: 'notificationLogRecipientEmployee',
  }),
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

export const overtimeRequestsRelations = relations(overtimeRequests, ({ one }) => ({
  employee: one(employees, {
    fields: [overtimeRequests.employeeId],
    references: [employees.id],
  }),
  attendanceDailyRecord: one(attendanceDailyRecords, {
    fields: [overtimeRequests.attendanceDailyRecordId],
    references: [attendanceDailyRecords.id],
  }),
  requester: one(user, {
    fields: [overtimeRequests.requestedBy],
    references: [user.id],
    relationName: 'overtimeRequestRequester',
  }),
  approver: one(user, {
    fields: [overtimeRequests.approvedBy],
    references: [user.id],
    relationName: 'overtimeRequestApprover',
  }),
  rejecter: one(user, {
    fields: [overtimeRequests.rejectedBy],
    references: [user.id],
    relationName: 'overtimeRequestRejecter',
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

export const leaveRequestsRelations = relations(leaveRequests, ({ one, many }) => ({
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
  annualLeaveDates: many(annualLeaveRequestDates),
  interruptions: many(leaveInterruptions),
}));

export const annualLeaveRequestDatesRelations = relations(annualLeaveRequestDates, ({ one }) => ({
  leaveRequest: one(leaveRequests, {
    fields: [annualLeaveRequestDates.leaveRequestId],
    references: [leaveRequests.id],
  }),
  employee: one(employees, {
    fields: [annualLeaveRequestDates.employeeId],
    references: [employees.id],
  }),
}));

export const leaveInterruptionsRelations = relations(leaveInterruptions, ({ one, many }) => ({
  leaveRequest: one(leaveRequests, {
    fields: [leaveInterruptions.leaveRequestId],
    references: [leaveRequests.id],
  }),
  dates: many(leaveInterruptionDates),
}));

export const leaveInterruptionDatesRelations = relations(leaveInterruptionDates, ({ one }) => ({
  interruption: one(leaveInterruptions, {
    fields: [leaveInterruptionDates.leaveInterruptionId],
    references: [leaveInterruptions.id],
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
  supervisorDelegations,
  holidays,
  biometricExemptions,
  biometricDevices,
  attendanceSyncBatches,
  attendancePunches,
  attendanceDailyRecords,
  attendanceDailyRecordAdjustments,
  manualPunchRequests,
  overtimeRequests,
  leaveFiscalYears,
  leaveTypes,
  leaveBalances,
  leaveBalanceTransactions,
  leaveRequests,
  annualLeaveRequestDates,
  leaveInterruptions,
  leaveInterruptionDates,
};
