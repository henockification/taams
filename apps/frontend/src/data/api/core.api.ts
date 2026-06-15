import type {
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateEmployeeSupervisorInput,
  CreatePositionInput,
  CreateShiftBreakInput,
  CreateShiftInput,
  CreateShiftSegmentInput,
  CreateWorkScheduleDayInput,
  CreateWorkScheduleInput,
  DepartmentResponse,
  DepartmentsResponse,
  EmployeeResponse,
  EmployeeSupervisorsResponse,
  EmployeesResponse,
  PositionResponse,
  PositionsResponse,
  ShiftBreakResponse,
  ShiftBreaksResponse,
  ShiftResponse,
  ShiftSegmentResponse,
  ShiftSegmentsResponse,
  ShiftsResponse,
  UpdateDepartmentInput,
  UpdateEmployeeInput,
  UpdatePositionInput,
  UpdateShiftBreakInput,
  UpdateShiftInput,
  UpdateShiftSegmentInput,
  UpdateWorkScheduleDayInput,
  UpdateWorkScheduleInput,
  WorkScheduleDayResponse,
  WorkScheduleDaysResponse,
  WorkScheduleResponse,
  WorkSchedulesResponse,
} from '../types/core.types';

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3012';

async function coreFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: {
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

export const coreApi = {
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
  getWorkScheduleDays: (workScheduleId: string) =>
    coreFetch<WorkScheduleDaysResponse>(`/work-schedules/${workScheduleId}/days`),
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
  getEmployees: () => coreFetch<EmployeesResponse>('/employees'),
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
  getEmployeeSupervisors: (employeeId: string) =>
    coreFetch<EmployeeSupervisorsResponse>(`/employees/${employeeId}/supervisors`),
  createEmployeeSupervisor: ({ employeeId, ...input }: CreateEmployeeSupervisorInput) =>
    coreFetch(`/employees/${employeeId}/supervisors`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
};
