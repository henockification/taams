import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi } from '../api/core.api';
import type {
  CreateAttendancePunchInput,
  BulkUpsertLeaveBalancesInput,
  ChangeLeaveRequestStatusInput,
  ChangeManualPunchRequestStatusInput,
  ChangeBiometricExemptionStatusInput,
  ChangeOvertimeRequestStatusInput,
  CreateBiometricDeviceInput,
  CreateBiometricExemptionInput,
  CreateBiometricDeviceSyncInput,
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateEmployeeSupervisorInput,
  CreateEmployeeWorkScheduleInput,
  CreateHolidayInput,
  CreatePositionInput,
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
  LeaveRequest,
  CreateLeaveTypeInput,
  NotificationLogFilters,
  ReportKey,
  ReviewLeaveInterruptionInput,
  TransferLeaveBalanceInput,
  UpdateBiometricDeviceInput,
  UpdateBiometricExemptionInput,
  UpdateDepartmentInput,
  UpdateEmployeeInput,
  UpdateEmployeeWorkScheduleInput,
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
  LeaveRequestsResponse,
} from '../types/core.types';

export const coreQueryKeys = {
  all: ['core'] as const,
  dashboardSummary: (userId?: string | null) => {
    if (userId) {
      return [...coreQueryKeys.all, 'dashboard', 'summary', userId] as const;
    }

    return [...coreQueryKeys.all, 'dashboard', 'summary'] as const;
  },
  executiveDashboardSummary: (date: string, month: string) => [...coreQueryKeys.all, 'executive-dashboard', 'summary', date, month] as const,
  hrDashboardSummary: (date: string) => [...coreQueryKeys.all, 'hr-dashboard', 'summary', date] as const,
  departmentHeadDashboardSummary: (date: string) => [...coreQueryKeys.all, 'department-head-dashboard', 'summary', date] as const,
  departments: () => [...coreQueryKeys.all, 'departments'] as const,
  positions: () => [...coreQueryKeys.all, 'positions'] as const,
  shifts: () => [...coreQueryKeys.all, 'shifts'] as const,
  shift: (id: string) => [...coreQueryKeys.shifts(), id] as const,
  shiftSegments: (id: string) => [...coreQueryKeys.shift(id), 'segments'] as const,
  shiftBreaks: (id: string) => [...coreQueryKeys.shift(id), 'breaks'] as const,
  workSchedules: () => [...coreQueryKeys.all, 'work-schedules'] as const,
  workSchedule: (id: string) => [...coreQueryKeys.workSchedules(), id] as const,
  workScheduleDays: (id: string) => [...coreQueryKeys.workSchedule(id), 'days'] as const,
  holidays: () => [...coreQueryKeys.all, 'holidays'] as const,
  notificationLogs: (params: NotificationLogFilters) => [...coreQueryKeys.all, 'notification-logs', params] as const,
  employees: () => [...coreQueryKeys.all, 'employees'] as const,
  employeesPaginated: (page: number, pageSize: number, search: string) => [...coreQueryKeys.all, 'employees', 'paginated', page, pageSize, search] as const,
  employee: (id: string) => [...coreQueryKeys.employees(), id] as const,
  employeeSupervisors: (id: string) => [...coreQueryKeys.employee(id), 'supervisors'] as const,
  employeeWorkSchedules: (id: string) => [...coreQueryKeys.employee(id), 'work-schedules'] as const,
  allEmployeeWorkSchedules: () => [...coreQueryKeys.all, 'employee-work-schedules'] as const,
  biometricDevices: () => [...coreQueryKeys.all, 'biometric-devices'] as const,
  biometricDevice: (id: string) => [...coreQueryKeys.biometricDevices(), id] as const,
  biometricDeviceSyncHistory: (id: string) => [...coreQueryKeys.biometricDevice(id), 'sync-history'] as const,
  biometricExemptions: () => [...coreQueryKeys.all, 'biometric-exemptions'] as const,
  biometricExemption: (id: string) => [...coreQueryKeys.biometricExemptions(), id] as const,
  attendancePunches: () => [...coreQueryKeys.all, 'attendance-punches'] as const,
  attendancePunchesPaginated: (params: {
    page: number;
    pageSize: number;
    employeeId: string;
    deviceId: string;
    status: string;
    dateFrom: string;
    dateTo: string;
    timeFrom: string;
    timeTo: string;
  }) => [...coreQueryKeys.attendancePunches(), 'paginated', params] as const,
  employeeAttendancePunches: (id: string) => [...coreQueryKeys.attendancePunches(), 'employee', id] as const,
  unprocessedAttendancePunches: () => [...coreQueryKeys.attendancePunches(), 'unprocessed'] as const,
  supervisorAttendanceDailyRecords: (date: string) => [...coreQueryKeys.all, 'attendance-approvals', 'supervisor', date] as const,
  hrAttendanceDailyRecords: (date: string) => [...coreQueryKeys.all, 'attendance-approvals', 'hr', date] as const,
  manualPunchRequests: () => [...coreQueryKeys.all, 'manual-punch-requests'] as const,
  overtimeRequests: (params?: { dateFrom?: string; dateTo?: string; status?: string }) => [...coreQueryKeys.all, 'overtime-requests', params ?? {}] as const,
  leaveFiscalYears: () => [...coreQueryKeys.all, 'leave', 'fiscal-years'] as const,
  leaveTypes: () => [...coreQueryKeys.all, 'leave', 'types'] as const,
  leaveBalances: (fiscalYearId?: string) => [...coreQueryKeys.all, 'leave', 'balances', fiscalYearId ?? 'all'] as const,
  leaveRequests: (kind?: 'annual' | 'other') => [...coreQueryKeys.all, 'leave', 'requests', kind ?? 'all'] as const,
  leaveRequest: (id: string) => [...coreQueryKeys.all, 'leave', 'requests', 'detail', id] as const,
  timeOperationsSummary: () => [...coreQueryKeys.all, 'time-operations', 'summary'] as const,
  report: (key: ReportKey, params: Record<string, string>) => [...coreQueryKeys.all, 'reports', key, params] as const,
};

export function useDashboardSummary(userId?: string | null) {
  return useQuery({
    queryKey: coreQueryKeys.dashboardSummary(userId),
    queryFn: () => coreApi.getDashboardSummary(),
    enabled: Boolean(userId),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useExecutiveDashboardSummary(params: { date: string; month: string }) {
  return useQuery({
    queryKey: coreQueryKeys.executiveDashboardSummary(params.date, params.month),
    queryFn: () => coreApi.getExecutiveDashboardSummary(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useHrDashboardSummary(params: { date: string }) {
  return useQuery({
    queryKey: coreQueryKeys.hrDashboardSummary(params.date),
    queryFn: () => coreApi.getHrDashboardSummary(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useReport(key: ReportKey, params: Record<string, string>) {
  return useQuery({
    queryKey: coreQueryKeys.report(key, params),
    queryFn: () => coreApi.getReport(key, params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useDepartmentHeadDashboardSummary(params: { date: string }) {
  return useQuery({
    queryKey: coreQueryKeys.departmentHeadDashboardSummary(params.date),
    queryFn: () => coreApi.getDepartmentHeadDashboardSummary(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: coreQueryKeys.departments(),
    queryFn: () => coreApi.getDepartments(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => coreApi.createDepartment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.departments() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateDepartmentInput) => coreApi.updateDepartment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.departments() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employees() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function usePositions() {
  return useQuery({
    queryKey: coreQueryKeys.positions(),
    queryFn: () => coreApi.getPositions(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePositionInput) => coreApi.createPosition(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.positions() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useUpdatePosition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdatePositionInput) => coreApi.updatePosition(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.positions() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employees() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useShifts() {
  return useQuery({
    queryKey: coreQueryKeys.shifts(),
    queryFn: () => coreApi.getShifts(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateShiftInput) => coreApi.createShift(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.shifts() });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateShiftInput) => coreApi.updateShift(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.shifts() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.shift(data.shift.id) });
    },
  });
}

export function useShiftBreaks(shiftId: string) {
  return useQuery({
    queryKey: coreQueryKeys.shiftBreaks(shiftId),
    queryFn: () => coreApi.getShiftBreaks(shiftId),
    enabled: Boolean(shiftId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useShiftSegments(shiftId: string) {
  return useQuery({
    queryKey: coreQueryKeys.shiftSegments(shiftId),
    queryFn: () => coreApi.getShiftSegments(shiftId),
    enabled: Boolean(shiftId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateShiftSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateShiftSegmentInput) => coreApi.createShiftSegment(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.shiftSegments(variables.shiftId) });
    },
  });
}

export function useUpdateShiftSegment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateShiftSegmentInput) => coreApi.updateShiftSegment(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.shiftSegments(data.shiftSegment.shiftId) });
    },
  });
}

export function useCreateShiftBreak() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateShiftBreakInput) => coreApi.createShiftBreak(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.shiftBreaks(variables.shiftId) });
    },
  });
}

export function useUpdateShiftBreak() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateShiftBreakInput) => coreApi.updateShiftBreak(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.shiftBreaks(data.shiftBreak.shiftId) });
    },
  });
}

export function useWorkSchedules() {
  return useQuery({
    queryKey: coreQueryKeys.workSchedules(),
    queryFn: () => coreApi.getWorkSchedules(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateWorkSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateWorkScheduleInput) => coreApi.createWorkSchedule(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.workSchedules() });
    },
  });
}

export function useUpdateWorkSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateWorkScheduleInput) => coreApi.updateWorkSchedule(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.workSchedules() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.workSchedule(data.workSchedule.id) });
    },
  });
}

export function useWorkScheduleDays(workScheduleId: string) {
  return useQuery({
    queryKey: coreQueryKeys.workScheduleDays(workScheduleId),
    queryFn: () => coreApi.getWorkScheduleDays(workScheduleId),
    enabled: Boolean(workScheduleId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateWorkScheduleDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateWorkScheduleDayInput) => coreApi.createWorkScheduleDay(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.workScheduleDays(variables.workScheduleId) });
    },
  });
}

export function useUpdateWorkScheduleDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateWorkScheduleDayInput) => coreApi.updateWorkScheduleDay(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.workScheduleDays(data.day.workScheduleId) });
    },
  });
}

export function useHolidays() {
  return useQuery({
    queryKey: coreQueryKeys.holidays(),
    queryFn: () => coreApi.getHolidays(),
    staleTime: 60 * 1000,
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateHolidayInput) => coreApi.createHoliday(input),
    onSuccess: () => {
      invalidateHolidayDependentQueries(queryClient);
    },
  });
}

export function useUpdateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateHolidayInput) => coreApi.updateHoliday(input),
    onSuccess: () => {
      invalidateHolidayDependentQueries(queryClient);
    },
  });
}

export function useEmployees() {
  return useQuery({
    queryKey: coreQueryKeys.employees(),
    queryFn: () => coreApi.getEmployees(),
    staleTime: 5 * 60 * 1000,
  });
}

function invalidateHolidayDependentQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: coreQueryKeys.holidays() });
  queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
  queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
  queryClient.invalidateQueries({ queryKey: [...coreQueryKeys.all, 'attendance-approvals'] });
  queryClient.invalidateQueries({ queryKey: [...coreQueryKeys.all, 'reports'] });
}

export function useEmployeesPaginated(page: number, pageSize: number, search = '') {
  return useQuery({
    queryKey: coreQueryKeys.employeesPaginated(page, pageSize, search),
    queryFn: () => coreApi.getEmployeesPaginated({ page, pageSize, search }),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useEmployee(employeeId: string) {
  return useQuery({
    queryKey: coreQueryKeys.employee(employeeId),
    queryFn: () => coreApi.getEmployee(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => coreApi.createEmployee(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employees() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employee(data.employee.id) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateEmployeeInput) => coreApi.updateEmployee(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employees() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employee(data.employee.id) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useImportPermanentEmployees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { file: File }) => coreApi.importPermanentEmployees(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employees() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
      data.employees.forEach((employee) => {
        queryClient.invalidateQueries({ queryKey: coreQueryKeys.employee(employee.id) });
      });
    },
  });
}

export function useImportContractEmployees() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { file: File }) => coreApi.importContractEmployees(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employees() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
      data.employees.forEach((employee) => {
        queryClient.invalidateQueries({ queryKey: coreQueryKeys.employee(employee.id) });
      });
    },
  });
}

export function useEmployeeSupervisors(employeeId: string) {
  return useQuery({
    queryKey: coreQueryKeys.employeeSupervisors(employeeId),
    queryFn: () => coreApi.getEmployeeSupervisors(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateEmployeeSupervisor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEmployeeSupervisorInput) => coreApi.createEmployeeSupervisor(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employeeSupervisors(variables.employeeId) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useEmployeeWorkSchedules(employeeId: string) {
  return useQuery({
    queryKey: coreQueryKeys.employeeWorkSchedules(employeeId),
    queryFn: () => coreApi.getEmployeeWorkSchedules(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAllEmployeeWorkSchedules() {
  return useQuery({
    queryKey: coreQueryKeys.allEmployeeWorkSchedules(),
    queryFn: () => coreApi.getAllEmployeeWorkSchedules(),
    staleTime: 60 * 1000,
  });
}

export function useCreateEmployeeWorkSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEmployeeWorkScheduleInput) => coreApi.createEmployeeWorkSchedule(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.employeeWorkSchedules(variables.employeeId) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.allEmployeeWorkSchedules() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useUpdateEmployeeWorkSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateEmployeeWorkScheduleInput) => coreApi.updateEmployeeWorkSchedule(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.allEmployeeWorkSchedules() });
      if (data.employeeWorkSchedule.employeeId) {
        queryClient.invalidateQueries({ queryKey: coreQueryKeys.employeeWorkSchedules(data.employeeWorkSchedule.employeeId) });
      }
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useDeleteEmployeeWorkSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (employeeWorkScheduleId: string) => coreApi.deleteEmployeeWorkSchedule(employeeWorkScheduleId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.allEmployeeWorkSchedules() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useBiometricDevices() {
  return useQuery({
    queryKey: coreQueryKeys.biometricDevices(),
    queryFn: () => coreApi.getBiometricDevices(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useBiometricDevice(biometricDeviceId: string) {
  return useQuery({
    queryKey: coreQueryKeys.biometricDevice(biometricDeviceId),
    queryFn: () => coreApi.getBiometricDevice(biometricDeviceId),
    enabled: Boolean(biometricDeviceId),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateBiometricDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBiometricDeviceInput) => coreApi.createBiometricDevice(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricDevices() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useUpdateBiometricDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBiometricDeviceInput) => coreApi.updateBiometricDevice(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricDevices() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricDevice(data.biometricDevice.id) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useSyncBiometricDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBiometricDeviceSyncInput) => coreApi.syncBiometricDevice(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricDevices() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricDevice(variables.biometricDeviceId) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricDeviceSyncHistory(variables.biometricDeviceId) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useTestBiometricDeviceConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (biometricDeviceId: string) => coreApi.testBiometricDeviceConnection(biometricDeviceId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricDevices() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricDevice(data.biometricDevice.id) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useBiometricDeviceSyncHistory(biometricDeviceId: string) {
  return useQuery({
    queryKey: coreQueryKeys.biometricDeviceSyncHistory(biometricDeviceId),
    queryFn: () => coreApi.getBiometricDeviceSyncHistory(biometricDeviceId),
    enabled: Boolean(biometricDeviceId),
    staleTime: 60 * 1000,
  });
}

export function useNotificationLogs(params: NotificationLogFilters = {}) {
  return useQuery({
    queryKey: coreQueryKeys.notificationLogs(params),
    queryFn: () => coreApi.getNotificationLogs(params),
    placeholderData: keepPreviousData,
    staleTime: 30 * 1000,
  });
}

export function useBiometricExemptions() {
  return useQuery({
    queryKey: coreQueryKeys.biometricExemptions(),
    queryFn: () => coreApi.getBiometricExemptions(),
    staleTime: 60 * 1000,
  });
}

export function useCreateBiometricExemption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateBiometricExemptionInput) => coreApi.createBiometricExemption(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricExemptions() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
    },
  });
}

export function useUpdateBiometricExemption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateBiometricExemptionInput) => coreApi.updateBiometricExemption(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricExemptions() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricExemption(data.biometricExemption.id) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
    },
  });
}

export function useChangeBiometricExemptionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ChangeBiometricExemptionStatusInput) => coreApi.changeBiometricExemptionStatus(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricExemptions() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.supervisorAttendanceDailyRecords('') });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrAttendanceDailyRecords('') });
    },
  });
}

export function useDeleteBiometricExemption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (biometricExemptionId: string) => coreApi.deleteBiometricExemption(biometricExemptionId),
    onSuccess: (_data, biometricExemptionId) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricExemptions() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.biometricExemption(biometricExemptionId) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
    },
  });
}

export function useAttendancePunches() {
  return useQuery({
    queryKey: coreQueryKeys.attendancePunches(),
    queryFn: () => coreApi.getAttendancePunches(),
    staleTime: 60 * 1000,
  });
}

export function useAttendancePunchesPaginated(params: {
  page: number;
  pageSize: number;
  employeeId?: string;
  deviceId?: string;
  status?: 'processed' | 'unprocessed';
  dateFrom?: string;
  dateTo?: string;
  timeFrom?: string;
  timeTo?: string;
}) {
  const normalized = {
    page: params.page,
    pageSize: params.pageSize,
    employeeId: params.employeeId ?? '',
    deviceId: params.deviceId ?? '',
    status: params.status ?? '',
    dateFrom: params.dateFrom ?? '',
    dateTo: params.dateTo ?? '',
    timeFrom: params.timeFrom ?? '',
    timeTo: params.timeTo ?? '',
  };

  return useQuery({
    queryKey: coreQueryKeys.attendancePunchesPaginated(normalized),
    queryFn: () => coreApi.getAttendancePunchesPaginated({
      page: params.page,
      pageSize: params.pageSize,
      employeeId: params.employeeId,
      deviceId: params.deviceId,
      status: params.status,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      timeFrom: params.timeFrom,
      timeTo: params.timeTo,
    }),
    placeholderData: keepPreviousData,
    staleTime: 60 * 1000,
  });
}

export function useEmployeeAttendancePunches(employeeId: string) {
  return useQuery({
    queryKey: coreQueryKeys.employeeAttendancePunches(employeeId),
    queryFn: () => coreApi.getEmployeeAttendancePunches(employeeId),
    enabled: Boolean(employeeId),
    staleTime: 60 * 1000,
  });
}

export function useUnprocessedAttendancePunches() {
  return useQuery({
    queryKey: coreQueryKeys.unprocessedAttendancePunches(),
    queryFn: () => coreApi.getUnprocessedAttendancePunches(),
    staleTime: 60 * 1000,
  });
}

export function useCreateAttendancePunch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAttendancePunchInput) => coreApi.createAttendancePunch(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.attendancePunches() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.unprocessedAttendancePunches() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
      if (data.attendancePunch.employeeId) {
        queryClient.invalidateQueries({ queryKey: coreQueryKeys.employeeAttendancePunches(data.attendancePunch.employeeId) });
      }
    },
  });
}

export function useSupervisorAttendanceDailyRecords(date: string) {
  return useQuery({
    queryKey: coreQueryKeys.supervisorAttendanceDailyRecords(date),
    queryFn: () => coreApi.getSupervisorAttendanceDailyRecords({ date }),
    staleTime: 60 * 1000,
  });
}

export function useHrAttendanceDailyRecords(date: string) {
  return useQuery({
    queryKey: coreQueryKeys.hrAttendanceDailyRecords(date),
    queryFn: () => coreApi.getHrAttendanceDailyRecords({ date }),
    staleTime: 60 * 1000,
  });
}

export function useGenerateAttendanceDailyRecords() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { date: string }) => coreApi.generateAttendanceDailyRecords(input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.supervisorAttendanceDailyRecords(input.date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrAttendanceDailyRecords(input.date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.departmentHeadDashboardSummary(input.date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrDashboardSummary(input.date) });
    },
  });
}

export function useSupervisorApproveAttendanceDailyRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attendanceDailyRecordId: string) => coreApi.supervisorApproveAttendanceDailyRecord(attendanceDailyRecordId),
    onSuccess: (data) => {
      const date = data.attendanceDailyRecord.attendanceDate;
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.supervisorAttendanceDailyRecords(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrAttendanceDailyRecords(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.departmentHeadDashboardSummary(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrDashboardSummary(date) });
    },
  });
}

export function useUpdateSupervisorAttendanceDailyRecordPayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      attendanceDailyRecordId: string;
      attendanceDays?: string;
      leaveDays?: string;
      payableDays?: string;
      payrollNote?: string | null;
    }) => coreApi.updateSupervisorAttendanceDailyRecordPayroll(input),
    onSuccess: (data) => {
      const date = data.attendanceDailyRecord.attendanceDate;
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.supervisorAttendanceDailyRecords(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrAttendanceDailyRecords(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.departmentHeadDashboardSummary(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrDashboardSummary(date) });
    },
  });
}

export function useHrApproveAttendanceDailyRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attendanceDailyRecordId: string) => coreApi.hrApproveAttendanceDailyRecord(attendanceDailyRecordId),
    onSuccess: (data) => {
      const date = data.attendanceDailyRecord.attendanceDate;
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.supervisorAttendanceDailyRecords(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrAttendanceDailyRecords(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrDashboardSummary(date) });
    },
  });
}

export function useReturnAttendanceDailyRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { attendanceDailyRecordId: string; reason: string }) => coreApi.returnAttendanceDailyRecord(input),
    onSuccess: (data) => {
      const date = data.attendanceDailyRecord.attendanceDate;
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.supervisorAttendanceDailyRecords(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrAttendanceDailyRecords(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.departmentHeadDashboardSummary(date) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.hrDashboardSummary(date) });
    },
  });
}

export function useManualPunchRequests() {
  return useQuery({
    queryKey: coreQueryKeys.manualPunchRequests(),
    queryFn: () => coreApi.getManualPunchRequests(),
    staleTime: 60 * 1000,
  });
}

export function useCreateManualPunchRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateManualPunchRequestInput) => coreApi.createManualPunchRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.manualPunchRequests() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useChangeManualPunchRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ChangeManualPunchRequestStatusInput) => coreApi.changeManualPunchRequestStatus(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.manualPunchRequests() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.attendancePunches() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.unprocessedAttendancePunches() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
      if (data.attendancePunch?.employeeId) {
        queryClient.invalidateQueries({ queryKey: coreQueryKeys.employeeAttendancePunches(data.attendancePunch.employeeId) });
      }
    },
  });
}

export function useOvertimeRequests(params: { dateFrom?: string; dateTo?: string; status?: string } = {}) {
  return useQuery({
    queryKey: coreQueryKeys.overtimeRequests(params),
    queryFn: () => coreApi.getOvertimeRequests(params),
    staleTime: 60 * 1000,
  });
}

export function useCreateOvertimeRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateOvertimeRequestInput) => coreApi.createOvertimeRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.all });
    },
  });
}

export function useChangeOvertimeRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ChangeOvertimeRequestStatusInput) => coreApi.changeOvertimeRequestStatus(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.all });
    },
  });
}

export function useLeaveFiscalYears() {
  return useQuery({
    queryKey: coreQueryKeys.leaveFiscalYears(),
    queryFn: () => coreApi.getLeaveFiscalYears(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateLeaveFiscalYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeaveFiscalYearInput) => coreApi.createLeaveFiscalYear(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveFiscalYears() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useUpdateLeaveFiscalYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateLeaveFiscalYearInput) => coreApi.updateLeaveFiscalYear(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveFiscalYears() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useSetActiveLeaveFiscalYear() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (fiscalYearId: string) => coreApi.setActiveLeaveFiscalYear(fiscalYearId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveFiscalYears() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: coreQueryKeys.leaveTypes(),
    queryFn: () => coreApi.getLeaveTypes(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeaveTypeInput) => coreApi.createLeaveType(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveTypes() });
    },
  });
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateLeaveTypeInput) => coreApi.updateLeaveType(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveTypes() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveRequests() });
    },
  });
}

export function useLeaveBalances(fiscalYearId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: coreQueryKeys.leaveBalances(fiscalYearId),
    queryFn: () => coreApi.getLeaveBalances(fiscalYearId),
    enabled: options?.enabled ?? true,
    staleTime: 60 * 1000,
  });
}

export function useUpsertLeaveBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpsertLeaveBalanceInput) => coreApi.upsertLeaveBalance(input),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances(variables.fiscalYearId) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveRequests() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useBulkUpsertLeaveBalances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: BulkUpsertLeaveBalancesInput) => coreApi.bulkUpsertLeaveBalances(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveRequests() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useTransferLeaveBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: TransferLeaveBalanceInput) => coreApi.transferLeaveBalance(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useLeaveRequests(kind?: 'annual' | 'other') {
  return useQuery({
    queryKey: coreQueryKeys.leaveRequests(kind),
    queryFn: () => coreApi.getLeaveRequests(kind),
    staleTime: 60 * 1000,
  });
}

type CreateLeaveRequestContext = {
  tempId: string;
  previousAll?: LeaveRequestsResponse;
  previousKind?: LeaveRequestsResponse;
};

export function useCreateLeaveRequest(kind?: 'annual' | 'other') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLeaveRequestInput) => coreApi.createLeaveRequest(input),
    onMutate: async (input) => {
      const tempId = `temp-${Date.now()}`;
      const previousAll = queryClient.getQueryData<LeaveRequestsResponse>(coreQueryKeys.leaveRequests());
      const previousKind = kind ? queryClient.getQueryData<LeaveRequestsResponse>(coreQueryKeys.leaveRequests(kind)) : undefined;
      const optimisticRequest: LeaveRequest = {
        id: tempId,
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        fiscalYearId: input.fiscalYearId ?? null,
        startDate: input.startDate ?? input.annualLeaveDates?.[0]?.date ?? '',
        endDate: input.endDate ?? input.annualLeaveDates?.[input.annualLeaveDates.length - 1]?.date ?? '',
        requestedDays: '0.00',
        approvedDays: '0.00',
        consumedDays: '0.00',
        scheduledDays: '0.00',
        interruptedDays: '0.00',
        remainingDays: '0.00',
        isPartialApproval: false,
        reason: input.reason,
        status: 'PENDING',
        requestedBy: input.requestedBy ?? '',
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        annualLeaveDates: [],
        interruptions: [],
      };

      await queryClient.cancelQueries({ queryKey: coreQueryKeys.leaveRequests() });
      if (kind) {
        await queryClient.cancelQueries({ queryKey: coreQueryKeys.leaveRequests(kind) });
      }

      queryClient.setQueryData<LeaveRequestsResponse>(coreQueryKeys.leaveRequests(), (current) => ({
        success: true,
        leaveRequests: [optimisticRequest, ...(current?.leaveRequests ?? [])],
      }));

      if (kind) {
        queryClient.setQueryData<LeaveRequestsResponse>(coreQueryKeys.leaveRequests(kind), (current) => ({
          success: true,
          leaveRequests: [optimisticRequest, ...(current?.leaveRequests ?? [])],
        }));
      }

      return { tempId, previousAll, previousKind } satisfies CreateLeaveRequestContext;
    },
    onError: (_error, _input, context) => {
      if (!context) return;
      if (context.previousAll) {
        queryClient.setQueryData(coreQueryKeys.leaveRequests(), context.previousAll);
      }
      if (kind && context.previousKind) {
        queryClient.setQueryData(coreQueryKeys.leaveRequests(kind), context.previousKind);
      }
    },
    onSuccess: (data, _input, context) => {
      const leaveRequest = data.leaveRequest;
      const requestKind = leaveRequest.leaveType?.code?.toUpperCase() === 'ANNUAL' ? 'annual' : 'other';

      queryClient.setQueryData<LeaveRequestsResponse>(coreQueryKeys.leaveRequests(), (current) => {
        const existing = current?.leaveRequests ?? [];
        return {
          success: true,
          leaveRequests: existing
            .filter((request) => request.id !== context?.tempId && request.id !== leaveRequest.id)
            .concat(leaveRequest)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        };
      });

      queryClient.setQueryData<LeaveRequestsResponse>(coreQueryKeys.leaveRequests(requestKind), (current) => {
        const existing = current?.leaveRequests ?? [];
        return {
          success: true,
          leaveRequests: existing
            .filter((request) => request.id !== context?.tempId && request.id !== leaveRequest.id)
            .concat(leaveRequest)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        };
      });

      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveRequests() });
    },
  });
}

export function useUpdateLeaveRequest(kind?: 'annual' | 'other') {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateLeaveRequestInput) => coreApi.updateLeaveRequest(input),
    onSuccess: (data) => {
      queryClient.setQueryData(coreQueryKeys.leaveRequest(data.leaveRequest.id), data);
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveRequests() });
      if (kind) queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveRequests(kind) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances(data.leaveRequest.fiscalYearId ?? undefined) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useChangeLeaveRequestStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: ChangeLeaveRequestStatusInput) => coreApi.changeLeaveRequestStatus(input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveRequests() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances(data.leaveRequest.fiscalYearId ?? undefined) });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.timeOperationsSummary() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useCreateLeaveInterruption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLeaveInterruptionInput) => coreApi.createLeaveInterruption(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveRequests() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useReviewLeaveInterruption() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ReviewLeaveInterruptionInput) => coreApi.reviewLeaveInterruption(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveRequests() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.leaveBalances() });
      queryClient.invalidateQueries({ queryKey: coreQueryKeys.dashboardSummary() });
    },
  });
}

export function useTimeOperationsSummary() {
  return useQuery({
    queryKey: coreQueryKeys.timeOperationsSummary(),
    queryFn: () => coreApi.getTimeOperationsSummary(),
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });
}
