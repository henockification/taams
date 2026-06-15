export type CreateDepartmentInput = {
  nameEn: string;
  nameAm?: string | null;
  code?: string | null;
  parentDepartmentId?: string | null;
  isActive?: boolean;
};

export type UpdateDepartmentInput = Partial<CreateDepartmentInput>;

export type CreatePositionInput = {
  nameEn: string;
  nameAm?: string | null;
  code?: string | null;
  isActive?: boolean;
};

export type UpdatePositionInput = Partial<CreatePositionInput>;

export type Shift = {
  id: string;
  nameEn: string;
  nameAm: string | null;
  gracePeriodMinutes: number;
  lateAfterMinutes: number;
  earlyOutBeforeMinutes: number;
  isOvernight: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShiftSegment = {
  id: string;
  shiftId: string;
  nameEn: string;
  nameAm: string | null;
  startTime: string;
  endTime: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShiftBreak = {
  id: string;
  shiftId: string;
  nameEn: string;
  nameAm: string | null;
  startTime: string;
  endTime: string;
  isPaid: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type WorkSchedule = {
  id: string;
  nameEn: string;
  nameAm: string | null;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DayOfWeek = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type WorkScheduleDay = {
  id: string;
  workScheduleId: string;
  dayOfWeek: DayOfWeek;
  shiftId: string | null;
  isOffDay: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeWorkSchedule = {
  id: string;
  employeeId: string;
  workScheduleId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | 'SUSPENDED';
export type EmploymentType = 'PERMANENT' | 'CONTRACT' | 'TEMPORARY' | 'DAILY';

export type CreateEmployeeInput = {
  userId?: string | null;
  employeeCode: string;
  payrollId?: string | null;
  biometricId?: string | null;
  firstNameEn: string;
  middleNameEn?: string | null;
  lastNameEn: string;
  firstNameAm?: string | null;
  middleNameAm?: string | null;
  lastNameAm?: string | null;
  gender?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  departmentId: string;
  positionId?: string | null;
  employmentStatus?: EmploymentStatus;
  employmentType?: EmploymentType;
  hireDate?: string | null;
  terminationDate?: string | null;
  isActive?: boolean;
};

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export type CreateEmployeeSupervisorInput = {
  supervisorId: string;
  isPrimary?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

export type CreateShiftInput = {
  nameEn: string;
  nameAm?: string | null;
  gracePeriodMinutes?: number;
  lateAfterMinutes?: number;
  earlyOutBeforeMinutes?: number;
  isOvernight?: boolean;
  isActive?: boolean;
};

export type UpdateShiftInput = Partial<CreateShiftInput>;

export type CreateShiftSegmentInput = {
  shiftId: string;
  nameEn: string;
  nameAm?: string | null;
  startTime: string;
  endTime: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateShiftSegmentInput = Partial<CreateShiftSegmentInput>;

export type CreateShiftBreakInput = {
  shiftId: string;
  nameEn: string;
  nameAm?: string | null;
  startTime: string;
  endTime: string;
  isPaid?: boolean;
  isActive?: boolean;
};

export type UpdateShiftBreakInput = Partial<CreateShiftBreakInput>;

export type CreateWorkScheduleInput = {
  nameEn: string;
  nameAm?: string | null;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

export type UpdateWorkScheduleInput = Partial<CreateWorkScheduleInput>;

export type CreateWorkScheduleDayInput = {
  dayOfWeek: DayOfWeek;
  shiftId?: string | null;
  isOffDay?: boolean;
  isActive?: boolean;
};

export type UpdateWorkScheduleDayInput = Partial<CreateWorkScheduleDayInput> & {
  workScheduleId?: string;
};

export type CreateEmployeeWorkScheduleInput = {
  employeeId: string;
  workScheduleId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive?: boolean;
};

export type UpdateEmployeeWorkScheduleInput = Partial<CreateEmployeeWorkScheduleInput>;
