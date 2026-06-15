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
  employmentStatus: EmploymentStatusSchema,
  employmentType: EmploymentTypeSchema,
  hireDate: z.string().nullable().openapi({ example: '2026-01-01' }),
  terminationDate: z.string().nullable().openapi({ example: null }),
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
  employmentStatus: EmploymentStatusSchema.optional(),
  employmentType: EmploymentTypeSchema.optional(),
  hireDate: OptionalDateSchema,
  terminationDate: OptionalDateSchema,
  isActive: z.boolean().optional(),
});

export const UpdateEmployeeRequestSchema = CreateEmployeeRequestSchema.partial();

export const CreateEmployeeSupervisorRequestSchema = z.object({
  supervisorId: UuidSchema,
  isPrimary: z.boolean().optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  effectiveTo: OptionalDateSchema,
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

export const EmployeeResponseSchema = z.object({
  success: z.boolean(),
  employee: EmployeeSchema,
});

export const EmployeeSupervisorsResponseSchema = z.object({
  success: z.boolean(),
  supervisors: z.array(EmployeeSupervisorSchema),
});

export const EmployeeSupervisorResponseSchema = z.object({
  success: z.boolean(),
  supervisor: EmployeeSupervisorSchema,
});
