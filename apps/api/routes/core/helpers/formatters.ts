export function formatDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

export function formatTimestamp(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function formatDepartment(department: any) {
  return {
    id: department.id,
    nameEn: department.nameEn,
    nameAm: department.nameAm ?? null,
    code: department.code ?? null,
    parentDepartmentId: department.parentDepartmentId ?? null,
    isActive: department.isActive,
    createdAt: formatTimestamp(department.createdAt),
    updatedAt: formatTimestamp(department.updatedAt),
  };
}

export function formatPosition(position: any) {
  return {
    id: position.id,
    nameEn: position.nameEn,
    nameAm: position.nameAm ?? null,
    code: position.code ?? null,
    isActive: position.isActive,
    createdAt: formatTimestamp(position.createdAt),
    updatedAt: formatTimestamp(position.updatedAt),
  };
}

export function formatShift(shift: any) {
  return {
    id: shift.id,
    nameEn: shift.nameEn,
    nameAm: shift.nameAm ?? null,
    gracePeriodMinutes: shift.gracePeriodMinutes,
    lateAfterMinutes: shift.lateAfterMinutes,
    earlyOutBeforeMinutes: shift.earlyOutBeforeMinutes,
    isOvernight: shift.isOvernight,
    isActive: shift.isActive,
    createdAt: formatTimestamp(shift.createdAt),
    updatedAt: formatTimestamp(shift.updatedAt),
  };
}

export function formatShiftSegment(segment: any) {
  return {
    id: segment.id,
    shiftId: segment.shiftId,
    nameEn: segment.nameEn,
    nameAm: segment.nameAm ?? null,
    startTime: segment.startTime,
    endTime: segment.endTime,
    sortOrder: segment.sortOrder,
    isActive: segment.isActive,
    createdAt: formatTimestamp(segment.createdAt),
    updatedAt: formatTimestamp(segment.updatedAt),
  };
}

export function formatShiftBreak(shiftBreak: any) {
  return {
    id: shiftBreak.id,
    shiftId: shiftBreak.shiftId,
    nameEn: shiftBreak.nameEn,
    nameAm: shiftBreak.nameAm ?? null,
    startTime: shiftBreak.startTime,
    endTime: shiftBreak.endTime,
    isPaid: shiftBreak.isPaid,
    isActive: shiftBreak.isActive,
    createdAt: formatTimestamp(shiftBreak.createdAt),
    updatedAt: formatTimestamp(shiftBreak.updatedAt),
  };
}

export function formatWorkSchedule(workSchedule: any) {
  return {
    id: workSchedule.id,
    nameEn: workSchedule.nameEn,
    nameAm: workSchedule.nameAm ?? null,
    description: workSchedule.description ?? null,
    isDefault: workSchedule.isDefault,
    isActive: workSchedule.isActive,
    createdAt: formatTimestamp(workSchedule.createdAt),
    updatedAt: formatTimestamp(workSchedule.updatedAt),
  };
}

export function formatWorkScheduleDay(day: any) {
  return {
    id: day.id,
    workScheduleId: day.workScheduleId,
    dayOfWeek: day.dayOfWeek,
    shiftId: day.shiftId ?? null,
    isOffDay: day.isOffDay,
    isActive: day.isActive,
    createdAt: formatTimestamp(day.createdAt),
    updatedAt: formatTimestamp(day.updatedAt),
  };
}

export function formatEmployee(employee: any) {
  return {
    id: employee.id,
    userId: employee.userId ?? null,
    employeeCode: employee.employeeCode,
    payrollId: employee.payrollId ?? null,
    biometricId: employee.biometricId ?? null,
    firstNameEn: employee.firstNameEn,
    middleNameEn: employee.middleNameEn ?? null,
    lastNameEn: employee.lastNameEn,
    firstNameAm: employee.firstNameAm ?? null,
    middleNameAm: employee.middleNameAm ?? null,
    lastNameAm: employee.lastNameAm ?? null,
    gender: employee.gender ?? null,
    phoneNumber: employee.phoneNumber ?? null,
    email: employee.email ?? null,
    departmentId: employee.departmentId,
    positionId: employee.positionId ?? null,
    employmentStatus: employee.employmentStatus,
    employmentType: employee.employmentType,
    hireDate: formatDate(employee.hireDate),
    terminationDate: formatDate(employee.terminationDate),
    isActive: employee.isActive,
    createdAt: formatTimestamp(employee.createdAt),
    updatedAt: formatTimestamp(employee.updatedAt),
    department: employee.department ? formatDepartment(employee.department) : undefined,
    position: employee.position ? formatPosition(employee.position) : null,
  };
}

export function formatEmployeeSupervisor(supervisor: any) {
  return {
    id: supervisor.id,
    employeeId: supervisor.employeeId,
    supervisorId: supervisor.supervisorId,
    isPrimary: supervisor.isPrimary,
    effectiveFrom: formatDate(supervisor.effectiveFrom),
    effectiveTo: formatDate(supervisor.effectiveTo),
    createdAt: formatTimestamp(supervisor.createdAt),
    supervisor: supervisor.supervisor ? formatEmployee(supervisor.supervisor) : undefined,
  };
}

export function formatEmployeeWorkSchedule(schedule: any) {
  return {
    id: schedule.id,
    employeeId: schedule.employeeId,
    workScheduleId: schedule.workScheduleId,
    effectiveFrom: formatDate(schedule.effectiveFrom),
    effectiveTo: formatDate(schedule.effectiveTo),
    isActive: schedule.isActive,
    createdAt: formatTimestamp(schedule.createdAt),
    updatedAt: formatTimestamp(schedule.updatedAt),
    employee: schedule.employee ? formatEmployee(schedule.employee) : undefined,
    workSchedule: schedule.workSchedule ? formatWorkSchedule(schedule.workSchedule) : undefined,
  };
}
