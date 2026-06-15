export type Department = {
  id: string;
  nameEn: string;
  nameAm: string | null;
  code: string | null;
  parentDepartmentId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Position = {
  id: string;
  nameEn: string;
  nameAm: string | null;
  code: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

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

export type EmploymentStatus = 'ACTIVE' | 'INACTIVE' | 'TERMINATED' | 'SUSPENDED';
export type EmploymentType = 'PERMANENT' | 'CONTRACT' | 'TEMPORARY' | 'DAILY';

export type Employee = {
  id: string;
  userId: string | null;
  employeeCode: string;
  payrollId: string | null;
  biometricId: string | null;
  firstNameEn: string;
  middleNameEn: string | null;
  lastNameEn: string;
  firstNameAm: string | null;
  middleNameAm: string | null;
  lastNameAm: string | null;
  gender: string | null;
  phoneNumber: string | null;
  email: string | null;
  departmentId: string;
  positionId: string | null;
  employmentStatus: EmploymentStatus;
  employmentType: EmploymentType;
  hireDate: string | null;
  terminationDate: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  position?: Position | null;
};

export type EmployeeSupervisor = {
  id: string;
  employeeId: string;
  supervisorId: string;
  isPrimary: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  supervisor?: Employee;
};

export type DepartmentsResponse = { success: boolean; departments: Department[] };
export type DepartmentResponse = { success: boolean; department: Department };
export type PositionsResponse = { success: boolean; positions: Position[] };
export type PositionResponse = { success: boolean; position: Position };
export type ShiftsResponse = { success: boolean; shifts: Shift[] };
export type ShiftResponse = { success: boolean; shift: Shift };
export type ShiftSegmentsResponse = { success: boolean; shiftSegments: ShiftSegment[] };
export type ShiftSegmentResponse = { success: boolean; shiftSegment: ShiftSegment };
export type ShiftBreaksResponse = { success: boolean; shiftBreaks: ShiftBreak[] };
export type ShiftBreakResponse = { success: boolean; shiftBreak: ShiftBreak };
export type WorkSchedulesResponse = { success: boolean; workSchedules: WorkSchedule[] };
export type WorkScheduleResponse = { success: boolean; workSchedule: WorkSchedule };
export type WorkScheduleDaysResponse = { success: boolean; days: WorkScheduleDay[] };
export type WorkScheduleDayResponse = { success: boolean; day: WorkScheduleDay };
export type EmployeesResponse = { success: boolean; employees: Employee[] };
export type EmployeeResponse = { success: boolean; employee: Employee };
export type EmployeeSupervisorsResponse = { success: boolean; supervisors: EmployeeSupervisor[] };
export type EmployeeSupervisorResponse = { success: boolean; supervisor: EmployeeSupervisor };

export type CreateDepartmentInput = {
  nameEn: string;
  nameAm?: string | null;
  code?: string | null;
  parentDepartmentId?: string | null;
  isActive?: boolean;
};

export type UpdateDepartmentInput = Partial<CreateDepartmentInput> & { departmentId: string };

export type CreatePositionInput = {
  nameEn: string;
  nameAm?: string | null;
  code?: string | null;
  isActive?: boolean;
};

export type UpdatePositionInput = Partial<CreatePositionInput> & { positionId: string };

export type CreateShiftInput = {
  nameEn: string;
  nameAm?: string | null;
  gracePeriodMinutes?: number;
  lateAfterMinutes?: number;
  earlyOutBeforeMinutes?: number;
  isOvernight?: boolean;
  isActive?: boolean;
};

export type UpdateShiftInput = Partial<CreateShiftInput> & { shiftId: string };

export type CreateShiftSegmentInput = {
  shiftId: string;
  nameEn: string;
  nameAm?: string | null;
  startTime: string;
  endTime: string;
  sortOrder?: number;
  isActive?: boolean;
};

export type UpdateShiftSegmentInput = Partial<CreateShiftSegmentInput> & { shiftSegmentId: string };

export type CreateShiftBreakInput = {
  shiftId: string;
  nameEn: string;
  nameAm?: string | null;
  startTime: string;
  endTime: string;
  isPaid?: boolean;
  isActive?: boolean;
};

export type UpdateShiftBreakInput = Partial<CreateShiftBreakInput> & { shiftBreakId: string };

export type CreateWorkScheduleInput = {
  nameEn: string;
  nameAm?: string | null;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

export type UpdateWorkScheduleInput = Partial<CreateWorkScheduleInput> & { workScheduleId: string };

export type CreateWorkScheduleDayInput = {
  workScheduleId: string;
  dayOfWeek: DayOfWeek;
  shiftId?: string | null;
  isOffDay?: boolean;
  isActive?: boolean;
};

export type UpdateWorkScheduleDayInput = Partial<CreateWorkScheduleDayInput> & { workScheduleDayId: string };

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

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & { employeeId: string };

export type CreateEmployeeSupervisorInput = {
  employeeId: string;
  supervisorId: string;
  isPrimary?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};
