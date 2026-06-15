import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coreApi } from '../api/core.api';
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
  UpdateDepartmentInput,
  UpdateEmployeeInput,
  UpdatePositionInput,
  UpdateShiftBreakInput,
  UpdateShiftInput,
  UpdateShiftSegmentInput,
  UpdateWorkScheduleDayInput,
  UpdateWorkScheduleInput,
} from '../types/core.types';

export const coreQueryKeys = {
  all: ['core'] as const,
  departments: () => [...coreQueryKeys.all, 'departments'] as const,
  positions: () => [...coreQueryKeys.all, 'positions'] as const,
  shifts: () => [...coreQueryKeys.all, 'shifts'] as const,
  shift: (id: string) => [...coreQueryKeys.shifts(), id] as const,
  shiftSegments: (id: string) => [...coreQueryKeys.shift(id), 'segments'] as const,
  shiftBreaks: (id: string) => [...coreQueryKeys.shift(id), 'breaks'] as const,
  workSchedules: () => [...coreQueryKeys.all, 'work-schedules'] as const,
  workSchedule: (id: string) => [...coreQueryKeys.workSchedules(), id] as const,
  workScheduleDays: (id: string) => [...coreQueryKeys.workSchedule(id), 'days'] as const,
  employees: () => [...coreQueryKeys.all, 'employees'] as const,
  employee: (id: string) => [...coreQueryKeys.employees(), id] as const,
  employeeSupervisors: (id: string) => [...coreQueryKeys.employee(id), 'supervisors'] as const,
};

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

export function useEmployees() {
  return useQuery({
    queryKey: coreQueryKeys.employees(),
    queryFn: () => coreApi.getEmployees(),
    staleTime: 5 * 60 * 1000,
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
    },
  });
}
