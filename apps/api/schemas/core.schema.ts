import { z } from 'zod';

const UuidSchema = z.string().uuid();
const OptionalCodeSchema = z.string().min(1).max(50).nullable().optional();
const OptionalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const RequiredDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
export const DayOfWeekSchema = z.enum([
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
]);

export const EmploymentStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED']);
export const EmploymentTypeSchema = z.enum(['PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY']);
export const BiometricExemptionTargetTypeSchema = z.enum(['EMPLOYEE', 'POSITION']);

export const DepartmentSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  nameEn: z.string().openapi({ example: 'Human Resources' }),
  nameAm: z.string().nullable().openapi({ example: 'የሰው ሀብት' }),
  code: z.string().nullable().openapi({ example: 'HR' }),
  parentDepartmentId: z.string().nullable().openapi({ example: null }),
  isActive: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const PositionSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  nameEn: z.string().openapi({ example: 'HR Manager' }),
  nameAm: z.string().nullable().openapi({ example: 'የሰው ሀብት አስተዳዳሪ' }),
  code: z.string().nullable().openapi({ example: 'HR-MGR' }),
  isActive: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const ShiftSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  nameEn: z.string().openapi({ example: 'Day Shift' }),
  nameAm: z.string().nullable().openapi({ example: 'የቀን ፈረቃ' }),
  gracePeriodMinutes: z.number().int().openapi({ example: 15 }),
  lateAfterMinutes: z.number().int().openapi({ example: 10 }),
  earlyOutBeforeMinutes: z.number().int().openapi({ example: 30 }),
  isOvernight: z.boolean().openapi({ example: false }),
  isActive: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const ShiftSegmentSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  shiftId: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  nameEn: z.string().openapi({ example: 'Morning Session' }),
  nameAm: z.string().nullable().openapi({ example: 'የጠዋት ክፍለ ጊዜ' }),
  startTime: z.string().openapi({ example: '08:30:00' }),
  endTime: z.string().openapi({ example: '12:00:00' }),
  sortOrder: z.number().int().openapi({ example: 1 }),
  isActive: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const ShiftBreakSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  shiftId: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  nameEn: z.string().openapi({ example: 'Lunch Break' }),
  nameAm: z.string().nullable().openapi({ example: 'የምሳ እረፍት' }),
  startTime: z.string().openapi({ example: '12:30:00' }),
  endTime: z.string().openapi({ example: '13:00:00' }),
  isPaid: z.boolean().openapi({ example: false }),
  isActive: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const WorkScheduleSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  nameEn: z.string().openapi({ example: 'Standard Office Schedule' }),
  nameAm: z.string().nullable().openapi({ example: 'መደበኛ የስራ መርሃ ግብር' }),
  description: z.string().nullable().openapi({ example: 'Monday to Friday office coverage' }),
  isDefault: z.boolean().openapi({ example: true }),
  isActive: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const WorkScheduleDaySchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  workScheduleId: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  dayOfWeek: DayOfWeekSchema.openapi({ example: 'MONDAY' }),
  shiftId: z.string().uuid().nullable().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  isOffDay: z.boolean().openapi({ example: false }),
  isActive: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const EmployeeWorkScheduleSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  employeeId: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  workScheduleId: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  effectiveFrom: z.string().openapi({ example: '2026-06-09' }),
  effectiveTo: z.string().nullable().openapi({ example: null }),
  isActive: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const EmployeeSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  userId: z.string().nullable().openapi({ example: 'user_123' }),
  employeeCode: z.string().openapi({ example: 'EMP-001' }),
  payrollId: z.string().nullable().openapi({ example: 'PAY-001' }),
  biometricId: z.string().nullable().openapi({ example: 'BIO-001' }),
  firstNameEn: z.string().openapi({ example: 'Abebe' }),
  middleNameEn: z.string().nullable().openapi({ example: 'Kebede' }),
  lastNameEn: z.string().openapi({ example: 'Tadesse' }),
  firstNameAm: z.string().nullable().openapi({ example: 'አበበ' }),
  middleNameAm: z.string().nullable().openapi({ example: 'ከበደ' }),
  lastNameAm: z.string().nullable().openapi({ example: 'ታደሰ' }),
  gender: z.string().nullable().openapi({ example: 'MALE' }),
  phoneNumber: z.string().nullable().openapi({ example: '+251911000000' }),
  email: z.string().nullable().openapi({ example: 'abebe@example.com' }),
  departmentId: UuidSchema,
  positionId: z.string().nullable(),
  positionName: z.string().nullable().openapi({ example: 'Expert' }),
  employmentStatus: EmploymentStatusSchema,
  employmentType: EmploymentTypeSchema,
  hireDate: z.string().nullable().openapi({ example: '2026-01-01' }),
  terminationDate: z.string().nullable().openapi({ example: null }),
  sourceIdNo: z.string().nullable().openapi({ example: '00275012' }),
  sourceEmployeeCode: z.string().nullable().openapi({ example: 'K-1062' }),
  sourceEmploymentStatus: z.string().nullable().openapi({ example: 'Active' }),
  sourceDepartmentName: z.string().nullable().openapi({ example: 'Budget Division' }),
  sourcePositionName: z.string().nullable().openapi({ example: 'Expert' }),
  sourcePositionCode: z.string().nullable().openapi({ example: 'K-1062' }),
  salary: z.string().nullable().openapi({ example: '12000.00' }),
  salaryStep: z.string().nullable().openapi({ example: 'III' }),
  sourceImportedAt: z.string().nullable().openapi({ example: '2026-07-06T09:30:00.000Z' }),
  sourceRawPayload: z.record(z.any()).nullable().openapi({ example: { 'Employee Id No': '00275012' } }),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  department: DepartmentSchema.optional(),
  position: PositionSchema.nullable().optional(),
});

export const EmployeeSupervisorSchema = z.object({
  id: UuidSchema,
  employeeId: UuidSchema,
  supervisorId: UuidSchema,
  isPrimary: z.boolean(),
  effectiveFrom: z.string().openapi({ example: '2026-01-01' }),
  effectiveTo: z.string().nullable().openapi({ example: null }),
  createdAt: z.string(),
  supervisor: EmployeeSchema.optional(),
});

export const CreateBiometricExemptionRequestSchema = z.object({
  targetType: BiometricExemptionTargetTypeSchema,
  targetId: UuidSchema,
  reason: z.string().min(1),
  isActive: z.boolean().optional(),
  createdBy: z.string().min(1).nullable().optional(),
  updatedBy: z.string().min(1).nullable().optional(),
});

export const UpdateBiometricExemptionRequestSchema = CreateBiometricExemptionRequestSchema.partial();

export const BiometricExemptionSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  employeeId: z.string().uuid().nullable().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  positionId: z.string().uuid().nullable().openapi({ example: null }),
  targetType: BiometricExemptionTargetTypeSchema.openapi({ example: 'EMPLOYEE' }),
  reason: z.string().openapi({ example: 'Approved field assignment' }),
  isActive: z.boolean().openapi({ example: true }),
  createdBy: z.string().nullable().openapi({ example: 'user_123' }),
  updatedBy: z.string().nullable().openapi({ example: 'user_123' }),
  createdAt: z.string().openapi({ example: '2026-07-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-07-09T00:00:00.000Z' }),
  employee: EmployeeSchema.nullable().optional(),
  position: PositionSchema.nullable().optional(),
});

export const BiometricDeviceTypeSchema = z.enum(['BIOMETRIC', 'RFID', 'FACE_RECOGNITION', 'MOBILE', 'WEB']);
export const ConnectionTypeSchema = z.enum(['TCP_IP', 'USB', 'WIFI', 'API']);
export const DeviceIntegrationModeSchema = z.enum(['PUSH_ADMS', 'TCP_PULL', 'HYBRID', 'MANUAL_ONLY', 'DISABLED']);
export const DeviceHealthStatusSchema = z.enum(['ONLINE', 'OFFLINE', 'UNKNOWN', 'ERROR']);
export const SyncStatusSchema = z.enum(['STARTED', 'COMPLETED', 'FAILED', 'PARTIAL']);
export const PunchTypeSchema = z.enum(['IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN']);
export const PunchSourceSchema = z.enum(['DEVICE', 'MANUAL', 'IMPORT', 'MOBILE', 'WEB']);

export const BiometricDeviceSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  deviceName: z.string().openapi({ example: 'Head Office Gate 1' }),
  deviceCode: z.string().openapi({ example: 'DEV-001' }),
  ipAddress: z.string().nullable().openapi({ example: '192.168.1.20' }),
  port: z.number().int().nullable().openapi({ example: 4370 }),
  locationName: z.string().nullable().openapi({ example: 'Main Entrance' }),
  departmentId: z.string().uuid().nullable().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  deviceType: BiometricDeviceTypeSchema.openapi({ example: 'BIOMETRIC' }),
  connectionType: ConnectionTypeSchema.openapi({ example: 'TCP_IP' }),
  vendor: z.string().openapi({ example: 'ZKTECO' }),
  protocol: z.string().openapi({ example: 'TCP_IP' }),
  integrationMode: DeviceIntegrationModeSchema.openapi({ example: 'TCP_PULL' }),
  preferredMode: DeviceIntegrationModeSchema.openapi({ example: 'PUSH_ADMS' }),
  pushEnabled: z.boolean().openapi({ example: false }),
  pullEnabled: z.boolean().openapi({ example: true }),
  pushSecret: z.string().nullable().openapi({ example: null }),
  communicationKey: z.string().nullable().openapi({ example: null }),
  serialNumber: z.string().nullable().openapi({ example: 'SN-10001' }),
  model: z.string().nullable().openapi({ example: 'ZKTeco iFace 702' }),
  manufacturer: z.string().nullable().openapi({ example: 'ZKTeco' }),
  isActive: z.boolean().openapi({ example: true }),
  lastSyncAt: z.string().nullable().openapi({ example: null }),
  lastSuccessfulSyncAt: z.string().nullable().openapi({ example: null }),
  lastFailedSyncAt: z.string().nullable().openapi({ example: null }),
  lastPushAt: z.string().nullable().openapi({ example: null }),
  lastPullAt: z.string().nullable().openapi({ example: null }),
  lastSeenAt: z.string().nullable().openapi({ example: null }),
  lastErrorMessage: z.string().nullable().openapi({ example: null }),
  syncIntervalMinutes: z.number().int().openapi({ example: 5 }),
  autoSyncEnabled: z.boolean().openapi({ example: true }),
  healthStatus: DeviceHealthStatusSchema.openapi({ example: 'UNKNOWN' }),
  fallbackToPull: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  department: DepartmentSchema.nullable().optional(),
});

export const AttendanceSyncBatchSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  deviceId: z.string().uuid().nullable().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  syncStartedAt: z.string().openapi({ example: '2026-06-09T08:00:00.000Z' }),
  syncCompletedAt: z.string().nullable().openapi({ example: null }),
  syncStatus: SyncStatusSchema.openapi({ example: 'STARTED' }),
  totalRecords: z.number().int().openapi({ example: 0 }),
  successfulRecords: z.number().int().openapi({ example: 0 }),
  failedRecords: z.number().int().openapi({ example: 0 }),
  errorMessage: z.string().nullable().openapi({ example: null }),
  createdAt: z.string().openapi({ example: '2026-06-09T08:00:00.000Z' }),
  device: BiometricDeviceSchema.nullable().optional(),
});

export const AttendancePunchSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  employeeId: z.string().uuid().nullable().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  biometricId: z.string().openapi({ example: 'BIO-001' }),
  deviceId: z.string().uuid().nullable().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  syncBatchId: z.string().uuid().nullable().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  externalUid: z.string().nullable().openapi({ example: 'DEV-001:BIO-001:2026-06-09T08:15:00.000Z' }),
  punchTime: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  punchType: PunchTypeSchema.openapi({ example: 'IN' }),
  verificationType: z.string().nullable().openapi({ example: 'Fingerprint' }),
  devicePunchId: z.string().nullable().openapi({ example: '987654' }),
  source: PunchSourceSchema.openapi({ example: 'DEVICE' }),
  isProcessed: z.boolean().openapi({ example: false }),
  isManual: z.boolean().openapi({ example: false }),
  manualReason: z.string().nullable().openapi({ example: null }),
  approvedBy: z.string().nullable().openapi({ example: null }),
  approvedAt: z.string().nullable().openapi({ example: null }),
  processedAt: z.string().nullable().openapi({ example: null }),
  rawPayload: z.record(z.any()).nullable().openapi({ example: { userId: 'BIO-001' } }),
  createdAt: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  employee: EmployeeSchema.nullable().optional(),
  device: BiometricDeviceSchema.nullable().optional(),
  syncBatch: AttendanceSyncBatchSchema.nullable().optional(),
});

export const CreateDepartmentRequestSchema = z.object({
  nameEn: z.string().min(1).max(150),
  nameAm: z.string().max(150).nullable().optional(),
  code: OptionalCodeSchema,
  parentDepartmentId: UuidSchema.nullable().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateDepartmentRequestSchema = CreateDepartmentRequestSchema.partial();

export const CreatePositionRequestSchema = z.object({
  nameEn: z.string().min(1).max(150),
  nameAm: z.string().max(150).nullable().optional(),
  code: OptionalCodeSchema,
  isActive: z.boolean().optional(),
});

export const UpdatePositionRequestSchema = CreatePositionRequestSchema.partial();

export const CreateShiftRequestSchema = z.object({
  nameEn: z.string().min(1).max(100),
  nameAm: z.string().max(100).nullable().optional(),
  gracePeriodMinutes: z.number().int().nonnegative().optional(),
  lateAfterMinutes: z.number().int().nonnegative().optional(),
  earlyOutBeforeMinutes: z.number().int().nonnegative().optional(),
  isOvernight: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateShiftRequestSchema = CreateShiftRequestSchema.partial();

export const CreateShiftSegmentRequestSchema = z.object({
  shiftId: UuidSchema,
  nameEn: z.string().min(1).max(100),
  nameAm: z.string().max(100).nullable().optional(),
  startTime: TimeSchema,
  endTime: TimeSchema,
  sortOrder: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateShiftSegmentRequestSchema = CreateShiftSegmentRequestSchema.partial();

export const CreateShiftBreakRequestSchema = z.object({
  shiftId: UuidSchema,
  nameEn: z.string().min(1).max(100),
  nameAm: z.string().max(100).nullable().optional(),
  startTime: TimeSchema,
  endTime: TimeSchema,
  isPaid: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateShiftBreakRequestSchema = CreateShiftBreakRequestSchema.partial();

export const CreateWorkScheduleRequestSchema = z.object({
  nameEn: z.string().min(1).max(100),
  nameAm: z.string().max(100).nullable().optional(),
  description: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateWorkScheduleRequestSchema = CreateWorkScheduleRequestSchema.partial();

export const CreateWorkScheduleDayRequestSchema = z.object({
  dayOfWeek: DayOfWeekSchema,
  shiftId: UuidSchema.nullable().optional(),
  isOffDay: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateWorkScheduleDayRequestSchema = CreateWorkScheduleDayRequestSchema.extend({
  workScheduleId: UuidSchema.optional(),
}).partial();

export const CreateEmployeeWorkScheduleRequestSchema = z.object({
  employeeId: UuidSchema,
  workScheduleId: UuidSchema,
  effectiveFrom: RequiredDateSchema,
  effectiveTo: OptionalDateSchema,
  isActive: z.boolean().optional(),
});

export const UpdateEmployeeWorkScheduleRequestSchema = CreateEmployeeWorkScheduleRequestSchema.partial();

export const CreateEmployeeRequestSchema = z.object({
  userId: z.string().nullable().optional(),
  employeeCode: z.string().min(1).max(50),
  payrollId: z.string().max(50).nullable().optional(),
  biometricId: z.string().max(50).nullable().optional(),
  firstNameEn: z.string().min(1).max(100),
  middleNameEn: z.string().max(100).nullable().optional(),
  lastNameEn: z.string().min(1).max(100),
  firstNameAm: z.string().max(100).nullable().optional(),
  middleNameAm: z.string().max(100).nullable().optional(),
  lastNameAm: z.string().max(100).nullable().optional(),
  gender: z.string().max(20).nullable().optional(),
  phoneNumber: z.string().max(50).nullable().optional(),
  email: z.string().email().max(150).nullable().optional(),
  departmentId: UuidSchema,
  positionId: UuidSchema.nullable().optional(),
  positionName: z.string().max(200).nullable().optional(),
  employmentStatus: EmploymentStatusSchema.optional(),
  employmentType: EmploymentTypeSchema.optional(),
  hireDate: OptionalDateSchema,
  terminationDate: OptionalDateSchema,
  sourceIdNo: z.string().max(50).nullable().optional(),
  sourceEmployeeCode: z.string().max(50).nullable().optional(),
  sourceEmploymentStatus: z.string().max(100).nullable().optional(),
  sourceDepartmentName: z.string().max(200).nullable().optional(),
  sourcePositionName: z.string().max(200).nullable().optional(),
  sourcePositionCode: z.string().max(50).nullable().optional(),
  salary: z.union([z.string(), z.number()]).nullable().optional(),
  salaryStep: z.string().max(50).nullable().optional(),
  sourceImportedAt: z.string().datetime().nullable().optional(),
  sourceRawPayload: z.record(z.any()).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateEmployeeRequestSchema = CreateEmployeeRequestSchema.partial();

export const CreateEmployeeSupervisorRequestSchema = z.object({
  supervisorId: UuidSchema,
  isPrimary: z.boolean().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: OptionalDateSchema,
});

export const CreateBiometricDeviceRequestSchema = z.object({
  deviceName: z.string().min(1).max(150),
  deviceCode: z.string().min(1).max(100),
  ipAddress: z.string().max(100).nullable().optional(),
  port: z.number().int().positive().nullable().optional(),
  locationName: z.string().max(150).nullable().optional(),
  departmentId: UuidSchema.nullable().optional(),
  deviceType: BiometricDeviceTypeSchema.optional(),
  connectionType: ConnectionTypeSchema.optional(),
  vendor: z.string().max(50).optional(),
  protocol: z.string().max(50).optional(),
  integrationMode: DeviceIntegrationModeSchema.optional(),
  preferredMode: DeviceIntegrationModeSchema.optional(),
  pushEnabled: z.boolean().optional(),
  pullEnabled: z.boolean().optional(),
  pushSecret: z.string().max(200).nullable().optional(),
  communicationKey: z.string().max(100).nullable().optional(),
  serialNumber: z.string().max(150).nullable().optional(),
  model: z.string().max(150).nullable().optional(),
  manufacturer: z.string().max(150).nullable().optional(),
  syncIntervalMinutes: z.number().int().positive().optional(),
  autoSyncEnabled: z.boolean().optional(),
  healthStatus: DeviceHealthStatusSchema.optional(),
  fallbackToPull: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateBiometricDeviceRequestSchema = CreateBiometricDeviceRequestSchema.partial();

export const CreateBiometricDeviceSyncRequestSchema = z.object({
  syncStatus: SyncStatusSchema.optional(),
  totalRecords: z.number().int().nonnegative().optional(),
  successfulRecords: z.number().int().nonnegative().optional(),
  failedRecords: z.number().int().nonnegative().optional(),
  errorMessage: z.string().nullable().optional(),
  syncCompletedAt: z.string().datetime().nullable().optional(),
});

export const CreateAttendancePunchRequestSchema = z.object({
  employeeId: UuidSchema.nullable().optional(),
  biometricId: z.string().min(1).max(100),
  deviceId: UuidSchema.nullable().optional(),
  syncBatchId: UuidSchema.nullable().optional(),
  externalUid: z.string().max(200).nullable().optional(),
  punchTime: z.string().datetime(),
  punchType: PunchTypeSchema.optional(),
  verificationType: z.string().max(50).nullable().optional(),
  devicePunchId: z.string().max(150).nullable().optional(),
  source: PunchSourceSchema.optional(),
  isProcessed: z.boolean().optional(),
  isManual: z.boolean().optional(),
  manualReason: z.string().nullable().optional(),
  approvedBy: z.string().nullable().optional(),
  approvedAt: z.string().datetime().nullable().optional(),
  processedAt: z.string().datetime().nullable().optional(),
  rawPayload: z.record(z.any()).nullable().optional(),
});

export const UpdateAttendancePunchRequestSchema = CreateAttendancePunchRequestSchema.partial();

export const ManualPunchRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const ManualPunchRequestSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  employeeId: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  requestedPunchTime: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  requestedPunchType: PunchTypeSchema.openapi({ example: 'IN' }),
  reason: z.string().openapi({ example: 'Missed punch due to device outage' }),
  status: ManualPunchRequestStatusSchema.openapi({ example: 'PENDING' }),
  requestedBy: z.string().openapi({ example: 'user_123' }),
  approvedBy: z.string().nullable().openapi({ example: null }),
  approvedAt: z.string().nullable().openapi({ example: null }),
  rejectedBy: z.string().nullable().openapi({ example: null }),
  rejectedAt: z.string().nullable().openapi({ example: null }),
  rejectionReason: z.string().nullable().openapi({ example: null }),
  createdAt: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  employee: EmployeeSchema.nullable().optional(),
});

export const CreateManualPunchRequestRequestSchema = z.object({
  employeeId: UuidSchema,
  requestedPunchTime: z.string().datetime(),
  requestedPunchType: PunchTypeSchema,
  reason: z.string().min(1),
  requestedBy: z.string().min(1).optional(),
});

export const ChangeManualPunchRequestStatusRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  approvedBy: z.string().min(1).optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedBy: z.string().min(1).optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().nullable().optional(),
});

export const LeaveRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export const LeaveBalanceTransactionTypeSchema = z.enum(['INITIAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'DEDUCTION', 'REVERSAL', 'ADJUSTMENT']);

export const LeaveFiscalYearSchema = z.object({
  id: UuidSchema,
  name: z.string(),
  startsAt: z.string().openapi({ example: '2026-07-08' }),
  endsAt: z.string().openapi({ example: '2027-07-07' }),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const LeaveTypeSchema = z.object({
  id: UuidSchema,
  code: z.string().openapi({ example: 'ANNUAL' }),
  nameEn: z.string().openapi({ example: 'Annual Leave' }),
  nameAm: z.string().nullable().openapi({ example: 'ዓመታዊ ፈቃድ' }),
  description: z.string().nullable(),
  deductsAnnualBalance: z.boolean(),
  requiresBalance: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const LeaveBalanceSchema = z.object({
  id: UuidSchema,
  employeeId: UuidSchema,
  fiscalYearId: UuidSchema,
  employmentTypeSnapshot: EmploymentTypeSchema,
  opening: z.string().openapi({ example: '20.00' }),
  transferredIn: z.string().openapi({ example: '0.00' }),
  used: z.string().openapi({ example: '5.00' }),
  available: z.string().openapi({ example: '15.00' }),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  employee: EmployeeSchema.nullable().optional(),
  fiscalYear: LeaveFiscalYearSchema.nullable().optional(),
});

export const LeaveBalanceTransactionSchema = z.object({
  id: UuidSchema,
  leaveBalanceId: UuidSchema,
  employeeId: UuidSchema,
  fiscalYearId: UuidSchema,
  leaveRequestId: z.string().uuid().nullable(),
  linkedTransactionId: z.string().uuid().nullable(),
  type: LeaveBalanceTransactionTypeSchema,
  days: z.string().openapi({ example: '2.00' }),
  note: z.string().nullable(),
  createdBy: z.string().nullable(),
  createdAt: z.string(),
});

export const LeaveRequestSchema = z.object({
  id: UuidSchema,
  employeeId: UuidSchema,
  leaveTypeId: UuidSchema,
  fiscalYearId: z.string().uuid().nullable(),
  startDate: z.string().openapi({ example: '2026-08-01' }),
  endDate: z.string().openapi({ example: '2026-08-05' }),
  requestedDays: z.string().openapi({ example: '5.00' }),
  reason: z.string(),
  status: LeaveRequestStatusSchema,
  requestedBy: z.string(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectedBy: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  employee: EmployeeSchema.nullable().optional(),
  leaveType: LeaveTypeSchema.nullable().optional(),
  fiscalYear: LeaveFiscalYearSchema.nullable().optional(),
});

export const CreateLeaveFiscalYearRequestSchema = z.object({
  name: z.string().min(1).max(100),
  startsAt: RequiredDateSchema,
  endsAt: RequiredDateSchema,
  isActive: z.boolean().optional(),
});

export const UpdateLeaveFiscalYearRequestSchema = CreateLeaveFiscalYearRequestSchema.partial();

export const CreateLeaveTypeRequestSchema = z.object({
  code: z.string().min(1).max(50),
  nameEn: z.string().min(1).max(150),
  nameAm: z.string().max(150).nullable().optional(),
  description: z.string().nullable().optional(),
  deductsAnnualBalance: z.boolean().optional(),
  requiresBalance: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateLeaveTypeRequestSchema = CreateLeaveTypeRequestSchema.partial();

export const UpsertLeaveBalanceRequestSchema = z.object({
  employeeId: UuidSchema,
  fiscalYearId: UuidSchema,
  opening: z.union([z.string(), z.number()]),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
});

export const BulkUpsertLeaveBalancesRequestSchema = z.object({
  fiscalYearId: UuidSchema,
  balances: z.array(z.object({
    employeeId: UuidSchema,
    opening: z.union([z.string(), z.number()]),
  })).min(1),
  createdBy: z.string().nullable().optional(),
  updatedBy: z.string().nullable().optional(),
});

export const TransferLeaveBalanceRequestSchema = z.object({
  employeeId: UuidSchema,
  fromFiscalYearId: UuidSchema,
  toFiscalYearId: UuidSchema,
  days: z.union([z.string(), z.number()]),
  approvedBy: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export const CreateLeaveRequestRequestSchema = z.object({
  employeeId: UuidSchema,
  leaveTypeId: UuidSchema,
  fiscalYearId: UuidSchema.nullable().optional(),
  startDate: RequiredDateSchema,
  endDate: RequiredDateSchema,
  reason: z.string().min(1),
  requestedBy: z.string().min(1).nullable().optional(),
});

export const ChangeLeaveRequestStatusRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  approvedBy: z.string().min(1).optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedBy: z.string().min(1).optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().nullable().optional(),
});

export const DepartmentsResponseSchema = z.object({
  success: z.boolean(),
  departments: z.array(DepartmentSchema),
});

export const DepartmentResponseSchema = z.object({
  success: z.boolean(),
  department: DepartmentSchema,
});

export const PositionsResponseSchema = z.object({
  success: z.boolean(),
  positions: z.array(PositionSchema),
});

export const PositionResponseSchema = z.object({
  success: z.boolean(),
  position: PositionSchema,
});

export const ShiftsResponseSchema = z.object({
  success: z.boolean(),
  shifts: z.array(ShiftSchema),
});

export const ShiftResponseSchema = z.object({
  success: z.boolean(),
  shift: ShiftSchema,
});

export const ShiftSegmentsResponseSchema = z.object({
  success: z.boolean(),
  shiftSegments: z.array(ShiftSegmentSchema),
});

export const ShiftSegmentResponseSchema = z.object({
  success: z.boolean(),
  shiftSegment: ShiftSegmentSchema,
});

export const ShiftBreaksResponseSchema = z.object({
  success: z.boolean(),
  shiftBreaks: z.array(ShiftBreakSchema),
});

export const ShiftBreakResponseSchema = z.object({
  success: z.boolean(),
  shiftBreak: ShiftBreakSchema,
});

export const WorkSchedulesResponseSchema = z.object({
  success: z.boolean(),
  workSchedules: z.array(WorkScheduleSchema),
});

export const WorkScheduleResponseSchema = z.object({
  success: z.boolean(),
  workSchedule: WorkScheduleSchema,
});

export const WorkScheduleDaysResponseSchema = z.object({
  success: z.boolean(),
  days: z.array(WorkScheduleDaySchema),
});

export const WorkScheduleDayResponseSchema = z.object({
  success: z.boolean(),
  day: WorkScheduleDaySchema,
});

export const EmployeeWorkSchedulesResponseSchema = z.object({
  success: z.boolean(),
  employeeWorkSchedules: z.array(EmployeeWorkScheduleSchema),
});

export const EmployeeWorkScheduleResponseSchema = z.object({
  success: z.boolean(),
  employeeWorkSchedule: EmployeeWorkScheduleSchema,
});

export const EmployeesResponseSchema = z.object({
  success: z.boolean(),
  employees: z.array(EmployeeSchema),
});

export const EmployeesPaginatedResponseSchema = z.object({
  success: z.boolean(),
  employees: z.array(EmployeeSchema),
  pagination: z.object({
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  }),
});

export const EmployeeResponseSchema = z.object({
  success: z.boolean(),
  employee: EmployeeSchema,
});

export const PermanentEmployeeImportRowErrorSchema = z.object({
  rowNumber: z.number().int().positive(),
  employeeCode: z.string().nullable(),
  errors: z.array(z.string()),
});

export const PermanentEmployeeImportResponseSchema = z.object({
  success: z.boolean(),
  created: z.number().int().nonnegative(),
  updated: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
  totalRows: z.number().int().nonnegative(),
  errors: z.array(PermanentEmployeeImportRowErrorSchema),
  employees: z.array(EmployeeSchema),
});

export const EmployeeSupervisorsResponseSchema = z.object({
  success: z.boolean(),
  supervisors: z.array(EmployeeSupervisorSchema),
});

export const EmployeeSupervisorResponseSchema = z.object({
  success: z.boolean(),
  supervisor: EmployeeSupervisorSchema,
});

export const BiometricDevicesResponseSchema = z.object({
  success: z.boolean(),
  biometricDevices: z.array(BiometricDeviceSchema),
});

export const BiometricDeviceResponseSchema = z.object({
  success: z.boolean(),
  biometricDevice: BiometricDeviceSchema,
});

export const BiometricDeviceConnectionTestSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: 'Connection successful' }),
  testedAt: z.string().openapi({ example: '2026-06-19T08:15:00.000Z' }),
  latencyMs: z.number().int().nonnegative().openapi({ example: 124 }),
});

export const BiometricDeviceConnectionTestResponseSchema = z.object({
  success: z.boolean(),
  connectionTest: BiometricDeviceConnectionTestSchema,
  biometricDevice: BiometricDeviceSchema,
});

export const AttendanceSyncBatchesResponseSchema = z.object({
  success: z.boolean(),
  attendanceSyncBatches: z.array(AttendanceSyncBatchSchema),
});

export const AttendanceSyncBatchResponseSchema = z.object({
  success: z.boolean(),
  attendanceSyncBatch: AttendanceSyncBatchSchema,
});

export const AttendancePunchesResponseSchema = z.object({
  success: z.boolean(),
  attendancePunches: z.array(AttendancePunchSchema),
});

export const AttendancePunchResponseSchema = z.object({
  success: z.boolean(),
  attendancePunch: AttendancePunchSchema,
});

export const ManualPunchRequestResponseSchema = z.object({
  success: z.boolean(),
  manualPunchRequest: ManualPunchRequestSchema,
});

export const ManualPunchRequestsResponseSchema = z.object({
  success: z.boolean(),
  manualPunchRequests: z.array(ManualPunchRequestSchema),
});

export const ManualPunchRequestActionResponseSchema = z.object({
  success: z.boolean(),
  manualPunchRequest: ManualPunchRequestSchema,
  attendancePunch: AttendancePunchSchema.nullable(),
});

export const BiometricExemptionsResponseSchema = z.object({
  success: z.boolean(),
  biometricExemptions: z.array(BiometricExemptionSchema),
});

export const BiometricExemptionResponseSchema = z.object({
  success: z.boolean(),
  biometricExemption: BiometricExemptionSchema,
});

export const LeaveFiscalYearsResponseSchema = z.object({
  success: z.boolean(),
  leaveFiscalYears: z.array(LeaveFiscalYearSchema),
});

export const LeaveFiscalYearResponseSchema = z.object({
  success: z.boolean(),
  leaveFiscalYear: LeaveFiscalYearSchema,
});

export const LeaveTypesResponseSchema = z.object({
  success: z.boolean(),
  leaveTypes: z.array(LeaveTypeSchema),
});

export const LeaveTypeResponseSchema = z.object({
  success: z.boolean(),
  leaveType: LeaveTypeSchema,
});

export const LeaveBalancesResponseSchema = z.object({
  success: z.boolean(),
  leaveBalances: z.array(LeaveBalanceSchema),
});

export const LeaveBalanceResponseSchema = z.object({
  success: z.boolean(),
  leaveBalance: LeaveBalanceSchema,
});

export const LeaveBalanceTransferResponseSchema = z.object({
  success: z.boolean(),
  fromBalance: LeaveBalanceSchema,
  toBalance: LeaveBalanceSchema,
  transactions: z.array(LeaveBalanceTransactionSchema),
});

export const LeaveRequestsResponseSchema = z.object({
  success: z.boolean(),
  leaveRequests: z.array(LeaveRequestSchema),
});

export const LeaveRequestResponseSchema = z.object({
  success: z.boolean(),
  leaveRequest: LeaveRequestSchema,
});

export const TimeOperationSeveritySchema = z.enum(['critical', 'warning', 'info', 'success']);
export const TimeOperationStatusSchema = z.enum(['CLEAR', 'WATCH', 'ACTION_REQUIRED']);
export const TimeOperationTypeSchema = z.enum([
  'MANUAL_PUNCH_APPROVAL',
  'LEAVE_REQUEST_APPROVAL',
  'UNPROCESSED_PUNCHES',
  'DEVICE_HEALTH',
  'SYNC_FAILURE',
  'DEVICE_SETUP',
  'ALL_CLEAR',
]);

export const TimeOperationItemSchema = z.object({
  id: z.string().openapi({ example: 'manual-punch-approvals' }),
  type: TimeOperationTypeSchema.openapi({ example: 'MANUAL_PUNCH_APPROVAL' }),
  severity: TimeOperationSeveritySchema.openapi({ example: 'warning' }),
  title: z.string().openapi({ example: '3 manual punch requests pending' }),
  description: z.string().openapi({ example: 'Oldest request needs approval or rejection.' }),
  count: z.number().int().nonnegative().openapi({ example: 3 }),
  actionLabel: z.string().openapi({ example: 'Review requests' }),
  actionHref: z.string().openapi({ example: '/manual-punch-requests' }),
  occurredAt: z.string().nullable().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  metadata: z.record(z.any()).optional(),
});

export const TimeOperationsSummarySchema = z.object({
  generatedAt: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  status: TimeOperationStatusSchema.openapi({ example: 'ACTION_REQUIRED' }),
  headline: z.string().openapi({ example: '7 time operation items need attention' }),
  counts: z.object({
    pendingManualPunchRequests: z.number().int().nonnegative(),
    pendingLeaveRequests: z.number().int().nonnegative(),
    unprocessedAttendancePunches: z.number().int().nonnegative(),
    criticalDeviceIssues: z.number().int().nonnegative(),
    unknownDevices: z.number().int().nonnegative(),
    syncFailures: z.number().int().nonnegative(),
    deviceSetupNeeded: z.number().int().nonnegative(),
    totalOpenItems: z.number().int().nonnegative(),
  }),
  items: z.array(TimeOperationItemSchema),
});

export const TimeOperationsSummaryResponseSchema = z.object({
  success: z.boolean(),
  timeOperations: TimeOperationsSummarySchema,
});

export const DashboardRoleSchema = z.enum(['SUPER_ADMIN', 'MANAGER', 'EMPLOYEE', 'SETUP_REQUIRED']);

export const DashboardMetricSchema = z.object({
  id: z.string().openapi({ example: 'total-employees' }),
  label: z.string().openapi({ example: 'Total employees' }),
  value: z.union([z.string(), z.number()]).openapi({ example: 128 }),
  description: z.string().openapi({ example: 'People registered in the organization' }),
  href: z.string().optional().openapi({ example: '/employees' }),
});

export const DashboardQuickActionSchema = z.object({
  label: z.string().openapi({ example: 'Manual punch requests' }),
  description: z.string().openapi({ example: 'Approve or reject employee correction requests.' }),
  href: z.string().openapi({ example: '/manual-punch-requests' }),
});

export const DashboardPlaceholderSchema = z.object({
  id: z.string().openapi({ example: 'attendance-insights' }),
  title: z.string().openapi({ example: 'Attendance insights preview' }),
  description: z.string().openapi({ example: 'Attendance calculations will appear here soon.' }),
  isPreview: z.boolean().openapi({ example: true }),
});

export const DashboardSummarySchema = z.object({
  generatedAt: z.string().nullable().openapi({ example: '2026-06-19T08:15:00.000Z' }),
  role: DashboardRoleSchema.openapi({ example: 'MANAGER' }),
  setupRequired: z.boolean().openapi({ example: false }),
  user: z.object({
    id: z.string().openapi({ example: 'user_123' }),
    name: z.string().nullable().openapi({ example: 'Abebe Kebede' }),
    email: z.string().nullable().openapi({ example: 'abebe@example.com' }),
    roles: z.array(z.string()).openapi({ example: ['manager'] }),
  }),
  employee: EmployeeSchema.nullable(),
  currentAnnualLeaveBalance: LeaveBalanceSchema.nullable(),
  metrics: z.array(DashboardMetricSchema),
  quickActions: z.array(DashboardQuickActionSchema),
  sections: z.record(z.any()),
  placeholders: z.array(DashboardPlaceholderSchema),
});

export const DashboardSummaryResponseSchema = z.object({
  success: z.boolean(),
  dashboard: DashboardSummarySchema,
});

export const ExecutiveDashboardSummarySchema = z.object({
  generatedAt: z.string().nullable(),
  date: z.string(),
  month: z.string(),
  workforceStatus: z.object({
    totalEmployees: z.number().int().nonnegative(),
    presentToday: z.number().int().nonnegative(),
    absentToday: z.number().int().nonnegative(),
    onApprovedLeave: z.number().int().nonnegative(),
    lateArrivals: z.number().int().nonnegative(),
    workingRemotely: z.number().int().nonnegative(),
    officialAssignment: z.number().int().nonnegative(),
    attendanceRate: z.number().nonnegative(),
  }),
  workforceDistribution: z.array(z.object({
    id: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
    percentage: z.number().nonnegative(),
  })),
  departmentAttendanceRanking: z.array(z.object({
    department: z.string(),
    attendanceRate: z.number().nonnegative(),
    present: z.number().int().nonnegative(),
    totalEmployees: z.number().int().nonnegative(),
  })),
  compoundStatus: z.object({
    currentlyInside: z.number().int().nonnegative(),
    checkedOut: z.number().int().nonnegative(),
    notYetArrived: z.number().int().nonnegative(),
  }),
  liveAttendanceTimeline: z.array(z.object({
    time: z.string(),
    count: z.number().int().nonnegative(),
  })),
  leaveSummary: z.array(z.object({
    id: z.string(),
    label: z.string(),
    count: z.number().int().nonnegative(),
  })),
  hrPerformance: z.object({
    pendingHrApproval: z.number().int().nonnegative(),
    pendingLeaveApproval: z.number().int().nonnegative(),
    averageApprovalTimeHours: z.number().nonnegative(),
    correctionsReturned: z.number().int().nonnegative(),
    payrollReadyPercent: z.number().nonnegative(),
  }),
  departmentPerformance: z.array(z.object({
    departmentId: z.string().uuid().nullable(),
    department: z.string(),
    totalEmployees: z.number().int().nonnegative(),
    present: z.number().int().nonnegative(),
    absent: z.number().int().nonnegative(),
    lateEmployees: z.number().int().nonnegative(),
    pendingApprovals: z.number().int().nonnegative(),
    leaveRate: z.number().nonnegative(),
    attendanceRate: z.number().nonnegative(),
    trend: z.enum(['UP', 'DOWN']),
  })),
  monthlyAttendanceTrend: z.array(z.object({
    month: z.string(),
    present: z.number().int().nonnegative(),
    attendanceRate: z.number().nonnegative(),
  })),
  attendanceExceptions: z.array(z.object({
    id: z.string(),
    severity: z.enum(['critical', 'warning', 'info']),
    title: z.string(),
    count: z.number().int().nonnegative(),
    description: z.string(),
  })),
  deviceHealth: z.object({
    total: z.number().int().nonnegative(),
    online: z.number().int().nonnegative(),
    offline: z.number().int().nonnegative(),
    error: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
  }),
  executiveAlerts: z.array(z.object({
    id: z.string(),
    severity: z.enum(['critical', 'warning', 'info']),
    title: z.string(),
    description: z.string(),
  })),
});

export const ExecutiveDashboardSummaryResponseSchema = z.object({
  success: z.boolean(),
  executiveDashboard: ExecutiveDashboardSummarySchema,
});

export const HrDashboardWidgetSchema = z.object({
  id: z.string().openapi({ example: 'pending-approvals' }),
  label: z.string().openapi({ example: 'Pending Approvals' }),
  count: z.number().int().nonnegative().openapi({ example: 12 }),
  href: z.string().openapi({ example: '/leave-request-approvals' }),
});

export const HrDashboardSummarySchema = z.object({
  generatedAt: z.string().nullable(),
  date: z.string().openapi({ example: '2026-07-10' }),
  currentAnnualLeaveBalance: LeaveBalanceSchema.nullable(),
  widgets: z.object({
    pendingApprovals: HrDashboardWidgetSchema,
    correctionsReturned: HrDashboardWidgetSchema,
    manualAttendanceRequests: HrDashboardWidgetSchema,
    employeesOnLeave: HrDashboardWidgetSchema,
    employeesWithoutPunch: HrDashboardWidgetSchema,
    missingCheckout: HrDashboardWidgetSchema,
    lateEmployees: HrDashboardWidgetSchema,
    attendanceExceptions: HrDashboardWidgetSchema,
    upcomingLeave: HrDashboardWidgetSchema,
    employeesNearLeaveExpiry: HrDashboardWidgetSchema,
    devicesOffline: HrDashboardWidgetSchema,
    synchronizationStatus: HrDashboardWidgetSchema,
  }),
  details: z.object({
    pendingManualRequests: z.array(ManualPunchRequestSchema),
    pendingLeaveRequests: z.array(LeaveRequestSchema),
    returnedCorrections: z.array(ManualPunchRequestSchema),
    employeesOnLeave: z.array(LeaveRequestSchema),
    employeesWithoutPunch: z.array(EmployeeSchema),
    missingCheckoutEmployees: z.array(EmployeeSchema),
    lateEmployees: z.array(EmployeeSchema),
    attendanceExceptions: z.array(z.object({
      id: z.string(),
      severity: z.enum(['critical', 'warning', 'info']),
      title: z.string(),
      count: z.number().int().nonnegative(),
      description: z.string(),
    })),
    upcomingLeave: z.array(LeaveRequestSchema),
    employeesNearLeaveExpiry: z.array(LeaveBalanceSchema),
    devicesOffline: z.array(BiometricDeviceSchema),
    synchronizationStatus: z.object({
      latest: AttendanceSyncBatchSchema.nullable(),
      recent: z.array(AttendanceSyncBatchSchema),
      counts: z.object({
        started: z.number().int().nonnegative(),
        completed: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
        partial: z.number().int().nonnegative(),
      }),
      openIssues: z.number().int().nonnegative(),
    }),
    unprocessedPunches: z.array(AttendancePunchSchema),
  }),
});

export const HrDashboardSummaryResponseSchema = z.object({
  success: z.boolean(),
  hrDashboard: HrDashboardSummarySchema,
});

export const DepartmentHeadDashboardWidgetSchema = z.object({
  id: z.string().openapi({ example: 'todays-staff' }),
  label: z.string().openapi({ example: "Today's Staff" }),
  count: z.number().int().nonnegative().openapi({ example: 24 }),
  href: z.string().openapi({ example: '/attendance-punches' }),
});

export const DepartmentHeadDashboardSummarySchema = z.object({
  generatedAt: z.string().nullable(),
  date: z.string().openapi({ example: '2026-07-10' }),
  department: DepartmentSchema.nullable(),
  supervisor: EmployeeSchema,
  currentAnnualLeaveBalance: LeaveBalanceSchema.nullable(),
  widgets: z.object({
    todaysStaff: DepartmentHeadDashboardWidgetSchema,
    present: DepartmentHeadDashboardWidgetSchema,
    absent: DepartmentHeadDashboardWidgetSchema,
    leave: DepartmentHeadDashboardWidgetSchema,
    late: DepartmentHeadDashboardWidgetSchema,
    pendingAttendance: DepartmentHeadDashboardWidgetSchema,
    pendingLeave: DepartmentHeadDashboardWidgetSchema,
    pendingCorrections: DepartmentHeadDashboardWidgetSchema,
  }),
  details: z.object({
    todaysStaff: z.array(EmployeeSchema),
    presentEmployees: z.array(EmployeeSchema),
    absentEmployees: z.array(EmployeeSchema),
    employeesOnLeave: z.array(LeaveRequestSchema),
    lateEmployees: z.array(EmployeeSchema),
    pendingAttendance: z.array(AttendancePunchSchema),
    pendingLeave: z.array(LeaveRequestSchema),
    pendingCorrections: z.array(ManualPunchRequestSchema),
  }),
});

export const DepartmentHeadDashboardSummaryResponseSchema = z.object({
  success: z.boolean(),
  departmentHeadDashboard: DepartmentHeadDashboardSummarySchema,
});
