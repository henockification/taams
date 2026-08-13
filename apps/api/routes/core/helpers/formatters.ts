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
    positionName: employee.positionName ?? null,
    employmentStatus: employee.employmentStatus,
    employmentType: employee.employmentType,
    hireDate: formatDate(employee.hireDate),
    terminationDate: formatDate(employee.terminationDate),
    sourceIdNo: employee.sourceIdNo ?? null,
    sourceEmployeeCode: employee.sourceEmployeeCode ?? null,
    sourceEmploymentStatus: employee.sourceEmploymentStatus ?? null,
    sourceDepartmentName: employee.sourceDepartmentName ?? null,
    sourcePositionName: employee.sourcePositionName ?? null,
    sourcePositionCode: employee.sourcePositionCode ?? null,
    salary: employee.salary ?? null,
    salaryStep: employee.salaryStep ?? null,
    sourceImportedAt: formatTimestamp(employee.sourceImportedAt),
    sourceRawPayload: employee.sourceRawPayload ?? null,
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

export function formatBiometricExemption(exemption: any) {
  return {
    id: exemption.id,
    employeeId: exemption.employeeId ?? null,
    positionId: exemption.positionId ?? null,
    targetType: exemption.employeeId ? 'EMPLOYEE' : 'POSITION',
    reason: exemption.reason,
    isActive: exemption.isActive,
    createdBy: exemption.createdBy ?? null,
    updatedBy: exemption.updatedBy ?? null,
    createdAt: formatTimestamp(exemption.createdAt),
    updatedAt: formatTimestamp(exemption.updatedAt),
    employee: exemption.employee ? formatEmployee(exemption.employee) : null,
    position: exemption.position ? formatPosition(exemption.position) : null,
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

export function formatBiometricDevice(device: any) {
  return {
    id: device.id,
    deviceName: device.deviceName,
    deviceCode: device.deviceCode,
    ipAddress: device.ipAddress ?? null,
    port: device.port ?? null,
    locationName: device.locationName ?? null,
    departmentId: device.departmentId ?? null,
    deviceType: device.deviceType,
    connectionType: device.connectionType,
    vendor: device.vendor,
    protocol: device.protocol,
    integrationMode: device.integrationMode,
    preferredMode: device.preferredMode,
    pushEnabled: device.pushEnabled,
    pullEnabled: device.pullEnabled,
    pushSecret: device.pushSecret ?? null,
    communicationKey: device.communicationKey ?? null,
    serialNumber: device.serialNumber ?? null,
    model: device.model ?? null,
    manufacturer: device.manufacturer ?? null,
    isActive: device.isActive,
    lastSyncAt: formatTimestamp(device.lastSyncAt),
    lastSuccessfulSyncAt: formatTimestamp(device.lastSuccessfulSyncAt),
    lastFailedSyncAt: formatTimestamp(device.lastFailedSyncAt),
    lastPushAt: formatTimestamp(device.lastPushAt),
    lastPullAt: formatTimestamp(device.lastPullAt),
    lastSeenAt: formatTimestamp(device.lastSeenAt),
    lastErrorMessage: device.lastErrorMessage ?? null,
    syncIntervalMinutes: device.syncIntervalMinutes,
    autoSyncEnabled: device.autoSyncEnabled,
    healthStatus: device.healthStatus,
    fallbackToPull: device.fallbackToPull,
    createdAt: formatTimestamp(device.createdAt),
    updatedAt: formatTimestamp(device.updatedAt),
    department: device.department ? formatDepartment(device.department) : null,
  };
}

export function formatAttendanceSyncBatch(batch: any) {
  return {
    id: batch.id,
    deviceId: batch.deviceId ?? null,
    syncStartedAt: formatTimestamp(batch.syncStartedAt),
    syncCompletedAt: formatTimestamp(batch.syncCompletedAt),
    syncStatus: batch.syncStatus,
    totalRecords: batch.totalRecords,
    successfulRecords: batch.successfulRecords,
    failedRecords: batch.failedRecords,
    errorMessage: batch.errorMessage ?? null,
    createdAt: formatTimestamp(batch.createdAt),
    device: batch.device ? formatBiometricDevice(batch.device) : null,
  };
}

export function formatAttendancePunch(punch: any) {
  return {
    id: punch.id,
    employeeId: punch.employeeId ?? null,
    biometricId: punch.biometricId,
    deviceId: punch.deviceId ?? null,
    syncBatchId: punch.syncBatchId ?? null,
    externalUid: punch.externalUid ?? null,
    punchTime: formatTimestamp(punch.punchTime),
    punchType: punch.punchType,
    verificationType: punch.verificationType ?? null,
    devicePunchId: punch.devicePunchId ?? null,
    source: punch.source,
    isProcessed: punch.isProcessed,
    isManual: punch.isManual,
    manualReason: punch.manualReason ?? null,
    approvedBy: punch.approvedBy ?? null,
    approvedAt: formatTimestamp(punch.approvedAt),
    processedAt: formatTimestamp(punch.processedAt),
    rawPayload: punch.rawPayload ?? null,
    createdAt: formatTimestamp(punch.createdAt),
    employee: punch.employee ? formatEmployee(punch.employee) : null,
    device: punch.device ? formatBiometricDevice(punch.device) : null,
    syncBatch: punch.syncBatch ? formatAttendanceSyncBatch(punch.syncBatch) : null,
  };
}

export function formatAttendanceDailyRecord(record: any) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    attendanceDate: formatDate(record.attendanceDate),
    firstPunchId: record.firstPunchId ?? null,
    lastPunchId: record.lastPunchId ?? null,
    checkInAt: formatTimestamp(record.checkInAt),
    checkOutAt: formatTimestamp(record.checkOutAt),
    totalPunches: record.totalPunches,
    attendanceDays: record.attendanceDays,
    leaveDays: record.leaveDays,
    payableDays: record.payableDays,
    absenceDays: record.absenceDays,
    isBiometricExempt: record.isBiometricExempt,
    payrollNote: record.payrollNote ?? null,
    status: record.status,
    supervisorApprovedBy: record.supervisorApprovedBy ?? null,
    supervisorApprovedAt: formatTimestamp(record.supervisorApprovedAt),
    hrApprovedBy: record.hrApprovedBy ?? null,
    hrApprovedAt: formatTimestamp(record.hrApprovedAt),
    returnedBy: record.returnedBy ?? null,
    returnedAt: formatTimestamp(record.returnedAt),
    returnReason: record.returnReason ?? null,
    payrollReadyAt: formatTimestamp(record.payrollReadyAt),
    createdAt: formatTimestamp(record.createdAt),
    updatedAt: formatTimestamp(record.updatedAt),
    employee: record.employee ? formatEmployee(record.employee) : null,
    firstPunch: record.firstPunch ? formatAttendancePunch(record.firstPunch) : null,
    lastPunch: record.lastPunch ? formatAttendancePunch(record.lastPunch) : null,
  };
}

export function formatManualPunchRequest(request: any) {
  return {
    id: request.id,
    employeeId: request.employeeId,
    requestedPunchTime: formatTimestamp(request.requestedPunchTime),
    requestedPunchType: request.requestedPunchType,
    reason: request.reason,
    status: request.status,
    requestedBy: request.requestedBy,
    approvedBy: request.approvedBy ?? null,
    approvedAt: formatTimestamp(request.approvedAt),
    rejectedBy: request.rejectedBy ?? null,
    rejectedAt: formatTimestamp(request.rejectedAt),
    rejectionReason: request.rejectionReason ?? null,
    createdAt: formatTimestamp(request.createdAt),
    updatedAt: formatTimestamp(request.updatedAt),
    employee: request.employee ? formatEmployee(request.employee) : null,
  };
}

export function formatLeaveFiscalYear(fiscalYear: any) {
  return {
    id: fiscalYear.id,
    name: fiscalYear.name,
    startsAt: formatDate(fiscalYear.startsAt),
    endsAt: formatDate(fiscalYear.endsAt),
    isActive: fiscalYear.isActive,
    createdAt: formatTimestamp(fiscalYear.createdAt),
    updatedAt: formatTimestamp(fiscalYear.updatedAt),
  };
}

export function formatLeaveType(leaveType: any) {
  return {
    id: leaveType.id,
    code: leaveType.code,
    nameEn: leaveType.nameEn,
    nameAm: leaveType.nameAm ?? null,
    description: leaveType.description ?? null,
    deductsAnnualBalance: leaveType.deductsAnnualBalance,
    requiresBalance: leaveType.requiresBalance,
    allowedDays: leaveType.allowedDays ?? null,
    isActive: leaveType.isActive,
    createdAt: formatTimestamp(leaveType.createdAt),
    updatedAt: formatTimestamp(leaveType.updatedAt),
  };
}

export function formatLeaveBalance(balance: any) {
  return {
    id: balance.id,
    employeeId: balance.employeeId,
    fiscalYearId: balance.fiscalYearId,
    employmentTypeSnapshot: balance.employmentTypeSnapshot,
    opening: balance.opening ?? '0.00',
    transferredIn: balance.transferredIn ?? '0.00',
    used: balance.used ?? '0.00',
    available: balance.available ?? '0.00',
    createdBy: balance.createdBy ?? null,
    updatedBy: balance.updatedBy ?? null,
    createdAt: formatTimestamp(balance.createdAt),
    updatedAt: formatTimestamp(balance.updatedAt),
    employee: balance.employee ? formatEmployee(balance.employee) : null,
    fiscalYear: balance.fiscalYear ? formatLeaveFiscalYear(balance.fiscalYear) : null,
  };
}

export function formatLeaveBalanceTransaction(transaction: any) {
  return {
    id: transaction.id,
    leaveBalanceId: transaction.leaveBalanceId,
    employeeId: transaction.employeeId,
    fiscalYearId: transaction.fiscalYearId,
    leaveRequestId: transaction.leaveRequestId ?? null,
    linkedTransactionId: transaction.linkedTransactionId ?? null,
    type: transaction.type,
    days: transaction.days,
    note: transaction.note ?? null,
    createdBy: transaction.createdBy ?? null,
    createdAt: formatTimestamp(transaction.createdAt),
  };
}

export function formatLeaveRequest(request: any) {
  return {
    id: request.id,
    employeeId: request.employeeId,
    leaveTypeId: request.leaveTypeId,
    fiscalYearId: request.fiscalYearId ?? null,
    startDate: formatDate(request.startDate),
    endDate: formatDate(request.endDate),
    requestedDays: request.requestedDays,
    reason: request.reason,
    status: request.status,
    requestedBy: request.requestedBy,
    approvedBy: request.approvedBy ?? null,
    approvedAt: formatTimestamp(request.approvedAt),
    rejectedBy: request.rejectedBy ?? null,
    rejectedAt: formatTimestamp(request.rejectedAt),
    rejectionReason: request.rejectionReason ?? null,
    createdAt: formatTimestamp(request.createdAt),
    updatedAt: formatTimestamp(request.updatedAt),
    employee: request.employee ? formatEmployee(request.employee) : null,
    leaveType: request.leaveType ? formatLeaveType(request.leaveType) : null,
    fiscalYear: request.fiscalYear ? formatLeaveFiscalYear(request.fiscalYear) : null,
  };
}

export function formatTimeOperationsSummary(summary: any) {
  return {
    generatedAt: formatTimestamp(summary.generatedAt),
    status: summary.status,
    headline: summary.headline,
    counts: summary.counts,
    items: summary.items.map((item: any) => ({
      id: item.id,
      type: item.type,
      severity: item.severity,
      title: item.title,
      description: item.description,
      count: item.count,
      actionLabel: item.actionLabel,
      actionHref: item.actionHref,
      occurredAt: formatTimestamp(item.occurredAt),
      metadata: item.metadata,
    })),
  };
}

export function formatDashboardSummary(summary: any) {
  return {
    generatedAt: formatTimestamp(summary.generatedAt),
    role: summary.role,
    setupRequired: summary.setupRequired,
    user: summary.user,
    employee: summary.employee ? formatEmployee(summary.employee) : null,
    currentAnnualLeaveBalance: summary.currentAnnualLeaveBalance ? formatLeaveBalance(summary.currentAnnualLeaveBalance) : null,
    metrics: summary.metrics,
    quickActions: summary.quickActions,
    sections: formatDashboardSections(summary.sections),
    placeholders: summary.placeholders,
  };
}

function formatDashboardSections(sections: any) {
  if (sections?.superAdmin) {
    return {
      superAdmin: {
        ...sections.superAdmin,
        timeOperations: formatTimeOperationsSummary(sections.superAdmin.timeOperations),
      },
    };
  }

  if (sections?.manager) {
    return {
      manager: {
        ...sections.manager,
        directReports: sections.manager.directReports.map((employee: any) => formatEmployee(employee)),
        pendingManualPunchRequests: sections.manager.pendingManualPunchRequests.map((request: any) => (
          formatManualPunchRequest(request)
        )),
        recentTeamPunches: sections.manager.recentTeamPunches.map((punch: any) => formatAttendancePunch(punch)),
      },
    };
  }

  if (sections?.employee) {
    return {
      employee: {
        ...sections.employee,
        profile: formatEmployee(sections.employee.profile),
        latestWorkSchedule: sections.employee.latestWorkSchedule
          ? formatDashboardEmployeeWorkSchedule(sections.employee.latestWorkSchedule)
          : null,
        recentPunches: sections.employee.recentPunches.map((punch: any) => formatAttendancePunch(punch)),
        todayPunches: (sections.employee.todayPunches ?? []).map((punch: any) => formatAttendancePunch(punch)),
        manualPunchRequests: sections.employee.manualPunchRequests.map((request: any) => (
          formatManualPunchRequest(request)
        )),
        leaveRequests: (sections.employee.leaveRequests ?? []).map((request: any) => formatLeaveRequest(request)),
        todayAttendance: {
          date: sections.employee.todayAttendance.date,
          checkIn: sections.employee.todayAttendance.checkIn ? formatAttendancePunch(sections.employee.todayAttendance.checkIn) : null,
          checkOut: sections.employee.todayAttendance.checkOut ? formatAttendancePunch(sections.employee.todayAttendance.checkOut) : null,
          workingMinutes: sections.employee.todayAttendance.workingMinutes,
          workingHours: sections.employee.todayAttendance.workingHours,
        },
        announcements: sections.employee.announcements ?? [],
      },
    };
  }

  return sections;
}

function formatDashboardEmployeeWorkSchedule(schedule: any) {
  const formatted = formatEmployeeWorkSchedule(schedule);

  return {
    ...formatted,
    workSchedule: schedule.workSchedule
      ? {
        ...formatWorkSchedule(schedule.workSchedule),
        days: (schedule.workSchedule.days ?? []).map((day: any) => ({
          ...formatWorkScheduleDay(day),
          shift: day.shift ? formatShift(day.shift) : null,
        })),
      }
      : null,
  };
}
