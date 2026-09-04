import type {
  AttendanceDailyRecordResponse,
  AttendanceDailyRecordsResponse,
  AttendancePunchesResponse,
  AttendancePunchResponse,
  AttendanceSyncBatchesResponse,
  AttendanceSyncBatchResponse,
  BiometricDeviceConnectionTestResponse,
  BiometricDeviceResponse,
  BiometricDevicesResponse,
  BiometricProvisioningJobResponse,
  BiometricProvisioningJobsResponse,
  BiometricExemptionResponse,
  BiometricExemptionsResponse,
  BulkUpsertLeaveBalancesInput,
  ChangeManualPunchRequestStatusInput,
  ChangeBiometricExemptionStatusInput,
  ChangeOvertimeRequestStatusInput,
  ChangeLeaveRequestStatusInput,
  AuthorizeLeaveInterruptionInput,
  AuthorizeLeaveRequestInput,
  CreateAttendancePunchInput,
  CreateBiometricDeviceInput,
  CreateBiometricExemptionInput,
  CreateBiometricDeviceSyncInput,
  CreateBiometricProvisioningPreviewInput,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateEmployeeSupervisorInput,
  CreateEmployeeWorkScheduleInput,
  CreateHolidayInput,
  CreatePositionInput,
  CreateSupervisorDelegationInput,
  CreateTemporaryDepartmentAssignmentInput,
  CreateShiftBreakInput,
  CreateShiftInput,
  CreateShiftSegmentInput,
  CreateWorkScheduleDayInput,
  CreateWorkScheduleInput,
  CreateManualPunchRequestInput,
  CreateOvertimeRequestInput,
  CreateLeaveFiscalYearInput,
  CreateLeaveInterruptionInput,
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  DepartmentResponse,
  DepartmentHeadDashboardSummaryResponse,
  DepartmentsResponse,
  DashboardSummaryResponse,
  EmployeeResponse,
  EmployeeSupervisorsResponse,
  EmployeeWorkScheduleResponse,
  EmployeeWorkSchedulesResponse,
  EmployeesResponse,
  EmployeesPaginatedResponse,
  ExecutiveDashboardSummaryResponse,
  HrDashboardSummaryResponse,
  IfmisAttendancePreviewResponse,
  IfmisAttendancePushResponse,
  GenerateAttendanceDailyRecordsResponse,
  HolidayResponse,
  HolidaysResponse,
  NotificationLogFilters,
  NotificationLogsResponse,
  PermanentEmployeeImportResponse,
  LeaveBalanceResponse,
  LeaveBalanceView,
  LeaveBalancesResponse,
  LeaveBalanceTransferResponse,
  LeaveFiscalYearResponse,
  LeaveFiscalYearsResponse,
  LeaveRequestResponse,
  LeaveRequestView,
  LeaveRequestsResponse,
  LeaveTypeResponse,
  LeaveTypesResponse,
  ManualPunchRequestActionResponse,
  ManualPunchRequestResponse,
  ManualPunchRequestsResponse,
  OvertimeRequestResponse,
  OvertimeRequestsResponse,
  PositionResponse,
  PositionsResponse,
  ReportKey,
  ReportResponse,
  ReviewLeaveInterruptionInput,
  ShiftBreakResponse,
  ShiftBreaksResponse,
  ShiftResponse,
  ShiftSegmentResponse,
  ShiftSegmentsResponse,
  ShiftsResponse,
  SupervisorDelegationResponse,
  SupervisorDelegationsResponse,
  TemporaryDepartmentAssignmentResponse,
  TemporaryDepartmentAssignmentsResponse,
  TimeOperationsSummaryResponse,
  TransferLeaveBalanceInput,
  UpdateDepartmentInput,
  UpdateBiometricDeviceInput,
  UpdateBiometricExemptionInput,
  UpdateEmployeeInput,
  UpdateEmployeeWorkScheduleInput,
  UpdateTemporaryDepartmentAssignmentInput,
  UpdateHolidayInput,
  UpdateLeaveFiscalYearInput,
  UpdateLeaveRequestInput,
  UpdateLeaveTypeInput,
  UpdatePositionInput,
  UpdateShiftBreakInput,
  UpdateShiftInput,
  UpdateShiftSegmentInput,
  UpdateWorkScheduleDayInput,
  UpdateWorkScheduleInput,
  UpsertLeaveBalanceInput,
  WorkScheduleDayResponse,
  WorkScheduleDaysResponse,
  WorkScheduleResponse,
  WorkSchedulesResponse,
} from '../types/core.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3012';

async function coreFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: isFormData
      ? init?.headers
      : {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.success === false) {
    throw new Error(data?.error || data?.message || data?.details || `HTTP error! status: ${response.status}`);
  }

  return data as T;
}

async function coreBlobFetch(path: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || data?.message || data?.details || `HTTP error! status: ${response.status}`);
  }

  return response.blob();
}

export const coreApi = {
  getIfmisAttendancePreview: (params: { payMonth: number; payYear: number }) => {
    const query = new URLSearchParams({
      payMonth: String(params.payMonth),
      payYear: String(params.payYear),
    });
    return coreFetch<IfmisAttendancePreviewResponse>(`/ifmis/attendance?${query.toString()}`);
  },
  pushIfmisAttendance: (params: { payMonth: number; payYear: number }) =>
    coreFetch<IfmisAttendancePushResponse>('/ifmis/attendance/push', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
  getDashboardSummary: () => coreFetch<DashboardSummaryResponse>('/dashboard/summary'),
  getExecutiveDashboardSummary: (params: { date?: string; month?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.month) query.set('month', params.month);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<ExecutiveDashboardSummaryResponse>(`/executive-dashboard/summary${suffix}`);
  },
  getHrDashboardSummary: (params: { date?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<HrDashboardSummaryResponse>(`/hr-dashboard/summary${suffix}`);
  },
  getDepartmentHeadDashboardSummary: (params: { date?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<DepartmentHeadDashboardSummaryResponse>(`/department-head-dashboard/summary${suffix}`);
  },
  getReport: (key: ReportKey, params: Record<string, string> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([paramKey, value]) => {
      if (value) query.set(paramKey, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return coreFetch<ReportResponse>(`/reports/${key}${suffix}`);
  },
  downloadReportExcel: (key: ReportKey, params: Record<string, string> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([paramKey, value]) => {
      if (value) query.set(paramKey, value);
    });
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return coreBlobFetch(`/reports/${key}/excel${suffix}`);
  },
  getDepartments: () => coreFetch<DepartmentsResponse>('/departments'),
  createDepartment: (input: CreateDepartmentInput) =>
    coreFetch<DepartmentResponse>('/departments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateDepartment: ({ departmentId, ...input }: UpdateDepartmentInput) =>
    coreFetch<DepartmentResponse>(`/departments/${departmentId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getPositions: () => coreFetch<PositionsResponse>('/positions'),
  createPosition: (input: CreatePositionInput) =>
    coreFetch<PositionResponse>('/positions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updatePosition: ({ positionId, ...input }: UpdatePositionInput) =>
    coreFetch<PositionResponse>(`/positions/${positionId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getShifts: () => coreFetch<ShiftsResponse>('/shifts'),
  getShift: (shiftId: string) => coreFetch<ShiftResponse>(`/shifts/${shiftId}`),
  createShift: (input: CreateShiftInput) =>
    coreFetch<ShiftResponse>('/shifts', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateShift: ({ shiftId, ...input }: UpdateShiftInput) =>
    coreFetch<ShiftResponse>(`/shifts/${shiftId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getShiftSegments: (shiftId: string) => coreFetch<ShiftSegmentsResponse>(`/shifts/${shiftId}/segments`),
  createShiftSegment: ({ shiftId, ...input }: CreateShiftSegmentInput) =>
    coreFetch<ShiftSegmentResponse>(`/shifts/${shiftId}/segments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateShiftSegment: ({ shiftSegmentId, ...input }: UpdateShiftSegmentInput) =>
    coreFetch<ShiftSegmentResponse>(`/shift-segments/${shiftSegmentId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getShiftBreaks: (shiftId: string) => coreFetch<ShiftBreaksResponse>(`/shifts/${shiftId}/breaks`),
  createShiftBreak: ({ shiftId, ...input }: CreateShiftBreakInput) =>
    coreFetch<ShiftBreakResponse>(`/shifts/${shiftId}/breaks`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateShiftBreak: ({ shiftBreakId, ...input }: UpdateShiftBreakInput) =>
    coreFetch<ShiftBreakResponse>(`/shift-breaks/${shiftBreakId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getWorkSchedules: () => coreFetch<WorkSchedulesResponse>('/work-schedules'),
  getWorkSchedule: (workScheduleId: string) => coreFetch<WorkScheduleResponse>(`/work-schedules/${workScheduleId}`),
  createWorkSchedule: (input: CreateWorkScheduleInput) =>
    coreFetch<WorkScheduleResponse>('/work-schedules', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateWorkSchedule: ({ workScheduleId, ...input }: UpdateWorkScheduleInput) =>
    coreFetch<WorkScheduleResponse>(`/work-schedules/${workScheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getWorkScheduleDays: (workScheduleId: string) => coreFetch<WorkScheduleDaysResponse>(`/work-schedules/${workScheduleId}/days`),
  createWorkScheduleDay: ({ workScheduleId, ...input }: CreateWorkScheduleDayInput) =>
    coreFetch<WorkScheduleDayResponse>(`/work-schedules/${workScheduleId}/days`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateWorkScheduleDay: ({ workScheduleDayId, ...input }: UpdateWorkScheduleDayInput) =>
    coreFetch<WorkScheduleDayResponse>(`/work-schedule-days/${workScheduleDayId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getHolidays: () => coreFetch<HolidaysResponse>('/holidays'),
  createHoliday: (input: CreateHolidayInput) =>
    coreFetch<HolidayResponse>('/holidays', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateHoliday: ({ holidayId, ...input }: UpdateHolidayInput) =>
    coreFetch<HolidayResponse>(`/holidays/${holidayId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getNotificationLogs: (params: NotificationLogFilters = {}) => {
    const query = new URLSearchParams();
    if (params.channel) query.set('channel', params.channel);
    if (params.status) query.set('status', params.status);
    if (params.eventType) query.set('eventType', params.eventType);
    if (params.recipient) query.set('recipient', params.recipient);
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<NotificationLogsResponse>(`/notification-logs${suffix}`);
  },
  getEmployees: () => coreFetch<EmployeesResponse>('/employees'),
  getEmployeesPaginated: (params: { page?: number; pageSize?: number; search?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.search) query.set('search', params.search);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<EmployeesPaginatedResponse>(`/employees/paginated${suffix}`);
  },
  getEmployee: (employeeId: string) => coreFetch<EmployeeResponse>(`/employees/${employeeId}`),
  createEmployee: (input: CreateEmployeeInput) =>
    coreFetch<EmployeeResponse>('/employees', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateEmployee: ({ employeeId, ...input }: UpdateEmployeeInput) =>
    coreFetch<EmployeeResponse>(`/employees/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  importPermanentEmployees: ({ file }: { file: File }) => {
    const formData = new FormData();
    formData.append('file', file);

    return coreFetch<PermanentEmployeeImportResponse>('/employees/permanent/import', {
      method: 'POST',
      body: formData,
    });
  },
  importContractEmployees: ({ file }: { file: File }) => {
    const formData = new FormData();
    formData.append('file', file);

    return coreFetch<PermanentEmployeeImportResponse>('/employees/contract/import', {
      method: 'POST',
      body: formData,
    });
  },
  getEmployeeSupervisors: (employeeId: string) => coreFetch<EmployeeSupervisorsResponse>(`/employees/${employeeId}/supervisors`),
  createEmployeeSupervisor: ({ employeeId, ...input }: CreateEmployeeSupervisorInput) =>
    coreFetch(`/employees/${employeeId}/supervisors`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getSupervisorDelegations: () => coreFetch<SupervisorDelegationsResponse>('/supervisor-delegations'),
  createSupervisorDelegation: (input: CreateSupervisorDelegationInput) =>
    coreFetch<SupervisorDelegationResponse>('/supervisor-delegations', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  revokeSupervisorDelegation: (supervisorDelegationId: string) =>
    coreFetch<SupervisorDelegationResponse>(`/supervisor-delegations/${supervisorDelegationId}/revoke`, {
      method: 'POST',
    }),
  getTemporaryDepartmentAssignments: () => coreFetch<TemporaryDepartmentAssignmentsResponse>('/temporary-department-assignments'),
  createTemporaryDepartmentAssignment: (input: CreateTemporaryDepartmentAssignmentInput) =>
    coreFetch<TemporaryDepartmentAssignmentResponse>('/temporary-department-assignments', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateTemporaryDepartmentAssignment: ({ temporaryDepartmentAssignmentId, ...input }: UpdateTemporaryDepartmentAssignmentInput) =>
    coreFetch<TemporaryDepartmentAssignmentResponse>(`/temporary-department-assignments/${temporaryDepartmentAssignmentId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deactivateTemporaryDepartmentAssignment: (temporaryDepartmentAssignmentId: string) =>
    coreFetch<TemporaryDepartmentAssignmentResponse>(`/temporary-department-assignments/${temporaryDepartmentAssignmentId}/deactivate`, {
      method: 'POST',
    }),
  getEmployeeWorkSchedules: (employeeId: string) => coreFetch<EmployeeWorkSchedulesResponse>(`/employees/${employeeId}/work-schedules`),
  getAllEmployeeWorkSchedules: () => coreFetch<EmployeeWorkSchedulesResponse>('/employees/work-schedules'),
  createEmployeeWorkSchedule: ({ employeeId, ...input }: CreateEmployeeWorkScheduleInput) =>
    coreFetch<EmployeeWorkScheduleResponse>(`/employees/${employeeId}/work-schedules`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateEmployeeWorkSchedule: ({ employeeWorkScheduleId, ...input }: UpdateEmployeeWorkScheduleInput) =>
    coreFetch<EmployeeWorkScheduleResponse>(`/employees/work-schedules/${employeeWorkScheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deleteEmployeeWorkSchedule: (employeeWorkScheduleId: string) =>
    coreFetch<{ success: boolean }>(`/employees/work-schedules/${employeeWorkScheduleId}`, {
      method: 'DELETE',
    }),
  getBiometricDevices: () => coreFetch<BiometricDevicesResponse>('/biometric-devices'),
  getBiometricExemptions: () => coreFetch<BiometricExemptionsResponse>('/biometric-exemptions'),
  createBiometricExemption: (input: CreateBiometricExemptionInput) =>
    coreFetch<BiometricExemptionResponse>('/biometric-exemptions', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateBiometricExemption: ({ biometricExemptionId, ...input }: UpdateBiometricExemptionInput) =>
    coreFetch<BiometricExemptionResponse>(`/biometric-exemptions/${biometricExemptionId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  changeBiometricExemptionStatus: ({ biometricExemptionId, ...input }: ChangeBiometricExemptionStatusInput) =>
    coreFetch<BiometricExemptionResponse>(`/biometric-exemptions/${biometricExemptionId}/status`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  deleteBiometricExemption: (biometricExemptionId: string) =>
    coreFetch<BiometricExemptionResponse>(`/biometric-exemptions/${biometricExemptionId}`, {
      method: 'DELETE',
    }),
  getBiometricDevice: (biometricDeviceId: string) => coreFetch<BiometricDeviceResponse>(`/biometric-devices/${biometricDeviceId}`),
  createBiometricDevice: (input: CreateBiometricDeviceInput) =>
    coreFetch<BiometricDeviceResponse>('/biometric-devices', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateBiometricDevice: ({ biometricDeviceId, ...input }: UpdateBiometricDeviceInput) =>
    coreFetch<BiometricDeviceResponse>(`/biometric-devices/${biometricDeviceId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  syncBiometricDevice: ({ biometricDeviceId, ...input }: CreateBiometricDeviceSyncInput) =>
    coreFetch<AttendanceSyncBatchResponse>(`/biometric-devices/${biometricDeviceId}/sync`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  testBiometricDeviceConnection: (biometricDeviceId: string) =>
    coreFetch<BiometricDeviceConnectionTestResponse>(`/biometric-devices/${biometricDeviceId}/test-connection`, {
      method: 'POST',
    }),
  getBiometricDeviceSyncHistory: (biometricDeviceId: string) => coreFetch<AttendanceSyncBatchesResponse>(`/biometric-devices/${biometricDeviceId}/sync-history`),
  getBiometricProvisioningJobs: () => coreFetch<BiometricProvisioningJobsResponse>('/biometric-provisioning/jobs'),
  getBiometricProvisioningJob: (jobId: string) => coreFetch<BiometricProvisioningJobResponse>(`/biometric-provisioning/jobs/${jobId}`),
  createBiometricProvisioningPreview: (input: CreateBiometricProvisioningPreviewInput) =>
    coreFetch<BiometricProvisioningJobResponse>('/biometric-provisioning/previews', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  applyBiometricProvisioningPreview: (previewId: string) => coreFetch<BiometricProvisioningJobResponse>(`/biometric-provisioning/jobs/${previewId}/apply`, { method: 'POST' }),
  retryBiometricProvisioningJob: (jobId: string) => coreFetch<BiometricProvisioningJobResponse>(`/biometric-provisioning/jobs/${jobId}/retry`, { method: 'POST' }),
  createAttendancePunch: (input: CreateAttendancePunchInput) =>
    coreFetch<AttendancePunchResponse>('/attendance-punches', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getAttendancePunches: () => coreFetch<AttendancePunchesResponse>('/attendance-punches'),
  getAttendancePunchesPaginated: (
    params: {
      page?: number;
      pageSize?: number;
      employeeId?: string;
      deviceId?: string;
      status?: 'processed' | 'unprocessed';
      dateFrom?: string;
      dateTo?: string;
      timeFrom?: string;
      timeTo?: string;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('pageSize', String(params.pageSize));
    if (params.employeeId) query.set('employeeId', params.employeeId);
    if (params.deviceId) query.set('deviceId', params.deviceId);
    if (params.status) query.set('status', params.status);
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    if (params.timeFrom) query.set('timeFrom', params.timeFrom);
    if (params.timeTo) query.set('timeTo', params.timeTo);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<AttendancePunchesResponse>(`/attendance-punches/paginated${suffix}`);
  },
  getEmployeeAttendancePunches: (employeeId: string) => coreFetch<AttendancePunchesResponse>(`/attendance-punches/employee/${employeeId}`),
  getUnprocessedAttendancePunches: () => coreFetch<AttendancePunchesResponse>('/attendance-punches/unprocessed'),
  getSupervisorAttendanceDailyRecords: (params: { date?: string; dateFrom?: string; dateTo?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<AttendanceDailyRecordsResponse>(`/attendance-approvals/supervisor${suffix}`);
  },
  getHrAttendanceDailyRecords: (params: { date?: string; dateFrom?: string; dateTo?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<AttendanceDailyRecordsResponse>(`/attendance-approvals/hr${suffix}`);
  },
  generateAttendanceDailyRecords: (params: { date?: string; dateFrom?: string; dateTo?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.set('date', params.date);
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<GenerateAttendanceDailyRecordsResponse>(`/attendance-approvals/generate${suffix}`, {
      method: 'POST',
    });
  },
  supervisorApproveAttendanceDailyRecord: (attendanceDailyRecordId: string) =>
    coreFetch<AttendanceDailyRecordResponse>(`/attendance-approvals/${attendanceDailyRecordId}/supervisor-approve`, {
      method: 'POST',
    }),
  updateSupervisorAttendanceDailyRecordPayroll: (input: { attendanceDailyRecordId: string; attendanceDays?: string; leaveDays?: string; payableDays?: string; payrollNote?: string | null }) =>
    coreFetch<AttendanceDailyRecordResponse>(`/attendance-approvals/${input.attendanceDailyRecordId}/supervisor-edit`, {
      method: 'POST',
      body: JSON.stringify({
        attendanceDays: input.attendanceDays,
        leaveDays: input.leaveDays,
        payableDays: input.payableDays,
        payrollNote: input.payrollNote,
      }),
    }),
  hrApproveAttendanceDailyRecord: (attendanceDailyRecordId: string) =>
    coreFetch<AttendanceDailyRecordResponse>(`/attendance-approvals/${attendanceDailyRecordId}/hr-approve`, {
      method: 'POST',
    }),
  returnAttendanceDailyRecord: (input: { attendanceDailyRecordId: string; reason: string }) =>
    coreFetch<AttendanceDailyRecordResponse>(`/attendance-approvals/${input.attendanceDailyRecordId}/return`, {
      method: 'POST',
      body: JSON.stringify({ reason: input.reason }),
    }),
  getManualPunchRequests: (params: { mine?: boolean } = {}) => {
    const query = new URLSearchParams();
    if (params.mine) query.set('mine', 'true');
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return coreFetch<ManualPunchRequestsResponse>(`/manual-punch-requests${suffix}`);
  },
  createManualPunchRequest: (input: CreateManualPunchRequestInput) =>
    coreFetch<ManualPunchRequestResponse>('/manual-punch-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  changeManualPunchRequestStatus: ({ manualPunchRequestId, ...input }: ChangeManualPunchRequestStatusInput) =>
    coreFetch<ManualPunchRequestActionResponse>(`/manual-punch-requests/${manualPunchRequestId}/status`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getOvertimeRequests: (
    params: {
      dateFrom?: string;
      dateTo?: string;
      status?: string;
      mine?: boolean;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.dateFrom) query.set('dateFrom', params.dateFrom);
    if (params.dateTo) query.set('dateTo', params.dateTo);
    if (params.status) query.set('status', params.status);
    if (params.mine) query.set('mine', 'true');
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return coreFetch<OvertimeRequestsResponse>(`/overtime-requests${suffix}`);
  },
  createOvertimeRequest: (input: CreateOvertimeRequestInput) =>
    coreFetch<OvertimeRequestsResponse>('/overtime-requests', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  changeOvertimeRequestStatus: ({ overtimeRequestId, ...input }: ChangeOvertimeRequestStatusInput) =>
    coreFetch<OvertimeRequestResponse>(`/overtime-requests/${overtimeRequestId}/status`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getLeaveFiscalYears: () => coreFetch<LeaveFiscalYearsResponse>('/leave/fiscal-years'),
  createLeaveFiscalYear: (input: CreateLeaveFiscalYearInput) =>
    coreFetch<LeaveFiscalYearResponse>('/leave/fiscal-years', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateLeaveFiscalYear: ({ fiscalYearId, ...input }: UpdateLeaveFiscalYearInput) =>
    coreFetch<LeaveFiscalYearResponse>(`/leave/fiscal-years/${fiscalYearId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  setActiveLeaveFiscalYear: (fiscalYearId: string) =>
    coreFetch<LeaveFiscalYearResponse>(`/leave/fiscal-years/${fiscalYearId}/active`, {
      method: 'POST',
    }),
  getLeaveTypes: () => coreFetch<LeaveTypesResponse>('/leave/types'),
  createLeaveType: (input: CreateLeaveTypeInput) =>
    coreFetch<LeaveTypeResponse>('/leave/types', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateLeaveType: ({ leaveTypeId, ...input }: UpdateLeaveTypeInput) =>
    coreFetch<LeaveTypeResponse>(`/leave/types/${leaveTypeId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  getLeaveBalances: (fiscalYearId?: string, view: LeaveBalanceView = 'self') => {
    const query = new URLSearchParams({ view });
    if (fiscalYearId) query.set('fiscalYearId', fiscalYearId);
    return coreFetch<LeaveBalancesResponse>(`/leave/balances?${query.toString()}`);
  },
  upsertLeaveBalance: (input: UpsertLeaveBalanceInput) =>
    coreFetch<LeaveBalanceResponse>('/leave/balances', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  bulkUpsertLeaveBalances: (input: BulkUpsertLeaveBalancesInput) =>
    coreFetch<LeaveBalancesResponse>('/leave/balances/bulk', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  transferLeaveBalance: (input: TransferLeaveBalanceInput) =>
    coreFetch<LeaveBalanceTransferResponse>('/leave/balances/transfer', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getLeaveRequests: (kind?: 'annual' | 'other', view: LeaveRequestView = 'self') => {
    const query = new URLSearchParams({ view });
    if (kind) query.set('kind', kind);
    return coreFetch<LeaveRequestsResponse>(`/leave/requests?${query.toString()}`);
  },
  createLeaveRequest: (input: CreateLeaveRequestInput) =>
    coreFetch<LeaveRequestResponse>('/leave/requests', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateLeaveRequest: ({ leaveRequestId, ...input }: UpdateLeaveRequestInput) =>
    coreFetch<LeaveRequestResponse>(`/leave/requests/${leaveRequestId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  changeLeaveRequestStatus: ({ leaveRequestId, ...input }: ChangeLeaveRequestStatusInput) =>
    coreFetch<LeaveRequestResponse>(`/leave/requests/${leaveRequestId}/status`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  authorizeLeaveRequest: ({ leaveRequestId, ...input }: AuthorizeLeaveRequestInput) =>
    coreFetch<LeaveRequestResponse>(`/leave/requests/${leaveRequestId}/authorization`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  authorizeLeaveInterruption: ({ leaveInterruptionId, ...input }: AuthorizeLeaveInterruptionInput) =>
    coreFetch<LeaveRequestResponse>(`/leave/interruptions/${leaveInterruptionId}/authorization`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  createLeaveInterruption: ({ leaveRequestId, ...input }: CreateLeaveInterruptionInput) =>
    coreFetch<LeaveRequestResponse>(`/leave/requests/${leaveRequestId}/interruptions`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  reviewLeaveInterruption: ({ leaveInterruptionId, ...input }: ReviewLeaveInterruptionInput) =>
    coreFetch<LeaveRequestResponse>(`/leave/interruptions/${leaveInterruptionId}/review`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  getTimeOperationsSummary: () => coreFetch<TimeOperationsSummaryResponse>('/time-operations/summary'),
};
