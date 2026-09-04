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

export type WorkScheduleDayWithShift = WorkScheduleDay & {
  shift?: Shift | null;
};

export type WorkScheduleWithDays = WorkSchedule & {
  days?: WorkScheduleDayWithShift[];
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

export type TemporaryDepartmentAssignment = {
  id: string;
  employeeId: string;
  sourceDepartmentId: string;
  targetDepartmentId: string;
  effectiveFrom: string;
  effectiveTo: string;
  reason: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
  sourceDepartment?: Department | null;
  targetDepartment?: Department | null;
  creator?: unknown | null;
};

export type CreateTemporaryDepartmentAssignmentInput = {
  employeeId: string;
  targetDepartmentId: string;
  effectiveFrom: string;
  effectiveTo: string;
  reason: string;
};

export type UpdateTemporaryDepartmentAssignmentInput = Partial<Omit<CreateTemporaryDepartmentAssignmentInput, 'employeeId'>> & {
  temporaryDepartmentAssignmentId: string;
};

export type BiometricExemptionTargetType = 'EMPLOYEE' | 'POSITION';
export type BiometricExemptionStatus = 'PENDING_SUPERVISOR' | 'APPROVED' | 'REJECTED' | 'INACTIVE';
export type HolidayType = 'PUBLIC_HOLIDAY' | 'INSTITUTION_OFF_DAY';
export type NotificationChannel = 'EMAIL' | 'SMS';
export type NotificationStatus = 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';

export type BiometricExemption = {
  id: string;
  employeeId: string | null;
  positionId: string | null;
  targetType: BiometricExemptionTargetType;
  reason: string;
  supportingEvidenceName: string | null;
  supportingEvidenceUrl: string | null;
  supportingEvidenceMimeType: string | null;
  supportingEvidenceSize: number | null;
  status: BiometricExemptionStatus;
  isActive: boolean;
  requestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
  position?: Position | null;
};

export type Holiday = {
  id: string;
  nameEn: string;
  nameAm: string | null;
  type: HolidayType;
  durationDays: string;
  startDate: string;
  endDate: string;
  description: string | null;
  isActive: boolean;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationLog = {
  id: string;
  eventType: string;
  channel: NotificationChannel;
  status: NotificationStatus;
  recipientUserId: string | null;
  recipientEmployeeId: string | null;
  recipientName: string | null;
  destination: string | null;
  subject: string | null;
  message: string;
  locale: string;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  metadata: Record<string, unknown> | null;
  attempts: number;
  lastAttemptAt: string | null;
  nextAttemptAt: string | null;
  providerMessageId: string | null;
  providerResponse: Record<string, unknown> | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
  recipientEmployee?: Employee | null;
  recipientUser?: { id: string; name: string; email: string } | null;
};

export type NotificationLogFilters = {
  channel?: NotificationChannel | '';
  status?: NotificationStatus | '';
  eventType?: string;
  recipient?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

export type LeaveRequestView = 'self' | 'approvals' | 'authorizations';
export type LeaveBalanceView = 'self' | 'approvals' | 'authorizations' | 'management';

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

export type SupervisorDelegation = {
  id: string;
  supervisorUserId: string;
  supervisorEmployeeId: string;
  delegateUserId: string;
  delegateEmployeeId: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  revokedBy: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  supervisorUser?: unknown | null;
  supervisorEmployee?: Employee | null;
  delegateUser?: unknown | null;
  delegateEmployee?: Employee | null;
};

export type CreateSupervisorDelegationInput = {
  delegateEmployeeId: string;
  startsAt: string;
  endsAt: string;
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
  employee?: Employee;
  workSchedule?: WorkSchedule;
};

export type DashboardEmployeeWorkSchedule = Omit<EmployeeWorkSchedule, 'workSchedule'> & {
  workSchedule?: WorkScheduleWithDays | null;
};

export type BiometricDeviceType = 'BIOMETRIC' | 'RFID' | 'FACE_RECOGNITION' | 'MOBILE' | 'WEB';
export type ConnectionType = 'TCP_IP' | 'USB' | 'WIFI' | 'API';
export type DeviceIntegrationMode = 'PUSH_ADMS' | 'TCP_PULL' | 'HYBRID' | 'MANUAL_ONLY' | 'DISABLED';
export type DeviceHealthStatus = 'ONLINE' | 'OFFLINE' | 'UNKNOWN' | 'ERROR';
export type BiometricProvisioningRole = 'ENROLLMENT_SOURCE' | 'TARGET';
export type BiometricProvisioningMode = 'FULL_SYNC' | 'EMPLOYEE_UPSERT' | 'EMPLOYEE_REMOVE';
export type BiometricProvisioningJobStatus = 'QUEUED' | 'RUNNING' | 'PREVIEW_READY' | 'WAITING_CONFIRMATION' | 'COMPLETED' | 'PARTIAL' | 'FAILED' | 'CANCELED';
export type SyncStatus = 'STARTED' | 'COMPLETED' | 'FAILED' | 'PARTIAL';
export type PunchType = 'IN' | 'OUT' | 'BREAK_IN' | 'BREAK_OUT' | 'UNKNOWN';
export type PunchSource = 'DEVICE' | 'MANUAL' | 'IMPORT' | 'MOBILE' | 'WEB';
export type AttendanceDailyRecordStatus = 'PENDING_SUPERVISOR' | 'RETURNED' | 'SUPERVISOR_APPROVED' | 'HR_APPROVED';
export type IfmisExportStatus = 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
export type IfmisReadinessIssueCode = 'MISSING_SCHEDULE' | 'INVALID_SCHEDULE' | 'MISSING_RECORD' | 'NOT_HR_APPROVED' | 'DUPLICATE_NAME';

export type IfmisAttendanceRow = {
  employeeId: string;
  ifmisNo: number | null;
  nationalId: string | null;
  orgId: string | null;
  firstName: string;
  fatherName: string | null;
  grandName: string;
  firstNameAmharic: string | null;
  fatherNameAmharic: string | null;
  grandNameAmharic: string | null;
  absenteeism: number;
  late: number;
  currentStatus: string;
  approved: 'YES';
  payMonth: number;
  payYear: number;
};

export type IfmisReadinessIssue = {
  code: IfmisReadinessIssueCode;
  employeeId: string;
  employeeName: string;
  date: string | null;
  message: string;
};

export type IfmisExportBatch = {
  id: string;
  payMonth: number;
  payYear: number;
  status: IfmisExportStatus;
  recordCount: number;
  pushedBy: string;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
};

export type IfmisAttendancePreviewResponse = {
  success: boolean;
  ready: boolean;
  rows: IfmisAttendanceRow[];
  issues: IfmisReadinessIssue[];
  batches: IfmisExportBatch[];
};

export type IfmisAttendancePushResponse = {
  success: boolean;
  batch: IfmisExportBatch;
};
export type ManualPunchRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PENDING_HR_REVIEW' | 'HR_REVIEWED' | 'HR_REJECTED' | 'SUPERVISOR_APPROVED' | 'SUPERVISOR_REJECTED';
export type OvertimeRequestStatus = 'ASSIGNED' | 'APPROVED' | 'REJECTED';
export type OvertimeAttendanceCoverage = 'UPCOMING' | 'NONE' | 'PARTIAL' | 'COVERED';
export type TimeOperationSeverity = 'critical' | 'warning' | 'info' | 'success';
export type TimeOperationStatus = 'CLEAR' | 'WATCH' | 'ACTION_REQUIRED';
export type TimeOperationType = 'MANUAL_PUNCH_APPROVAL' | 'LEAVE_REQUEST_APPROVAL' | 'UNPROCESSED_PUNCHES' | 'DEVICE_HEALTH' | 'SYNC_FAILURE' | 'DEVICE_SETUP' | 'ALL_CLEAR';

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
  communicationKeyConfigured: boolean;
  serialNumber: string | null;
  model: string | null;
  manufacturer: string | null;
  firmwareVersion: string | null;
  platformVersion: string | null;
  fingerprintAlgorithm: string | null;
  provisioningRole: BiometricProvisioningRole;
  provisioningEnabled: boolean;
  lastProvisioningAt: string | null;
  lastProvisioningStatus: string | null;
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

export type BiometricProvisioningDeviceResult = {
  id: string;
  jobId: string;
  deviceId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  addedUsers: number;
  updatedUsers: number;
  removedUsers: number;
  missingTemplates: number;
  uidConflicts: number;
  differences: Record<string, unknown> | null;
  errorMessage: string | null;
  attempts: number;
  startedAt: string | null;
  completedAt: string | null;
  device?: BiometricDevice | null;
};

export type BiometricProvisioningJob = {
  id: string;
  previewJobId: string | null;
  sourceDeviceId: string;
  mode: BiometricProvisioningMode;
  status: BiometricProvisioningJobStatus;
  isPreview: boolean;
  requestedEmployeeIds: string[];
  requestedTargetDeviceIds: string[];
  summary: Record<string, unknown> | null;
  errorMessage: string | null;
  requestedBy: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  sourceDevice?: BiometricDevice | null;
  deviceResults?: BiometricProvisioningDeviceResult[];
};

export type BiometricDeviceConnectionTest = {
  success: boolean;
  message: string;
  testedAt: string;
  latencyMs: number;
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
  supervisorDelegationId?: string | null;
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
  holidayId: string | null;
  holidayDays: string;
  isHoliday: boolean;
  payableDays: string;
  absenceDays: string;
  overtimeMinutes: number;
  overtimeHours: string;
  overtimeDays: string;
  isBiometricExempt: boolean;
  payrollNote: string | null;
  status: AttendanceDailyRecordStatus;
  supervisorApprovedBy: string | null;
  supervisorApprovedAt: string | null;
  supervisorDelegationId?: string | null;
  hrApprovedBy: string | null;
  hrApprovedAt: string | null;
  returnedBy: string | null;
  returnedAt: string | null;
  returnReason: string | null;
  payrollReadyAt: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
  temporaryDepartmentAssignment?: TemporaryDepartmentAssignment | null;
  effectiveDepartment?: Department | null;
  firstPunch?: AttendancePunch | null;
  lastPunch?: AttendancePunch | null;
  holiday?: Holiday | null;
};

export type CreateBiometricExemptionInput = {
  targetType: BiometricExemptionTargetType;
  targetId: string;
  reason: string;
  supportingEvidenceName?: string | null;
  supportingEvidenceUrl?: string | null;
  supportingEvidenceMimeType?: string | null;
  supportingEvidenceSize?: number | null;
  isActive?: boolean;
  requestedBy?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type UpdateBiometricExemptionInput = Partial<CreateBiometricExemptionInput> & {
  biometricExemptionId: string;
};

export type ChangeBiometricExemptionStatusInput = {
  biometricExemptionId: string;
  status: Extract<BiometricExemptionStatus, 'APPROVED' | 'REJECTED'>;
  rejectionReason?: string | null;
};

export type CreateHolidayInput = {
  nameEn: string;
  nameAm?: string | null;
  type: HolidayType;
  durationDays?: string | number;
  startDate: string;
  endDate: string;
  description?: string | null;
  isActive?: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
};

export type UpdateHolidayInput = Partial<CreateHolidayInput> & {
  holidayId: string;
};

export type ManualPunchRequest = {
  id: string;
  employeeId: string;
  requestedPunchTime: string;
  requestedPunchType: PunchType;
  reason: string;
  supportingDocumentName: string | null;
  supportingDocumentUrl: string | null;
  supportingDocumentMimeType: string | null;
  supportingDocumentSize: number | null;
  status: ManualPunchRequestStatus;
  requestedBy: string;
  hrReviewedBy: string | null;
  hrReviewedAt: string | null;
  hrReviewNote: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  supervisorDelegationId?: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
};

export type OvertimeAttendancePunch = {
  id: string;
  punchTime: string;
  punchType: string;
  source: string;
};

export type OvertimeAttendanceEvidence = {
  coverage: OvertimeAttendanceCoverage;
  assignedMinutes: number;
  overlapMinutes: number;
  checkInAt: string | null;
  checkOutAt: string | null;
  punches: OvertimeAttendancePunch[];
};

export type OvertimeRequest = {
  id: string;
  employeeId: string;
  attendanceDailyRecordId: string | null;
  overtimeDate: string;
  startAt: string;
  endAt: string;
  requestedMinutes: number;
  approvedMinutes: number;
  overtimeDays: string;
  reason: string;
  status: OvertimeRequestStatus;
  requestedBy: string;
  requestedSupervisorDelegationId?: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  supervisorDelegationId?: string | null;
  payrollNote: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
  attendanceDailyRecord?: AttendanceDailyRecord | null;
  attendanceEvidence?: OvertimeAttendanceEvidence | null;
};

export type TimeOperationItem = {
  id: string;
  type: TimeOperationType;
  severity: TimeOperationSeverity;
  title: string;
  description: string;
  count: number;
  actionLabel: string;
  actionHref: string;
  occurredAt: string | null;
  metadata?: Record<string, unknown>;
};

export type TimeOperationsSummary = {
  generatedAt: string;
  status: TimeOperationStatus;
  headline: string;
  counts: {
    pendingManualPunchRequests: number;
    pendingLeaveRequests: number;
    unprocessedAttendancePunches: number;
    criticalDeviceIssues: number;
    unknownDevices: number;
    syncFailures: number;
    deviceSetupNeeded: number;
    totalOpenItems: number;
  };
  items: TimeOperationItem[];
};

export type DashboardRole = 'SUPER_ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'SETUP_REQUIRED';

export type DashboardMetric = {
  id: string;
  label: string;
  value: string | number;
  description: string;
  href?: string;
};

export type DashboardQuickAction = {
  label: string;
  description: string;
  href: string;
};

export type DashboardPlaceholder = {
  id: string;
  title: string;
  description: string;
  isPreview: boolean;
};

export type EmployeeTodayAttendance = {
  date: string;
  checkIn: AttendancePunch | null;
  checkOut: AttendancePunch | null;
  workingMinutes: number;
  workingHours: number;
};

export type DashboardAnnouncement = {
  id: string;
  title: string;
  body: string;
  publishedAt: string | null;
};

export type DashboardSummary = {
  generatedAt: string | null;
  role: DashboardRole;
  setupRequired: boolean;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    roles: string[];
  };
  employee: Employee | null;
  currentAnnualLeaveBalance: LeaveBalance | null;
  metrics: DashboardMetric[];
  quickActions: DashboardQuickAction[];
  sections: {
    superAdmin?: {
      deviceHealth: {
        total: number;
        online: number;
        offline: number;
        error: number;
        unknown: number;
      };
      pendingManualPunchRequests: number;
      unprocessedPunches: number;
      timeOperations: TimeOperationsSummary;
    };
    manager?: {
      directReportsCount: number;
      directReports: Employee[];
      pendingManualPunchRequests: ManualPunchRequest[];
      pendingLeaveRequests: LeaveRequest[];
      recentTeamPunches: AttendancePunch[];
      teamScheduleCoverage: DashboardPlaceholder;
      attendanceExceptions: DashboardPlaceholder;
    };
    employee?: {
      profile: Employee;
      latestWorkSchedule: DashboardEmployeeWorkSchedule | null;
      recentPunches: AttendancePunch[];
      todayPunches: AttendancePunch[];
      manualPunchRequests: ManualPunchRequest[];
      leaveRequests: LeaveRequest[];
      annualLeaveBalances: LeaveBalance[];
      todayAttendance: EmployeeTodayAttendance;
      announcements: DashboardAnnouncement[];
    };
    setup?: {
      title: string;
      description: string;
    };
  };
  placeholders: DashboardPlaceholder[];
};

export type ExecutiveDashboardSeverity = 'critical' | 'warning' | 'info';

export type AttendanceReportingDisciplineSummary = {
  totalRecords: number;
  reportedRecords: number;
  adjustedRecords: number;
  adjustmentCount: number;
  hrApprovedRecords: number;
  pendingSupervisorRecords: number;
  returnedRecords: number;
  reportingRate: number;
  correctionRate: number;
  hrReadyRate: number;
  departmentBreakdown: Array<{
    departmentId: string | null;
    department: string;
    totalRecords: number;
    reportedRecords: number;
    adjustedRecords: number;
    adjustmentCount: number;
    hrApprovedRecords: number;
    reportingRate: number;
    correctionRate: number;
    hrReadyRate: number;
  }>;
};

export type ExecutiveDashboardSummary = {
  generatedAt: string | null;
  date: string;
  month: string;
  workforceStatus: {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    onApprovedLeave: number;
    lateArrivals: number;
    workingRemotely: number;
    officialAssignment: number;
    attendanceRate: number;
  };
  workforceDistribution: Array<{
    id: string;
    label: string;
    count: number;
    percentage: number;
  }>;
  departmentAttendanceRanking: Array<{
    department: string;
    attendanceRate: number;
    present: number;
    totalEmployees: number;
  }>;
  compoundStatus: {
    currentlyInside: number;
    checkedOut: number;
    notYetArrived: number;
  };
  liveAttendanceTimeline: Array<{
    time: string;
    count: number;
  }>;
  leaveSummary: Array<{
    id: string;
    label: string;
    count: number;
  }>;
  hrPerformance: {
    pendingHrApproval: number;
    pendingLeaveApproval: number;
    averageApprovalTimeHours: number;
    correctionsReturned: number;
    payrollReadyPercent: number;
  };
  attendanceReportingDiscipline: AttendanceReportingDisciplineSummary;
  departmentPerformance: Array<{
    departmentId: string | null;
    department: string;
    totalEmployees: number;
    present: number;
    absent: number;
    lateEmployees: number;
    pendingApprovals: number;
    leaveRate: number;
    attendanceRate: number;
    trend: 'UP' | 'DOWN';
  }>;
  monthlyAttendanceTrend: Array<{
    month: string;
    present: number;
    attendanceRate: number;
  }>;
  attendanceExceptions: Array<{
    id: string;
    severity: ExecutiveDashboardSeverity;
    title: string;
    count: number;
    description: string;
  }>;
  deviceHealth: {
    total: number;
    online: number;
    offline: number;
    error: number;
    unknown: number;
  };
  executiveAlerts: Array<{
    id: string;
    severity: ExecutiveDashboardSeverity;
    title: string;
    description: string;
  }>;
};

export type HrDashboardSeverity = 'critical' | 'warning' | 'info';

export type HrDashboardWidget = {
  id: string;
  label: string;
  count: number;
  href: string;
};

export type HrDashboardSummary = {
  generatedAt: string | null;
  date: string;
  currentAnnualLeaveBalance: LeaveBalance | null;
  attendanceReportingDiscipline: AttendanceReportingDisciplineSummary;
  widgets: {
    pendingApprovals: HrDashboardWidget;
    correctionsReturned: HrDashboardWidget;
    manualAttendanceRequests: HrDashboardWidget;
    employeesOnLeave: HrDashboardWidget;
    employeesWithoutPunch: HrDashboardWidget;
    missingCheckout: HrDashboardWidget;
    lateEmployees: HrDashboardWidget;
    attendanceExceptions: HrDashboardWidget;
    upcomingLeave: HrDashboardWidget;
    employeesNearLeaveExpiry: HrDashboardWidget;
    devicesOffline: HrDashboardWidget;
    synchronizationStatus: HrDashboardWidget;
  };
  details: {
    pendingManualRequests: ManualPunchRequest[];
    pendingLeaveRequests: LeaveRequest[];
    returnedCorrections: ManualPunchRequest[];
    employeesOnLeave: LeaveRequest[];
    employeesWithoutPunch: Employee[];
    missingCheckoutEmployees: Employee[];
    lateEmployees: Employee[];
    attendanceExceptions: Array<{
      id: string;
      severity: HrDashboardSeverity;
      title: string;
      count: number;
      description: string;
    }>;
    upcomingLeave: LeaveRequest[];
    employeesNearLeaveExpiry: LeaveBalance[];
    devicesOffline: BiometricDevice[];
    synchronizationStatus: {
      latest: AttendanceSyncBatch | null;
      recent: AttendanceSyncBatch[];
      counts: {
        started: number;
        completed: number;
        failed: number;
        partial: number;
      };
      openIssues: number;
    };
    unprocessedPunches: AttendancePunch[];
  };
};

export type DepartmentHeadDashboardWidget = {
  id: string;
  label: string;
  count: number;
  href: string;
};

export type DepartmentHeadDashboardSummary = {
  generatedAt: string | null;
  date: string;
  department: Department | null;
  supervisor: Employee;
  currentAnnualLeaveBalance: LeaveBalance | null;
  widgets: {
    todaysStaff: DepartmentHeadDashboardWidget;
    present: DepartmentHeadDashboardWidget;
    absent: DepartmentHeadDashboardWidget;
    leave: DepartmentHeadDashboardWidget;
    late: DepartmentHeadDashboardWidget;
    pendingAttendance: DepartmentHeadDashboardWidget;
    pendingLeave: DepartmentHeadDashboardWidget;
    pendingCorrections: DepartmentHeadDashboardWidget;
  };
  details: {
    todaysStaff: Employee[];
    presentEmployees: Employee[];
    absentEmployees: Employee[];
    employeesOnLeave: LeaveRequest[];
    lateEmployees: Employee[];
    pendingAttendance: AttendancePunch[];
    pendingLeave: LeaveRequest[];
    pendingCorrections: ManualPunchRequest[];
  };
};

export type DepartmentsResponse = {
  success: boolean;
  departments: Department[];
};
export type DepartmentResponse = { success: boolean; department: Department };
export type PositionsResponse = { success: boolean; positions: Position[] };
export type PositionResponse = { success: boolean; position: Position };
export type ShiftsResponse = { success: boolean; shifts: Shift[] };
export type ShiftResponse = { success: boolean; shift: Shift };
export type ShiftSegmentsResponse = {
  success: boolean;
  shiftSegments: ShiftSegment[];
};
export type ShiftSegmentResponse = {
  success: boolean;
  shiftSegment: ShiftSegment;
};
export type ShiftBreaksResponse = {
  success: boolean;
  shiftBreaks: ShiftBreak[];
};
export type ShiftBreakResponse = { success: boolean; shiftBreak: ShiftBreak };
export type WorkSchedulesResponse = {
  success: boolean;
  workSchedules: WorkSchedule[];
};
export type WorkScheduleResponse = {
  success: boolean;
  workSchedule: WorkSchedule;
};
export type WorkScheduleDaysResponse = {
  success: boolean;
  days: WorkScheduleDay[];
};
export type WorkScheduleDayResponse = {
  success: boolean;
  day: WorkScheduleDay;
};
export type EmployeesResponse = { success: boolean; employees: Employee[] };
export type EmployeesPaginatedResponse = {
  success: boolean;
  employees: Employee[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
  };
};
export type EmployeeResponse = { success: boolean; employee: Employee };
export type PermanentEmployeeImportRowError = {
  rowNumber: number;
  employeeCode: string | null;
  errors: string[];
};
export type PermanentEmployeeImportResponse = {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  totalRows: number;
  errors: PermanentEmployeeImportRowError[];
  employees: Employee[];
};
export type EmployeeSupervisorsResponse = {
  success: boolean;
  supervisors: EmployeeSupervisor[];
};
export type EmployeeSupervisorResponse = {
  success: boolean;
  supervisor: EmployeeSupervisor;
};
export type SupervisorDelegationsResponse = {
  success: boolean;
  supervisorDelegations: SupervisorDelegation[];
};
export type SupervisorDelegationResponse = {
  success: boolean;
  supervisorDelegation: SupervisorDelegation;
};
export type TemporaryDepartmentAssignmentsResponse = {
  success: boolean;
  temporaryDepartmentAssignments: TemporaryDepartmentAssignment[];
};
export type TemporaryDepartmentAssignmentResponse = {
  success: boolean;
  temporaryDepartmentAssignment: TemporaryDepartmentAssignment;
};
export type EmployeeWorkSchedulesResponse = {
  success: boolean;
  employeeWorkSchedules: EmployeeWorkSchedule[];
};
export type EmployeeWorkScheduleResponse = {
  success: boolean;
  employeeWorkSchedule: EmployeeWorkSchedule;
};
export type BiometricDevicesResponse = {
  success: boolean;
  biometricDevices: BiometricDevice[];
};
export type BiometricDeviceResponse = {
  success: boolean;
  biometricDevice: BiometricDevice;
};
export type BiometricProvisioningJobResponse = {
  success: boolean;
  biometricProvisioningJob: BiometricProvisioningJob;
};
export type BiometricProvisioningJobsResponse = {
  success: boolean;
  biometricProvisioningJobs: BiometricProvisioningJob[];
};
export type BiometricExemptionsResponse = {
  success: boolean;
  biometricExemptions: BiometricExemption[];
};
export type BiometricExemptionResponse = {
  success: boolean;
  biometricExemption: BiometricExemption;
};
export type HolidaysResponse = { success: boolean; holidays: Holiday[] };
export type HolidayResponse = { success: boolean; holiday: Holiday };
export type NotificationLogsResponse = {
  success: boolean;
  notificationLogs: NotificationLog[];
};
export type BiometricDeviceConnectionTestResponse = {
  success: boolean;
  connectionTest: BiometricDeviceConnectionTest;
  biometricDevice: BiometricDevice;
};
export type AttendanceSyncBatchesResponse = {
  success: boolean;
  attendanceSyncBatches: AttendanceSyncBatch[];
};
export type AttendanceSyncBatchResponse = {
  success: boolean;
  attendanceSyncBatch: AttendanceSyncBatch;
};
export type AttendancePunchesResponse = {
  success: boolean;
  attendancePunches: AttendancePunch[];
  pagination?: {
    total: number;
    page: number;
    pageSize: number;
  };
};
export type AttendancePunchResponse = {
  success: boolean;
  attendancePunch: AttendancePunch;
};
export type AttendanceDailyRecordsResponse = {
  success: boolean;
  attendanceDailyRecords: AttendanceDailyRecord[];
};
export type AttendanceDailyRecordResponse = {
  success: boolean;
  attendanceDailyRecord: AttendanceDailyRecord;
};
export type GenerateAttendanceDailyRecordsResponse = {
  success: boolean;
  generated: number;
  attendanceDailyRecords: AttendanceDailyRecord[];
};
export type ManualPunchRequestsResponse = {
  success: boolean;
  manualPunchRequests: ManualPunchRequest[];
};
export type ManualPunchRequestResponse = {
  success: boolean;
  manualPunchRequest: ManualPunchRequest;
};
export type ManualPunchRequestActionResponse = {
  success: boolean;
  manualPunchRequest: ManualPunchRequest;
  attendancePunch: AttendancePunch | null;
};
export type OvertimeRequestsResponse = {
  success: boolean;
  overtimeRequests: OvertimeRequest[];
};
export type OvertimeRequestResponse = {
  success: boolean;
  overtimeRequest: OvertimeRequest;
};
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'AUTHORIZED' | 'REJECTED' | 'AUTHORIZATION_REJECTED';
export type AnnualLeaveRequestDateStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type LeaveBalanceTransactionType = 'INITIAL' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'DEDUCTION' | 'RESERVATION' | 'CONSUMPTION' | 'REVERSAL' | 'ADJUSTMENT';
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
  allowedDays: string | null;
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
  reserved: string;
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
export type AnnualLeaveRequestDate = {
  id: string;
  leaveRequestId: string;
  date: string;
  requestedDayValue: string;
  approvedDayValue: string | null;
  status: AnnualLeaveRequestDateStatus;
  source: 'ORIGINAL' | 'CONTINUATION';
  utilizationStatus: 'SCHEDULED' | 'CONSUMED' | 'INTERRUPTED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
};
export type LeaveInterruptionDate = {
  id: string;
  leaveInterruptionId: string;
  kind: 'INTERRUPTED_PROPOSED' | 'CONTINUATION_PROPOSED' | 'INTERRUPTED_APPROVED' | 'CONTINUATION_APPROVED';
  date: string;
  dayValue: string;
  createdAt: string;
};
export type LeaveInterruption = {
  id: string;
  leaveRequestId: string;
  reason: string;
  recallAuthority: string;
  authorityUserId: string | null;
  actualWorkStartDate: string;
  actualWorkEndDate: string;
  status: LeaveRequestStatus;
  requestedBy: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  authorizedBy: string | null;
  authorizedAt: string | null;
  authorizationRejectedBy: string | null;
  authorizationRejectedAt: string | null;
  authorizationRejectionReason: string | null;
  supervisorDelegationId?: string | null;
  createdAt: string;
  updatedAt: string;
  dates: LeaveInterruptionDate[];
};
export type LeaveRequest = {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fiscalYearId: string | null;
  startDate: string;
  endDate: string;
  requestedDays: string;
  approvedDays: string;
  consumedDays: string;
  scheduledDays: string;
  interruptedDays: string;
  remainingDays: string;
  isPartialApproval: boolean;
  reason: string;
  status: LeaveRequestStatus;
  requestedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  authorizedBy: string | null;
  authorizedAt: string | null;
  authorizationRejectedBy: string | null;
  authorizationRejectedAt: string | null;
  authorizationRejectionReason: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectionReason: string | null;
  supervisorDelegationId?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: Employee | null;
  leaveType?: LeaveType | null;
  fiscalYear?: LeaveFiscalYear | null;
  annualLeaveDates?: AnnualLeaveRequestDate[];
  interruptions?: LeaveInterruption[];
};
export type LeaveFiscalYearsResponse = {
  success: boolean;
  leaveFiscalYears: LeaveFiscalYear[];
};
export type LeaveFiscalYearResponse = {
  success: boolean;
  leaveFiscalYear: LeaveFiscalYear;
};
export type LeaveTypesResponse = { success: boolean; leaveTypes: LeaveType[] };
export type LeaveTypeResponse = { success: boolean; leaveType: LeaveType };
export type LeaveBalancesResponse = {
  success: boolean;
  leaveBalances: LeaveBalance[];
};
export type LeaveBalanceResponse = {
  success: boolean;
  leaveBalance: LeaveBalance;
};
export type LeaveBalanceTransferResponse = {
  success: boolean;
  fromBalance: LeaveBalance;
  toBalance: LeaveBalance;
  transactions: LeaveBalanceTransaction[];
};
export type LeaveRequestsResponse = {
  success: boolean;
  leaveRequests: LeaveRequest[];
};
export type LeaveRequestResponse = {
  success: boolean;
  leaveRequest: LeaveRequest;
};
export type TimeOperationsSummaryResponse = {
  success: boolean;
  timeOperations: TimeOperationsSummary;
};
export type DashboardSummaryResponse = {
  success: boolean;
  dashboard: DashboardSummary;
};
export type ExecutiveDashboardSummaryResponse = {
  success: boolean;
  executiveDashboard: ExecutiveDashboardSummary;
};
export type HrDashboardSummaryResponse = {
  success: boolean;
  hrDashboard: HrDashboardSummary;
};
export type DepartmentHeadDashboardSummaryResponse = {
  success: boolean;
  departmentHeadDashboard: DepartmentHeadDashboardSummary;
};

export type ReportKey = 'attendance-daily' | 'attendance-punches' | 'late-attendance' | 'overtime' | 'leave-balances' | 'leave-requests' | 'employees' | 'device-sync';

export type ReportColumn = {
  key: string;
  label: string;
};

export type ReportResponse = {
  success: boolean;
  report: {
    key: ReportKey;
    title: string;
    generatedAt: string;
    columns: ReportColumn[];
    rows: Record<string, string | number | boolean | null>[];
    summary: {
      totalRows: number;
    };
  };
};

export type CreateDepartmentInput = {
  nameEn: string;
  nameAm?: string | null;
  code?: string | null;
  parentDepartmentId?: string | null;
  isActive?: boolean;
};

export type UpdateDepartmentInput = Partial<CreateDepartmentInput> & {
  departmentId: string;
};

export type CreatePositionInput = {
  nameEn: string;
  nameAm?: string | null;
  code?: string | null;
  isActive?: boolean;
};

export type UpdatePositionInput = Partial<CreatePositionInput> & {
  positionId: string;
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

export type UpdateShiftSegmentInput = Partial<CreateShiftSegmentInput> & {
  shiftSegmentId: string;
};

export type CreateShiftBreakInput = {
  shiftId: string;
  nameEn: string;
  nameAm?: string | null;
  startTime: string;
  endTime: string;
  isPaid?: boolean;
  isActive?: boolean;
};

export type UpdateShiftBreakInput = Partial<CreateShiftBreakInput> & {
  shiftBreakId: string;
};

export type CreateWorkScheduleInput = {
  nameEn: string;
  nameAm?: string | null;
  description?: string | null;
  isDefault?: boolean;
  isActive?: boolean;
};

export type UpdateWorkScheduleInput = Partial<CreateWorkScheduleInput> & {
  workScheduleId: string;
};

export type CreateWorkScheduleDayInput = {
  workScheduleId: string;
  dayOfWeek: DayOfWeek;
  shiftId?: string | null;
  isOffDay?: boolean;
  isActive?: boolean;
};

export type UpdateWorkScheduleDayInput = Partial<CreateWorkScheduleDayInput> & {
  workScheduleDayId: string;
};

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

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  employeeId: string;
};

export type CreateEmployeeSupervisorInput = {
  employeeId: string;
  supervisorId: string;
  isPrimary?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string | null;
};

export type CreateEmployeeWorkScheduleInput = {
  employeeId: string;
  workScheduleId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive?: boolean;
};

export type UpdateEmployeeWorkScheduleInput = Partial<CreateEmployeeWorkScheduleInput> & {
  employeeWorkScheduleId: string;
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
  firmwareVersion?: string | null;
  platformVersion?: string | null;
  fingerprintAlgorithm?: string | null;
  provisioningRole?: BiometricProvisioningRole;
  provisioningEnabled?: boolean;
  syncIntervalMinutes?: number;
  autoSyncEnabled?: boolean;
  healthStatus?: DeviceHealthStatus;
  fallbackToPull?: boolean;
  isActive?: boolean;
};

export type UpdateBiometricDeviceInput = Partial<CreateBiometricDeviceInput> & {
  biometricDeviceId: string;
};

export type CreateBiometricProvisioningPreviewInput = {
  mode: BiometricProvisioningMode;
  employeeIds?: string[];
  targetDeviceIds?: string[];
};

export type CreateBiometricDeviceSyncInput = {
  biometricDeviceId: string;
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

export type CreateManualPunchRequestInput = {
  employeeId?: string;
  requestedPunchTime: string;
  requestedPunchType: PunchType;
  reason: string;
  supportingDocumentName?: string | null;
  supportingDocumentUrl?: string | null;
  supportingDocumentMimeType?: string | null;
  supportingDocumentSize?: number | null;
  requestedBy?: string;
};

export type ChangeManualPunchRequestStatusInput = {
  manualPunchRequestId: string;
  status: Exclude<ManualPunchRequestStatus, 'PENDING' | 'PENDING_HR_REVIEW'>;
  approvedBy?: string;
  approvedAt?: string;
  hrReviewedBy?: string;
  hrReviewedAt?: string;
  hrReviewNote?: string | null;
  rejectedBy?: string;
  rejectedAt?: string;
  rejectionReason?: string | null;
};

export type CreateOvertimeRequestInput = {
  employeeId?: string;
  employeeIds?: string[];
  overtimeDate?: string;
  startAt: string;
  endAt: string;
  reason: string;
  requestedBy?: string;
};

export type ChangeOvertimeRequestStatusInput = {
  overtimeRequestId: string;
  status: Exclude<OvertimeRequestStatus, 'ASSIGNED'>;
  approvedMinutes?: number;
  overtimeDays?: number;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string | null;
  payrollNote?: string | null;
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
  allowedDays?: string | number | null;
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
  balances: Array<{ employeeId: string; opening: string | number }>;
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
  startDate?: string;
  endDate?: string;
  annualLeaveDates?: Array<{ date: string; dayValue: string | number }>;
  reason: string;
  requestedBy?: string | null;
};

export type UpdateLeaveRequestInput = {
  leaveRequestId: string;
  fiscalYearId?: string | null;
  startDate?: string;
  endDate?: string;
  annualLeaveDates?: Array<{ date: string; dayValue: string | number }>;
  reason: string;
  updatedBy?: string | null;
};

export type ChangeLeaveRequestStatusInput = {
  leaveRequestId: string;
  status: 'APPROVED' | 'REJECTED';
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvedDates?: Array<{ date: string; dayValue: string | number }>;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
};
export type AuthorizeLeaveRequestInput = {
  leaveRequestId: string;
  status: 'AUTHORIZED' | 'AUTHORIZATION_REJECTED';
  rejectionReason?: string | null;
};
export type AuthorizeLeaveInterruptionInput = {
  leaveInterruptionId: string;
  status: 'AUTHORIZED' | 'AUTHORIZATION_REJECTED';
  rejectionReason?: string | null;
};
export type CreateLeaveInterruptionInput = {
  leaveRequestId: string;
  interruptedDates: Array<{ date: string; dayValue: string | number }>;
  continuationDates: Array<{ date: string; dayValue: string | number }>;
  reason: string;
  recallAuthority: string;
  authorityUserId?: string | null;
  requestedBy?: string | null;
};
export type ReviewLeaveInterruptionInput = {
  leaveInterruptionId: string;
  status: 'APPROVED' | 'REJECTED';
  reviewedBy?: string | null;
  interruptedDates?: Array<{ date: string; dayValue: string | number }>;
  continuationDates?: Array<{ date: string; dayValue: string | number }>;
  rejectionReason?: string | null;
};
