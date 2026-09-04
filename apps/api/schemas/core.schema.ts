import { z } from 'zod';

const UuidSchema = z.string().uuid();
const OptionalCodeSchema = z.string().min(1).max(50).nullable().optional();
const OptionalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .optional();
const RequiredDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const TimeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/);
export const DayOfWeekSchema = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']);

export const EmploymentStatusSchema = z.enum(['ACTIVE', 'INACTIVE', 'TERMINATED', 'SUSPENDED']);
export const EmploymentTypeSchema = z.enum(['PERMANENT', 'CONTRACT', 'TEMPORARY', 'DAILY']);
export const BiometricExemptionTargetTypeSchema = z.enum(['EMPLOYEE', 'POSITION']);
export const BiometricExemptionStatusSchema = z.enum(['PENDING_SUPERVISOR', 'APPROVED', 'REJECTED', 'INACTIVE']);
export const HolidayTypeSchema = z.enum(['PUBLIC_HOLIDAY', 'INSTITUTION_OFF_DAY']);
export const NotificationChannelSchema = z.enum(['EMAIL', 'SMS']);
export const NotificationStatusSchema = z.enum(['PENDING', 'SENT', 'FAILED', 'SKIPPED']);

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
  shiftId: UuidSchema.openapi({
    example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f',
  }),
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
  shiftId: UuidSchema.openapi({
    example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f',
  }),
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
  workScheduleId: UuidSchema.openapi({
    example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f',
  }),
  dayOfWeek: DayOfWeekSchema.openapi({ example: 'MONDAY' }),
  shiftId: z.string().uuid().nullable().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  isOffDay: z.boolean().openapi({ example: false }),
  isActive: z.boolean().openapi({ example: true }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const HolidaySchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  nameEn: z.string().openapi({ example: 'Meskel' }),
  nameAm: z.string().nullable().openapi({ example: 'መስቀል' }),
  type: HolidayTypeSchema.openapi({ example: 'PUBLIC_HOLIDAY' }),
  durationDays: z.string().openapi({ example: '1.00' }),
  startDate: z.string().openapi({ example: '2026-09-27' }),
  endDate: z.string().openapi({ example: '2026-09-27' }),
  description: z.string().nullable().openapi({ example: 'Public holiday' }),
  isActive: z.boolean().openapi({ example: true }),
  createdBy: z.string().nullable().openapi({ example: 'user_123' }),
  updatedBy: z.string().nullable().openapi({ example: 'user_123' }),
  createdAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T00:00:00.000Z' }),
});

export const NotificationLogSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  eventType: z.string().openapi({ example: 'LEAVE_REQUEST_APPROVED' }),
  channel: NotificationChannelSchema.openapi({ example: 'EMAIL' }),
  status: NotificationStatusSchema.openapi({ example: 'SENT' }),
  recipientUserId: z.string().nullable().openapi({ example: 'user_123' }),
  recipientEmployeeId: z.string().uuid().nullable().openapi({ example: null }),
  recipientName: z.string().nullable().openapi({ example: 'Abebe Tadesse' }),
  destination: z.string().nullable().openapi({ example: 'abebe@example.com' }),
  subject: z.string().nullable().openapi({ example: 'Leave request approved' }),
  message: z.string().openapi({ example: 'Your leave request has been approved.' }),
  locale: z.string().openapi({ example: 'en' }),
  relatedEntityType: z.string().nullable().openapi({ example: 'leave_request' }),
  relatedEntityId: z.string().uuid().nullable().openapi({ example: null }),
  metadata: z.record(z.any()).nullable().openapi({ example: null }),
  attempts: z.number().int().openapi({ example: 1 }),
  lastAttemptAt: z.string().nullable().openapi({ example: '2026-07-09T00:00:00.000Z' }),
  nextAttemptAt: z.string().nullable().openapi({ example: null }),
  providerMessageId: z.string().nullable().openapi({ example: null }),
  providerResponse: z
    .record(z.any())
    .nullable()
    .openapi({ example: { status: 202 } }),
  errorMessage: z.string().nullable().openapi({ example: null }),
  sentAt: z.string().nullable().openapi({ example: '2026-07-09T00:00:00.000Z' }),
  createdAt: z.string().openapi({ example: '2026-07-09T00:00:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-07-09T00:00:00.000Z' }),
  recipientEmployee: z.any().nullable().optional(),
  recipientUser: z
    .object({
      id: z.string(),
      name: z.string(),
      email: z.string(),
    })
    .nullable()
    .optional(),
});

export const EmployeeWorkScheduleSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  employeeId: UuidSchema.openapi({
    example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f',
  }),
  workScheduleId: UuidSchema.openapi({
    example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f',
  }),
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
  sourceRawPayload: z
    .record(z.any())
    .nullable()
    .openapi({ example: { 'Employee Id No': '00275012' } }),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  department: DepartmentSchema.optional(),
  position: PositionSchema.nullable().optional(),
});

export const TemporaryDepartmentAssignmentSchema = z.object({
  id: UuidSchema,
  employeeId: UuidSchema,
  sourceDepartmentId: UuidSchema,
  targetDepartmentId: UuidSchema,
  effectiveFrom: z.string().openapi({ example: '2026-08-01' }),
  effectiveTo: z.string().openapi({ example: '2026-08-31' }),
  reason: z.string().openapi({
    example: 'Temporary support for month-end attendance operations',
  }),
  isActive: z.boolean().openapi({ example: true }),
  createdBy: z.string().openapi({ example: 'user_123' }),
  createdAt: z.string(),
  updatedAt: z.string(),
  employee: EmployeeSchema.nullable().optional(),
  sourceDepartment: DepartmentSchema.nullable().optional(),
  targetDepartment: DepartmentSchema.nullable().optional(),
  creator: z.any().nullable().optional(),
});

export const CreateTemporaryDepartmentAssignmentRequestSchema = z.object({
  employeeId: UuidSchema,
  targetDepartmentId: UuidSchema,
  effectiveFrom: RequiredDateSchema,
  effectiveTo: RequiredDateSchema,
  reason: z.string().min(1),
});

export const UpdateTemporaryDepartmentAssignmentRequestSchema = CreateTemporaryDepartmentAssignmentRequestSchema.omit({
  employeeId: true,
}).partial();

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

export const SupervisorDelegationSchema = z.object({
  id: UuidSchema,
  supervisorUserId: z.string(),
  supervisorEmployeeId: UuidSchema,
  delegateUserId: z.string(),
  delegateEmployeeId: UuidSchema,
  startsAt: z.string(),
  endsAt: z.string(),
  revokedAt: z.string().nullable(),
  revokedBy: z.string().nullable(),
  createdBy: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  supervisorUser: z.any().nullable().optional(),
  supervisorEmployee: EmployeeSchema.nullable().optional(),
  delegateUser: z.any().nullable().optional(),
  delegateEmployee: EmployeeSchema.nullable().optional(),
});

export const CreateSupervisorDelegationRequestSchema = z.object({
  delegateEmployeeId: UuidSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const CreateBiometricExemptionRequestSchema = z.object({
  targetType: BiometricExemptionTargetTypeSchema,
  targetId: UuidSchema,
  reason: z.string().min(1),
  supportingEvidenceName: z.string().nullable().optional(),
  supportingEvidenceUrl: z.string().nullable().optional(),
  supportingEvidenceMimeType: z.string().nullable().optional(),
  supportingEvidenceSize: z.number().int().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
  requestedBy: z.string().min(1).nullable().optional(),
  createdBy: z.string().min(1).nullable().optional(),
  updatedBy: z.string().min(1).nullable().optional(),
});

export const UpdateBiometricExemptionRequestSchema = CreateBiometricExemptionRequestSchema.partial();

export const ChangeBiometricExemptionStatusRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().nullable().optional(),
});

export const BiometricExemptionSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  employeeId: z.string().uuid().nullable().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  positionId: z.string().uuid().nullable().openapi({ example: null }),
  targetType: BiometricExemptionTargetTypeSchema.openapi({
    example: 'EMPLOYEE',
  }),
  reason: z.string().openapi({ example: 'Approved field assignment' }),
  supportingEvidenceName: z.string().nullable().openapi({ example: 'medical-note.pdf' }),
  supportingEvidenceUrl: z.string().nullable().openapi({ example: null }),
  supportingEvidenceMimeType: z.string().nullable().openapi({ example: 'application/pdf' }),
  supportingEvidenceSize: z.number().int().nullable().openapi({ example: 124000 }),
  status: BiometricExemptionStatusSchema.openapi({
    example: 'PENDING_SUPERVISOR',
  }),
  isActive: z.boolean().openapi({ example: true }),
  requestedBy: z.string().nullable().openapi({ example: 'user_123' }),
  approvedBy: z.string().nullable().openapi({ example: null }),
  approvedAt: z.string().nullable().openapi({ example: null }),
  rejectedBy: z.string().nullable().openapi({ example: null }),
  rejectedAt: z.string().nullable().openapi({ example: null }),
  rejectionReason: z.string().nullable().openapi({ example: null }),
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
export const BiometricProvisioningRoleSchema = z.enum(['ENROLLMENT_SOURCE', 'TARGET']);
export const BiometricProvisioningModeSchema = z.enum(['FULL_SYNC', 'EMPLOYEE_UPSERT', 'EMPLOYEE_REMOVE']);
export const BiometricProvisioningJobStatusSchema = z.enum(['QUEUED', 'RUNNING', 'PREVIEW_READY', 'WAITING_CONFIRMATION', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELED']);
export const SyncStatusSchema = z.enum(['STARTED', 'COMPLETED', 'FAILED', 'PARTIAL']);
export const PunchTypeSchema = z.enum(['IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN']);
export const PunchSourceSchema = z.enum(['DEVICE', 'MANUAL', 'IMPORT', 'MOBILE', 'WEB']);
export const AttendanceDailyRecordStatusSchema = z.enum(['PENDING_SUPERVISOR', 'RETURNED', 'SUPERVISOR_APPROVED', 'HR_APPROVED']);

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
  firmwareVersion: z.string().nullable(),
  platformVersion: z.string().nullable(),
  fingerprintAlgorithm: z.string().nullable(),
  provisioningRole: BiometricProvisioningRoleSchema,
  provisioningEnabled: z.boolean(),
  lastProvisioningAt: z.string().nullable(),
  lastProvisioningStatus: z.string().nullable(),
  communicationKeyConfigured: z.boolean(),
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
  supervisorDelegationId: z.string().uuid().nullable().openapi({ example: null }),
  processedAt: z.string().nullable().openapi({ example: null }),
  rawPayload: z
    .record(z.any())
    .nullable()
    .openapi({ example: { userId: 'BIO-001' } }),
  createdAt: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  employee: EmployeeSchema.nullable().optional(),
  device: BiometricDeviceSchema.nullable().optional(),
  syncBatch: AttendanceSyncBatchSchema.nullable().optional(),
});

export const AttendanceDailyRecordSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  employeeId: UuidSchema,
  attendanceDate: z.string().openapi({ example: '2026-06-09' }),
  firstPunchId: z.string().uuid().nullable(),
  lastPunchId: z.string().uuid().nullable(),
  checkInAt: z.string().nullable().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  checkOutAt: z.string().nullable().openapi({ example: '2026-06-09T17:32:00.000Z' }),
  totalPunches: z.number().int().nonnegative().openapi({ example: 2 }),
  attendanceDays: z.string().openapi({ example: '0.50' }),
  leaveDays: z.string().openapi({ example: '0.50' }),
  holidayId: z.string().uuid().nullable(),
  holidayDays: z.string().openapi({ example: '1.00' }),
  isHoliday: z.boolean().openapi({ example: false }),
  payableDays: z.string().openapi({ example: '1.00' }),
  absenceDays: z.string().openapi({ example: '0.00' }),
  overtimeMinutes: z.number().int().nonnegative().openapi({ example: 120 }),
  overtimeHours: z.string().openapi({ example: '2.00' }),
  overtimeDays: z.string().openapi({ example: '0.25' }),
  isBiometricExempt: z.boolean().openapi({ example: false }),
  payrollNote: z.string().nullable().openapi({
    example: 'Half-day attendance from a single punch; Approved leave 0.50 day(s)',
  }),
  status: AttendanceDailyRecordStatusSchema,
  supervisorApprovedBy: z.string().nullable(),
  supervisorApprovedAt: z.string().nullable(),
  supervisorDelegationId: z.string().uuid().nullable(),
  hrApprovedBy: z.string().nullable(),
  hrApprovedAt: z.string().nullable(),
  returnedBy: z.string().nullable(),
  returnedAt: z.string().nullable(),
  returnReason: z.string().nullable(),
  payrollReadyAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  employee: EmployeeSchema.nullable().optional(),
  temporaryDepartmentAssignment: TemporaryDepartmentAssignmentSchema.nullable().optional(),
  effectiveDepartment: DepartmentSchema.nullable().optional(),
  firstPunch: AttendancePunchSchema.nullable().optional(),
  lastPunch: AttendancePunchSchema.nullable().optional(),
  holiday: HolidaySchema.nullable().optional(),
});

export const IfmisAttendancePeriodSchema = z.object({
  payMonth: z.coerce.number().int().min(1).max(12),
  payYear: z.coerce.number().int().min(2000).max(2200),
});

export const IfmisAttendanceRowSchema = z.object({
  employeeId: UuidSchema,
  ifmisNo: z.number().nullable(),
  nationalId: z.string().nullable(),
  orgId: z.string().nullable(),
  firstName: z.string(),
  fatherName: z.string().nullable(),
  grandName: z.string(),
  firstNameAmharic: z.string().nullable(),
  fatherNameAmharic: z.string().nullable(),
  grandNameAmharic: z.string().nullable(),
  absenteeism: z.number(),
  late: z.number(),
  currentStatus: z.string(),
  approved: z.literal('YES'),
  payMonth: z.number().int(),
  payYear: z.number().int(),
});

export const IfmisReadinessIssueSchema = z.object({
  code: z.enum(['MISSING_SCHEDULE', 'INVALID_SCHEDULE', 'MISSING_RECORD', 'NOT_HR_APPROVED', 'DUPLICATE_NAME']),
  employeeId: UuidSchema,
  employeeName: z.string(),
  date: z.string().nullable(),
  message: z.string(),
});

export const IfmisExportBatchSchema = z.object({
  id: UuidSchema,
  payMonth: z.number().int(),
  payYear: z.number().int(),
  status: z.enum(['PROCESSING', 'SUCCEEDED', 'FAILED']),
  recordCount: z.number().int(),
  pushedBy: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  errorMessage: z.string().nullable(),
});

export const IfmisAttendancePreviewResponseSchema = z.object({
  success: z.boolean(),
  ready: z.boolean(),
  rows: z.array(IfmisAttendanceRowSchema),
  issues: z.array(IfmisReadinessIssueSchema),
  batches: z.array(IfmisExportBatchSchema),
});

export const IfmisAttendancePushResponseSchema = z.object({
  success: z.boolean(),
  batch: IfmisExportBatchSchema,
});

export const OvertimeRequestStatusSchema = z.enum(['ASSIGNED', 'APPROVED', 'REJECTED']);
export const OvertimeAttendanceCoverageSchema = z.enum(['UPCOMING', 'NONE', 'PARTIAL', 'COVERED']);

export const OvertimeAttendancePunchSchema = z.object({
  id: UuidSchema,
  punchTime: z.string(),
  punchType: z.string(),
  source: z.string(),
});

export const OvertimeAttendanceEvidenceSchema = z.object({
  coverage: OvertimeAttendanceCoverageSchema,
  assignedMinutes: z.number().int().nonnegative(),
  overlapMinutes: z.number().int().nonnegative(),
  checkInAt: z.string().nullable(),
  checkOutAt: z.string().nullable(),
  punches: z.array(OvertimeAttendancePunchSchema),
});

export const OvertimeRequestSchema = z.object({
  id: UuidSchema,
  employeeId: UuidSchema,
  attendanceDailyRecordId: z.string().uuid().nullable(),
  overtimeDate: z.string().openapi({ example: '2026-08-20' }),
  startAt: z.string().openapi({ example: '2026-08-20T17:00:00.000Z' }),
  endAt: z.string().openapi({ example: '2026-08-20T19:00:00.000Z' }),
  requestedMinutes: z.number().int().positive().openapi({ example: 120 }),
  approvedMinutes: z.number().int().nonnegative().openapi({ example: 120 }),
  overtimeDays: z.string().openapi({ example: '0.25' }),
  reason: z.string(),
  status: OvertimeRequestStatusSchema,
  requestedBy: z.string(),
  requestedSupervisorDelegationId: z.string().uuid().nullable(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  rejectedBy: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  supervisorDelegationId: z.string().uuid().nullable(),
  payrollNote: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  employee: EmployeeSchema.nullable().optional(),
  attendanceDailyRecord: AttendanceDailyRecordSchema.nullable().optional(),
  attendanceEvidence: OvertimeAttendanceEvidenceSchema.nullable().optional(),
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

export const CreateHolidayRequestSchema = z.object({
  nameEn: z.string().min(1).max(150),
  nameAm: z.string().max(150).nullable().optional(),
  type: HolidayTypeSchema,
  durationDays: z.union([z.literal('1.00'), z.literal('1'), z.literal('0.50'), z.literal('0.5'), z.literal(1), z.literal(0.5)]).optional(),
  startDate: RequiredDateSchema,
  endDate: RequiredDateSchema,
  description: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  createdBy: z.string().min(1).nullable().optional(),
  updatedBy: z.string().min(1).nullable().optional(),
});

export const UpdateHolidayRequestSchema = CreateHolidayRequestSchema.partial();

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
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
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
  firmwareVersion: z.string().max(150).nullable().optional(),
  platformVersion: z.string().max(150).nullable().optional(),
  fingerprintAlgorithm: z.string().max(150).nullable().optional(),
  provisioningRole: BiometricProvisioningRoleSchema.optional(),
  provisioningEnabled: z.boolean().optional(),
  syncIntervalMinutes: z.number().int().positive().optional(),
  autoSyncEnabled: z.boolean().optional(),
  healthStatus: DeviceHealthStatusSchema.optional(),
  fallbackToPull: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const UpdateBiometricDeviceRequestSchema = CreateBiometricDeviceRequestSchema.partial();

export const CreateBiometricProvisioningPreviewRequestSchema = z
  .object({
    mode: BiometricProvisioningModeSchema,
    employeeIds: z.array(UuidSchema).max(5000).optional().default([]),
    targetDeviceIds: z.array(UuidSchema).max(50).optional().default([]),
  })
  .superRefine((value, context) => {
    if (value.mode !== 'FULL_SYNC' && value.employeeIds.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['employeeIds'],
        message: 'At least one employee is required',
      });
    }
  });

export const BiometricProvisioningDeviceResultSchema = z.object({
  id: UuidSchema,
  jobId: UuidSchema,
  deviceId: UuidSchema,
  status: z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED']),
  addedUsers: z.number().int(),
  updatedUsers: z.number().int(),
  removedUsers: z.number().int(),
  missingTemplates: z.number().int(),
  uidConflicts: z.number().int(),
  differences: z.record(z.unknown()).nullable(),
  errorMessage: z.string().nullable(),
  attempts: z.number().int(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  device: BiometricDeviceSchema.nullable().optional(),
});

export const BiometricProvisioningJobSchema = z.object({
  id: UuidSchema,
  previewJobId: UuidSchema.nullable(),
  sourceDeviceId: UuidSchema,
  mode: BiometricProvisioningModeSchema,
  status: BiometricProvisioningJobStatusSchema,
  isPreview: z.boolean(),
  requestedEmployeeIds: z.array(UuidSchema),
  requestedTargetDeviceIds: z.array(UuidSchema),
  summary: z.record(z.unknown()).nullable(),
  errorMessage: z.string().nullable(),
  requestedBy: z.string(),
  startedAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourceDevice: BiometricDeviceSchema.nullable().optional(),
  deviceResults: z.array(BiometricProvisioningDeviceResultSchema).optional(),
});

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

export const ManualPunchRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PENDING_HR_REVIEW', 'HR_REVIEWED', 'HR_REJECTED', 'SUPERVISOR_APPROVED', 'SUPERVISOR_REJECTED']);

export const ManualPunchRequestSchema = z.object({
  id: UuidSchema.openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
  employeeId: UuidSchema.openapi({
    example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f',
  }),
  requestedPunchTime: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  requestedPunchType: PunchTypeSchema.openapi({ example: 'IN' }),
  reason: z.string().openapi({ example: 'Missed punch due to device outage' }),
  supportingDocumentName: z.string().nullable().openapi({ example: 'clinic-note.pdf' }),
  supportingDocumentUrl: z.string().nullable().openapi({ example: null }),
  supportingDocumentMimeType: z.string().nullable().openapi({ example: 'application/pdf' }),
  supportingDocumentSize: z.number().int().nullable().openapi({ example: 124000 }),
  status: ManualPunchRequestStatusSchema.openapi({ example: 'PENDING' }),
  requestedBy: z.string().openapi({ example: 'user_123' }),
  hrReviewedBy: z.string().nullable().openapi({ example: null }),
  hrReviewedAt: z.string().nullable().openapi({ example: null }),
  hrReviewNote: z.string().nullable().openapi({ example: null }),
  approvedBy: z.string().nullable().openapi({ example: null }),
  approvedAt: z.string().nullable().openapi({ example: null }),
  rejectedBy: z.string().nullable().openapi({ example: null }),
  rejectedAt: z.string().nullable().openapi({ example: null }),
  rejectionReason: z.string().nullable().openapi({ example: null }),
  supervisorDelegationId: z.string().uuid().nullable().openapi({ example: null }),
  createdAt: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  updatedAt: z.string().openapi({ example: '2026-06-09T08:15:00.000Z' }),
  employee: EmployeeSchema.nullable().optional(),
});

export const CreateManualPunchRequestRequestSchema = z.object({
  employeeId: UuidSchema.optional(),
  requestedPunchTime: z.string().datetime(),
  requestedPunchType: PunchTypeSchema,
  reason: z.string().min(1),
  supportingDocumentName: z.string().nullable().optional(),
  supportingDocumentUrl: z.string().nullable().optional(),
  supportingDocumentMimeType: z.string().nullable().optional(),
  supportingDocumentSize: z.number().int().nonnegative().nullable().optional(),
  requestedBy: z.string().min(1).optional(),
});

export const ChangeManualPunchRequestStatusRequestSchema = z.object({
  status: z.enum(['HR_REVIEWED', 'HR_REJECTED', 'SUPERVISOR_APPROVED', 'SUPERVISOR_REJECTED', 'APPROVED', 'REJECTED']),
  approvedBy: z.string().min(1).optional(),
  approvedAt: z.string().datetime().optional(),
  hrReviewedBy: z.string().min(1).optional(),
  hrReviewedAt: z.string().datetime().optional(),
  hrReviewNote: z.string().nullable().optional(),
  rejectedBy: z.string().min(1).optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().nullable().optional(),
});

export const CreateOvertimeRequestRequestSchema = z
  .object({
    employeeId: UuidSchema.optional(),
    employeeIds: z.array(UuidSchema).min(1).optional(),
    overtimeDate: RequiredDateSchema.optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    reason: z.string().min(1),
    requestedBy: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.employeeIds?.length && !data.employeeId) {
      ctx.addIssue({
        code: 'custom',
        message: 'employeeIds is required',
        path: ['employeeIds'],
      });
    }
  });

export const ChangeOvertimeRequestStatusRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  approvedMinutes: z.number().int().positive().optional(),
  overtimeDays: z.number().nonnegative().optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().nullable().optional(),
  payrollNote: z.string().nullable().optional(),
});

export const ReturnAttendanceDailyRecordRequestSchema = z.object({
  reason: z.string().min(1),
});

export const UpdateAttendanceDailyRecordPayrollRequestSchema = z.object({
  attendanceDays: z.union([z.string(), z.number()]).optional(),
  leaveDays: z.union([z.string(), z.number()]).optional(),
  payableDays: z.union([z.string(), z.number()]).optional(),
  payrollNote: z.string().nullable().optional(),
});

export const LeaveRequestStatusSchema = z.enum(['PENDING', 'APPROVED', 'AUTHORIZED', 'REJECTED', 'AUTHORIZATION_REJECTED']);
export const LeaveBalanceTransactionTypeSchema = z.enum(['INITIAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'DEDUCTION', 'RESERVATION', 'CONSUMPTION', 'REVERSAL', 'ADJUSTMENT']);

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
  allowedDays: z.string().nullable(),
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
  reserved: z.string().openapi({ example: '3.00' }),
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
  approvedDays: z.string().openapi({ example: '3.50' }),
  consumedDays: z.string().openapi({ example: '1.00' }),
  scheduledDays: z.string().openapi({ example: '2.50' }),
  interruptedDays: z.string().openapi({ example: '0.00' }),
  remainingDays: z.string().openapi({ example: '2.50' }),
  isPartialApproval: z.boolean().openapi({ example: true }),
  reason: z.string(),
  status: LeaveRequestStatusSchema,
  requestedBy: z.string(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().nullable(),
  authorizedBy: z.string().nullable(),
  authorizedAt: z.string().nullable(),
  authorizationRejectedBy: z.string().nullable(),
  authorizationRejectedAt: z.string().nullable(),
  authorizationRejectionReason: z.string().nullable(),
  rejectedBy: z.string().nullable(),
  rejectedAt: z.string().nullable(),
  rejectionReason: z.string().nullable(),
  supervisorDelegationId: z.string().uuid().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  employee: EmployeeSchema.nullable().optional(),
  leaveType: LeaveTypeSchema.nullable().optional(),
  fiscalYear: LeaveFiscalYearSchema.nullable().optional(),
  annualLeaveDates: z
    .array(
      z.object({
        id: UuidSchema,
        leaveRequestId: UuidSchema,
        date: z.string().openapi({ example: '2026-08-01' }),
        requestedDayValue: z.string().openapi({ example: '1.00' }),
        approvedDayValue: z.string().nullable().openapi({ example: '0.50' }),
        status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
        source: z.enum(['ORIGINAL', 'CONTINUATION']),
        utilizationStatus: z.enum(['SCHEDULED', 'CONSUMED', 'INTERRUPTED', 'CANCELLED']),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    )
    .optional(),
  interruptions: z
    .array(
      z.object({
        id: UuidSchema,
        leaveRequestId: UuidSchema,
        reason: z.string(),
        recallAuthority: z.string(),
        authorityUserId: z.string().nullable(),
        actualWorkStartDate: z.string(),
        actualWorkEndDate: z.string(),
        status: LeaveRequestStatusSchema,
        requestedBy: z.string(),
        reviewedBy: z.string().nullable(),
        reviewedAt: z.string().nullable(),
        rejectionReason: z.string().nullable(),
        authorizedBy: z.string().nullable(),
        authorizedAt: z.string().nullable(),
        authorizationRejectedBy: z.string().nullable(),
        authorizationRejectedAt: z.string().nullable(),
        authorizationRejectionReason: z.string().nullable(),
        supervisorDelegationId: z.string().uuid().nullable(),
        createdAt: z.string(),
        updatedAt: z.string(),
        dates: z.array(
          z.object({
            id: UuidSchema,
            leaveInterruptionId: UuidSchema,
            kind: z.enum(['INTERRUPTED_PROPOSED', 'CONTINUATION_PROPOSED', 'INTERRUPTED_APPROVED', 'CONTINUATION_APPROVED']),
            date: z.string(),
            dayValue: z.string(),
            createdAt: z.string(),
          }),
        ),
      }),
    )
    .optional(),
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
  allowedDays: z.union([z.string(), z.number()]).nullable().optional(),
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
  balances: z
    .array(
      z.object({
        employeeId: UuidSchema,
        opening: z.union([z.string(), z.number()]),
      }),
    )
    .min(1),
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
  startDate: RequiredDateSchema.optional(),
  endDate: RequiredDateSchema.optional(),
  annualLeaveDates: z
    .array(
      z.object({
        date: RequiredDateSchema,
        dayValue: z.union([z.literal('1.00'), z.literal('0.50'), z.literal(1), z.literal(0.5)]),
      }),
    )
    .optional(),
  reason: z.string().min(1),
  requestedBy: z.string().min(1).nullable().optional(),
});

export const UpdateLeaveRequestRequestSchema = z.object({
  fiscalYearId: UuidSchema.nullable().optional(),
  startDate: RequiredDateSchema.optional(),
  endDate: RequiredDateSchema.optional(),
  annualLeaveDates: z
    .array(
      z.object({
        date: RequiredDateSchema,
        dayValue: z.union([z.literal('1.00'), z.literal('0.50'), z.literal(1), z.literal(0.5)]),
      }),
    )
    .optional(),
  reason: z.string().min(1),
  updatedBy: z.string().min(1).nullable().optional(),
});

export const ChangeLeaveRequestStatusRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  approvedBy: z.string().min(1).optional(),
  approvedAt: z.string().datetime().optional(),
  approvedDates: z
    .array(
      z.object({
        date: RequiredDateSchema,
        dayValue: z.union([z.literal('1.00'), z.literal('0.50'), z.literal(1), z.literal(0.5)]),
      }),
    )
    .optional(),
  rejectedBy: z.string().min(1).optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().nullable().optional(),
});

export const AuthorizeLeaveRequestSchema = z.object({
  status: z.enum(['AUTHORIZED', 'AUTHORIZATION_REJECTED']),
  rejectionReason: z.string().trim().min(1).nullable().optional(),
});

const LeaveDateSelectionSchema = z.object({
  date: RequiredDateSchema,
  dayValue: z.union([z.literal('1.00'), z.literal('0.50'), z.literal(1), z.literal(0.5)]),
});

export const CreateLeaveInterruptionRequestSchema = z.object({
  interruptedDates: z.array(LeaveDateSelectionSchema).min(1),
  continuationDates: z.array(LeaveDateSelectionSchema).min(1),
  reason: z.string().trim().min(1),
  recallAuthority: z.string().trim().min(1),
  authorityUserId: z.string().min(1).nullable().optional(),
  requestedBy: z.string().min(1).nullable().optional(),
});

export const ReviewLeaveInterruptionRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewedBy: z.string().min(1).nullable().optional(),
  interruptedDates: z.array(LeaveDateSelectionSchema).min(1).optional(),
  continuationDates: z.array(LeaveDateSelectionSchema).min(1).optional(),
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

export const HolidaysResponseSchema = z.object({
  success: z.boolean(),
  holidays: z.array(HolidaySchema),
});

export const HolidayResponseSchema = z.object({
  success: z.boolean(),
  holiday: HolidaySchema,
});

export const NotificationLogsResponseSchema = z.object({
  success: z.boolean(),
  notificationLogs: z.array(NotificationLogSchema),
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

export const SupervisorDelegationsResponseSchema = z.object({
  success: z.boolean(),
  supervisorDelegations: z.array(SupervisorDelegationSchema),
});

export const SupervisorDelegationResponseSchema = z.object({
  success: z.boolean(),
  supervisorDelegation: SupervisorDelegationSchema,
});

export const TemporaryDepartmentAssignmentsResponseSchema = z.object({
  success: z.boolean(),
  temporaryDepartmentAssignments: z.array(TemporaryDepartmentAssignmentSchema),
});

export const TemporaryDepartmentAssignmentResponseSchema = z.object({
  success: z.boolean(),
  temporaryDepartmentAssignment: TemporaryDepartmentAssignmentSchema,
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

export const BiometricProvisioningJobResponseSchema = z.object({
  success: z.boolean(),
  biometricProvisioningJob: BiometricProvisioningJobSchema,
});

export const BiometricProvisioningJobsResponseSchema = z.object({
  success: z.boolean(),
  biometricProvisioningJobs: z.array(BiometricProvisioningJobSchema),
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
  pagination: z
    .object({
      total: z.number().int().nonnegative(),
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
    })
    .optional(),
});

export const AttendancePunchResponseSchema = z.object({
  success: z.boolean(),
  attendancePunch: AttendancePunchSchema,
});

export const AttendanceDailyRecordsResponseSchema = z.object({
  success: z.boolean(),
  attendanceDailyRecords: z.array(AttendanceDailyRecordSchema),
});

export const AttendanceDailyRecordResponseSchema = z.object({
  success: z.boolean(),
  attendanceDailyRecord: AttendanceDailyRecordSchema,
});

export const GenerateAttendanceDailyRecordsResponseSchema = z.object({
  success: z.boolean(),
  generated: z.number().int().nonnegative(),
  attendanceDailyRecords: z.array(AttendanceDailyRecordSchema),
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

export const OvertimeRequestResponseSchema = z.object({
  success: z.boolean(),
  overtimeRequest: OvertimeRequestSchema,
});

export const OvertimeRequestsResponseSchema = z.object({
  success: z.boolean(),
  overtimeRequests: z.array(OvertimeRequestSchema),
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
export const TimeOperationTypeSchema = z.enum(['MANUAL_PUNCH_APPROVAL', 'LEAVE_REQUEST_APPROVAL', 'UNPROCESSED_PUNCHES', 'DEVICE_HEALTH', 'SYNC_FAILURE', 'DEVICE_SETUP', 'ALL_CLEAR']);

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
    roles: z.array(z.string()).openapi({ example: ['supervisor'] }),
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
  workforceDistribution: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      count: z.number().int().nonnegative(),
      percentage: z.number().nonnegative(),
    }),
  ),
  departmentAttendanceRanking: z.array(
    z.object({
      department: z.string(),
      attendanceRate: z.number().nonnegative(),
      present: z.number().int().nonnegative(),
      totalEmployees: z.number().int().nonnegative(),
    }),
  ),
  compoundStatus: z.object({
    currentlyInside: z.number().int().nonnegative(),
    checkedOut: z.number().int().nonnegative(),
    notYetArrived: z.number().int().nonnegative(),
  }),
  liveAttendanceTimeline: z.array(
    z.object({
      time: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  leaveSummary: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  hrPerformance: z.object({
    pendingHrApproval: z.number().int().nonnegative(),
    pendingLeaveApproval: z.number().int().nonnegative(),
    averageApprovalTimeHours: z.number().nonnegative(),
    correctionsReturned: z.number().int().nonnegative(),
    payrollReadyPercent: z.number().nonnegative(),
  }),
  departmentPerformance: z.array(
    z.object({
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
    }),
  ),
  monthlyAttendanceTrend: z.array(
    z.object({
      month: z.string(),
      present: z.number().int().nonnegative(),
      attendanceRate: z.number().nonnegative(),
    }),
  ),
  attendanceExceptions: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(['critical', 'warning', 'info']),
      title: z.string(),
      count: z.number().int().nonnegative(),
      description: z.string(),
    }),
  ),
  deviceHealth: z.object({
    total: z.number().int().nonnegative(),
    online: z.number().int().nonnegative(),
    offline: z.number().int().nonnegative(),
    error: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(),
  }),
  executiveAlerts: z.array(
    z.object({
      id: z.string(),
      severity: z.enum(['critical', 'warning', 'info']),
      title: z.string(),
      description: z.string(),
    }),
  ),
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
    attendanceExceptions: z.array(
      z.object({
        id: z.string(),
        severity: z.enum(['critical', 'warning', 'info']),
        title: z.string(),
        count: z.number().int().nonnegative(),
        description: z.string(),
      }),
    ),
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
