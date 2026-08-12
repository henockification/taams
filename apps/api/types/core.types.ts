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
  positionName?: string | null;
  employmentStatus?: EmploymentStatus;
  employmentType?: EmploymentType;
  hireDate?: string | null;
  terminationDate?: string | null;
  sourceIdNo?: string | null;
  sourceEmployeeCode?: string | null;
  sourceEmploymentStatus?: string | null;
  sourceDepartmentName?: string | null;
  sourcePositionName?: string | null;
  sourcePositionCode?: string | null;
  salary?: string | number | null;
  salaryStep?: string | null;
  sourceImportedAt?: string | Date | null;
  sourceRawPayload?: Record<string, unknown> | null;
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
  positionName: string | null;
  employmentStatus: EmploymentStatus;
  employmentType: EmploymentType;
  hireDate: string | null;
  terminationDate: string | null;
  sourceIdNo: string | null;
  sourceEmployeeCode: string | null;
  sourceEmploymentStatus: string | null;
  sourceDepartmentName: string | null;
  sourcePositionName: string | null;
  sourcePositionCode: string | null;
  salary: string | null;
  salaryStep: string | null;
  sourceImportedAt: string | null;
  sourceRawPayload: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  department?: Department;
  position?: Position | null;
};

export type BiometricExemptionTargetType = 'EMPLOYEE' | 'POSITION';

export type BiometricExemption = {
  id: string;
  employeeId: string | null;
  positionId: string | null;
  targetType: BiometricExemptionTargetType;
  reason: string;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
  position?: Position | null;
};

export type BiometricDeviceType = 'BIOMETRIC' | 'RFID' | 'FACE_RECOGNITION' | 'MOBILE' | 'WEB';
export type ConnectionType = 'TCP_IP' | 'USB' | 'WIFI' | 'API';
export type DeviceIntegrationMode = 'PUSH_ADMS' | 'TCP_PULL' | 'HYBRID' | 'MANUAL_ONLY' | 'DISABLED';
export type DeviceHealthStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'ERROR';
export type SyncStatus = 'STARTED' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
export type PunchType = 'IN' | 'OUT' | 'BREAK_IN' | 'BREAK_OUT' | 'UNKNOWN';
export type PunchSource = 'DEVICE' | 'MANUAL' | 'IMPORT' | 'MOBILE' | 'WEB';
export type AttendanceDailyRecordStatus = 'PENDING_SUPERVISOR' | 'RETURNED' | 'SUPERVISOR_APPROVED' | 'HR_APPROVED';

export type BiometricDevice = {
  id: string;
  deviceName: string;
  deviceCode: string;
  ipAddress: string | null;
  port: number | null;
  locationName: string | null;
  departmentId: string | null;
  deviceType: BiometricDeviceType;
  connectionType: ConnectionType;
  vendor: string;
  protocol: string;
  integrationMode: DeviceIntegrationMode;
  preferredMode: DeviceIntegrationMode;
  pushEnabled: boolean;
  pullEnabled: boolean;
  pushSecret: string | null;
  communicationKey: string | null;
  serialNumber: string | null;
  model: string | null;
  manufacturer: string | null;
  isActive: boolean;
  lastSyncAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastFailedSyncAt: string | null;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastSeenAt: string | null;
  lastErrorMessage: string | null;
  syncIntervalMinutes: number;
  autoSyncEnabled: boolean;
  healthStatus: DeviceHealthStatus;
  fallbackToPull: boolean;
  createdAt: string;
  updatedAt: string;
  department?: Department | null;
};

export type AttendanceSyncBatch = {
  id: string;
  deviceId: string | null;
  syncStartedAt: string;
  syncCompletedAt: string | null;
  syncStatus: SyncStatus;
  totalRecords: number;
  successfulRecords: number;
  failedRecords: number;
  errorMessage: string | null;
  createdAt: string;
  device?: BiometricDevice | null;
};

export type AttendancePunch = {
  id: string;
  employeeId: string | null;
  biometricId: string;
  deviceId: string | null;
  syncBatchId: string | null;
  externalUid: string | null;
  punchTime: string;
  punchType: PunchType;
  verificationType: string | null;
  devicePunchId: string | null;
  source: PunchSource;
  isProcessed: boolean;
  isManual: boolean;
  manualReason: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  processedAt: string | null;
  rawPayload: Record<string, unknown> | null;
  createdAt: string;
  employee?: Employee | null;
  device?: BiometricDevice | null;
  syncBatch?: AttendanceSyncBatch | null;
};

export type AttendanceDailyRecord = {
  id: string;
  employeeId: string;
  attendanceDate: string;
  firstPunchId: string | null;
  lastPunchId: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  totalPunches: number;
  attendanceDays: string;
  leaveDays: string;
  payableDays: string;
  absenceDays: string;
  isBiometricExempt: boolean;
  payrollNote: string | null;
  status: AttendanceDailyRecordStatus;
  supervisorApprovedBy: string | null;
  supervisorApprovedAt: string | null;
  hrApprovedBy: string | null;
  hrApprovedAt: string | null;
  returnedBy: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  payrollReadyAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
  firstPunch?: AttendancePunch | null;
  lastPunch?: AttendancePunch | null;
};

export type CreateBiometricExemptionInput = {
  targetType: BiometricExemptionTargetType;
  targetId: string;
  reason: string;
  isActive?: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type UpdateBiometricExemptionInput = Partial<CreateBiometricExemptionInput> & {
  biometricExemptionId: string;
};

export type ManualPunchRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ManualPunchRequest = {
  id: string;
  employeeId: string;
  requestedPunchTime: string;
  requestedPunchType: PunchType;
  reason: string;
  status: ManualPunchRequestStatus;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
};

export type CreateBiometricDeviceInput = {
  deviceName: string;
  deviceCode: string;
  ipAddress?: string | null;
  port?: number | null;
  locationName?: string | null;
  departmentId?: string | null;
  deviceType?: BiometricDeviceType;
  connectionType?: ConnectionType;
  vendor?: string;
  protocol?: string;
  integrationMode?: DeviceIntegrationMode;
  preferredMode?: DeviceIntegrationMode;
  pushEnabled?: boolean;
  pullEnabled?: boolean;
  pushSecret?: string | null;
  communicationKey?: string | null;
  serialNumber?: string | null;
  model?: string | null;
  manufacturer?: string | null;
  syncIntervalMinutes?: number;
  autoSyncEnabled?: boolean;
  healthStatus?: DeviceHealthStatus;
  fallbackToPull?: boolean;
  isActive?: boolean;
};

export type UpdateBiometricDeviceInput = Partial<CreateBiometricDeviceInput> & {
  biometricDeviceId: string;
};

export type CreateBiometricDeviceSyncInput = {
  syncStatus?: SyncStatus;
  totalRecords?: number;
  successfulRecords?: number;
  failedRecords?: number;
  errorMessage?: string | null;
  syncCompletedAt?: string | null;
};

export type CreateAttendancePunchInput = {
  employeeId?: string | null;
  biometricId: string;
  deviceId?: string | null;
  syncBatchId?: string | null;
  externalUid?: string | null;
  punchTime: string;
  punchType?: PunchType;
  verificationType?: string | null;
  devicePunchId?: string | null;
  source?: PunchSource;
  isProcessed?: boolean;
  isManual?: boolean;
  manualReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  processedAt?: string | null;
  rawPayload?: Record<string, unknown> | null;
};

export type UpdateAttendancePunchInput = Partial<CreateAttendancePunchInput> & {
  attendancePunchId: string;
};

export type CreateManualPunchRequestInput = {
  employeeId: string;
  requestedPunchTime: string;
  requestedPunchType: PunchType;
  reason: string;
  requestedBy?: string | null;
};

export type ChangeManualPunchRequestStatusInput = {
  status: Exclude<ManualPunchRequestStatus, 'PENDING'>;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
};

export type BiometricDevicesResponse = { success: boolean; biometricDevices: BiometricDevice[] };
export type BiometricDeviceResponse = { success: boolean; biometricDevice: BiometricDevice };
export type BiometricExemptionsResponse = { success: boolean; biometricExemptions: BiometricExemption[] };
export type BiometricExemptionResponse = { success: boolean; biometricExemption: BiometricExemption };
export type AttendanceSyncBatchesResponse = { success: boolean; attendanceSyncBatches: AttendanceSyncBatch[] };
export type AttendanceSyncBatchResponse = { success: boolean; attendanceSyncBatch: AttendanceSyncBatch };
export type AttendancePunchesResponse = {
  success: boolean;
  attendancePunches: AttendancePunch[];
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
  };
};
export type AttendancePunchResponse = { success: boolean; attendancePunch: AttendancePunch };
export type ManualPunchRequestResponse = { success: boolean; manualPunchRequest: ManualPunchRequest };
export type ManualPunchRequestsResponse = { success: boolean; manualPunchRequests: ManualPunchRequest[] };
export type ManualPunchRequestActionResponse = {
  success: boolean;
  manualPunchRequest: ManualPunchRequest;
  attendancePunch: AttendancePunch | null;
};
export type AttendanceDailyRecordsResponse = { success: boolean; attendanceDailyRecords: AttendanceDailyRecord[] };
export type AttendanceDailyRecordResponse = { success: boolean; attendanceDailyRecord: AttendanceDailyRecord };
export type GenerateAttendanceDailyRecordsResponse = {
  success: boolean;
  generated: number;
  attendanceDailyRecords: AttendanceDailyRecord[];
};

export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LeaveBalanceTransactionType = 'INITIAL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'DEDUCTION' | 'REVERSAL' | 'ADJUSTMENT';

export type LeaveFiscalYear = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeaveType = {
  id: string;
  code: string;
  nameEn: string;
  nameAm: string | null;
  description: string | null;
  deductsAnnualBalance: boolean;
  requiresBalance: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type LeaveBalance = {
  id: string;
  employeeId: string;
  fiscalYearId: string;
  employmentTypeSnapshot: EmploymentType;
  opening: string;
  transferredIn: string;
  used: string;
  available: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
  fiscalYear?: LeaveFiscalYear | null;
};

export type LeaveBalanceTransaction = {
  id: string;
  leaveBalanceId: string;
  employeeId: string;
  fiscalYearId: string;
  leaveRequestId: string | null;
  linkedTransactionId: string | null;
  type: LeaveBalanceTransactionType;
  days: string;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type LeaveRequest = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fiscalYearId: string | null;
  startDate: string;
  endDate: string;
  requestedDays: string;
  reason: string;
  status: LeaveRequestStatus;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
  leaveType?: LeaveType | null;
  fiscalYear?: LeaveFiscalYear | null;
};

export type CreateLeaveFiscalYearInput = {
  name: string;
  startsAt: string;
  endsAt: string;
  isActive?: boolean;
};

export type UpdateLeaveFiscalYearInput = Partial<CreateLeaveFiscalYearInput> & {
  fiscalYearId: string;
};

export type CreateLeaveTypeInput = {
  code: string;
  nameEn: string;
  nameAm?: string | null;
  description?: string | null;
  deductsAnnualBalance?: boolean;
  requiresBalance?: boolean;
  isActive?: boolean;
};

export type UpdateLeaveTypeInput = Partial<CreateLeaveTypeInput> & {
  leaveTypeId: string;
};

export type UpsertLeaveBalanceInput = {
  employeeId: string;
  fiscalYearId: string;
  opening: string | number;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type BulkUpsertLeaveBalancesInput = {
  fiscalYearId: string;
  balances: Array<{
    employeeId: string;
    opening: string | number;
  }>;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type TransferLeaveBalanceInput = {
  employeeId: string;
  fromFiscalYearId: string;
  toFiscalYearId: string;
  days: string | number;
  approvedBy?: string | null;
  note?: string | null;
};

export type CreateLeaveRequestInput = {
  employeeId: string;
  leaveTypeId: string;
  fiscalYearId?: string | null;
  startDate: string;
  endDate: string;
  reason: string;
  requestedBy?: string | null;
};

export type ChangeLeaveRequestStatusInput = {
  status: Exclude<LeaveRequestStatus, 'PENDING'>;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
};

export type LeaveFiscalYearsResponse = { success: boolean; leaveFiscalYears: LeaveFiscalYear[] };
export type LeaveFiscalYearResponse = { success: boolean; leaveFiscalYear: LeaveFiscalYear };
export type LeaveTypesResponse = { success: boolean; leaveTypes: LeaveType[] };
export type LeaveTypeResponse = { success: boolean; leaveType: LeaveType };
export type LeaveBalancesResponse = { success: boolean; leaveBalances: LeaveBalance[] };
export type LeaveBalanceResponse = { success: boolean; leaveBalance: LeaveBalance };
export type LeaveBalanceTransferResponse = {
  success: boolean;
  fromBalance: LeaveBalance;
  toBalance: LeaveBalance;
  transactions: LeaveBalanceTransaction[];
};
export type LeaveRequestsResponse = { success: boolean; leaveRequests: LeaveRequest[] };
export type LeaveRequestResponse = { success: boolean; leaveRequest: LeaveRequest };
