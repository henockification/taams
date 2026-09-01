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

export function formatSupervisorDelegation(delegation: any) {
  return {
    id: delegation.id,
    supervisorUserId: delegation.supervisorUserId,
    supervisorEmployeeId: delegation.supervisorEmployeeId,
    delegateUserId: delegation.delegateUserId,
    delegateEmployeeId: delegation.delegateEmployeeId,
    startsAt: formatTimestamp(delegation.startsAt),
    endsAt: formatTimestamp(delegation.endsAt),
    revokedAt: formatTimestamp(delegation.revokedAt),
    revokedBy: delegation.revokedBy ?? null,
    createdBy: delegation.createdBy,
    createdAt: formatTimestamp(delegation.createdAt),
    updatedAt: formatTimestamp(delegation.updatedAt),
    supervisorUser: delegation.supervisorUser ?? null,
    supervisorEmployee: delegation.supervisorEmployee ? formatEmployee(delegation.supervisorEmployee) : null,
    delegateUser: delegation.delegateUser ?? null,
    delegateEmployee: delegation.delegateEmployee ? formatEmployee(delegation.delegateEmployee) : null,
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

export function formatHoliday(holiday: any) {
  return {
    id: holiday.id,
    nameEn: holiday.nameEn,
    nameAm: holiday.nameAm ?? null,
    type: holiday.type,
    durationDays: holiday.durationDays ?? '1.00',
    startDate: formatDate(holiday.startDate),
    endDate: formatDate(holiday.endDate),
    description: holiday.description ?? null,
    isActive: holiday.isActive,
    createdBy: holiday.createdBy ?? null,
    updatedBy: holiday.updatedBy ?? null,
    createdAt: formatTimestamp(holiday.createdAt),
    updatedAt: formatTimestamp(holiday.updatedAt),
  };
}

export function formatNotificationLog(log: any) {
  return {
    id: log.id,
    eventType: log.eventType,
    channel: log.channel,
    status: log.status,
    recipientUserId: log.recipientUserId ?? null,
    recipientEmployeeId: log.recipientEmployeeId ?? null,
    recipientName: log.recipientName ?? null,
    destination: log.destination ?? null,
    subject: log.subject ?? null,
    message: log.message,
    locale: log.locale ?? 'en',
    relatedEntityType: log.relatedEntityType ?? null,
    relatedEntityId: log.relatedEntityId ?? null,
    metadata: log.metadata ?? null,
    attempts: log.attempts ?? 0,
    lastAttemptAt: formatTimestamp(log.lastAttemptAt),
    nextAttemptAt: formatTimestamp(log.nextAttemptAt),
    providerMessageId: log.providerMessageId ?? null,
    providerResponse: log.providerResponse ?? null,
    errorMessage: log.errorMessage ?? null,
    sentAt: formatTimestamp(log.sentAt),
    createdAt: formatTimestamp(log.createdAt),
    updatedAt: formatTimestamp(log.updatedAt),
    recipientEmployee: log.recipientEmployee ? formatEmployee(log.recipientEmployee) : null,
    recipientUser: log.recipientUser
      ? {
          id: log.recipientUser.id,
          name: log.recipientUser.name,
          email: log.recipientUser.email,
        }
      : null,
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

export function formatTemporaryDepartmentAssignment(assignment: any) {
  return {
    id: assignment.id,
    employeeId: assignment.employeeId,
    sourceDepartmentId: assignment.sourceDepartmentId,
    targetDepartmentId: assignment.targetDepartmentId,
    effectiveFrom: formatDate(assignment.effectiveFrom),
    effectiveTo: formatDate(assignment.effectiveTo),
    reason: assignment.reason,
    isActive: assignment.isActive,
    createdBy: assignment.createdBy,
    createdAt: formatTimestamp(assignment.createdAt),
    updatedAt: formatTimestamp(assignment.updatedAt),
    employee: assignment.employee ? formatEmployee(assignment.employee) : null,
    sourceDepartment: assignment.sourceDepartment ? formatDepartment(assignment.sourceDepartment) : null,
    targetDepartment: assignment.targetDepartment ? formatDepartment(assignment.targetDepartment) : null,
    creator: assignment.creator ?? null,
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
    supportingEvidenceName: exemption.supportingEvidenceName ?? null,
    supportingEvidenceUrl: exemption.supportingEvidenceUrl ?? null,
    supportingEvidenceMimeType: exemption.supportingEvidenceMimeType ?? null,
    supportingEvidenceSize: exemption.supportingEvidenceSize ?? null,
    status: exemption.status ?? (exemption.isActive ? 'APPROVED' : 'INACTIVE'),
    isActive: exemption.isActive,
    requestedBy: exemption.requestedBy ?? null,
    approvedBy: exemption.approvedBy ?? null,
    approvedAt: formatTimestamp(exemption.approvedAt),
    rejectedBy: exemption.rejectedBy ?? null,
    rejectedAt: formatTimestamp(exemption.rejectedAt),
    rejectionReason: exemption.rejectionReason ?? null,
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
    pushSecret: null,
    communicationKey: null,
    communicationKeyConfigured: Boolean(device.communicationKey),
    serialNumber: device.serialNumber ?? null,
    model: device.model ?? null,
    manufacturer: device.manufacturer ?? null,
    firmwareVersion: device.firmwareVersion ?? null,
    platformVersion: device.platformVersion ?? null,
    fingerprintAlgorithm: device.fingerprintAlgorithm ?? null,
    provisioningRole: device.provisioningRole ?? 'TARGET',
    provisioningEnabled: device.provisioningEnabled ?? false,
    lastProvisioningAt: formatTimestamp(device.lastProvisioningAt),
    lastProvisioningStatus: device.lastProvisioningStatus ?? null,
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

export function formatBiometricProvisioningDeviceResult(result: any) {
  return {
    id: result.id,
    jobId: result.jobId,
    deviceId: result.deviceId,
    status: result.status,
    addedUsers: result.addedUsers,
    updatedUsers: result.updatedUsers,
    removedUsers: result.removedUsers,
    missingTemplates: result.missingTemplates,
    uidConflicts: result.uidConflicts,
    differences: result.differences ?? null,
    errorMessage: result.errorMessage ?? null,
    attempts: result.attempts,
    startedAt: formatTimestamp(result.startedAt),
    completedAt: formatTimestamp(result.completedAt),
    device: result.device ? formatBiometricDevice(result.device) : null,
  };
}

export function formatBiometricProvisioningJob(job: any) {
  return {
    id: job.id,
    previewJobId: job.previewJobId ?? null,
    sourceDeviceId: job.sourceDeviceId,
    mode: job.mode,
    status: job.status,
    isPreview: job.isPreview,
    requestedEmployeeIds: job.requestedEmployeeIds ?? [],
    requestedTargetDeviceIds: job.requestedTargetDeviceIds ?? [],
    summary: job.summary ?? null,
    errorMessage: job.errorMessage ?? null,
    requestedBy: job.requestedBy,
    startedAt: formatTimestamp(job.startedAt),
    completedAt: formatTimestamp(job.completedAt),
    createdAt: formatTimestamp(job.createdAt),
    updatedAt: formatTimestamp(job.updatedAt),
    sourceDevice: job.sourceDevice ? formatBiometricDevice(job.sourceDevice) : null,
    deviceResults: job.deviceResults?.map(formatBiometricProvisioningDeviceResult) ?? [],
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
    supervisorDelegationId: punch.supervisorDelegationId ?? null,
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
    holidayId: record.holidayId ?? null,
    holidayDays: record.holidayDays ?? '0.00',
    isHoliday: record.isHoliday ?? false,
    payableDays: record.payableDays,
    absenceDays: record.absenceDays,
    overtimeMinutes: record.overtimeMinutes ?? 0,
    overtimeHours: record.overtimeHours ?? '0.00',
    overtimeDays: record.overtimeDays ?? '0.00',
    isBiometricExempt: record.isBiometricExempt,
    payrollNote: record.payrollNote ?? null,
    status: record.status,
    supervisorApprovedBy: record.supervisorApprovedBy ?? null,
    supervisorApprovedAt: formatTimestamp(record.supervisorApprovedAt),
    supervisorDelegationId: record.supervisorDelegationId ?? null,
    hrApprovedBy: record.hrApprovedBy ?? null,
    hrApprovedAt: formatTimestamp(record.hrApprovedAt),
    returnedBy: record.returnedBy ?? null,
    returnedAt: formatTimestamp(record.returnedAt),
    returnReason: record.returnReason ?? null,
    payrollReadyAt: formatTimestamp(record.payrollReadyAt),
    createdAt: formatTimestamp(record.createdAt),
    updatedAt: formatTimestamp(record.updatedAt),
    employee: record.employee ? formatEmployee(record.employee) : null,
    temporaryDepartmentAssignment: record.temporaryDepartmentAssignment ? formatTemporaryDepartmentAssignment(record.temporaryDepartmentAssignment) : null,
    effectiveDepartment: record.effectiveDepartment ? formatDepartment(record.effectiveDepartment) : record.employee?.department ? formatDepartment(record.employee.department) : null,
    firstPunch: record.firstPunch ? formatAttendancePunch(record.firstPunch) : null,
    lastPunch: record.lastPunch ? formatAttendancePunch(record.lastPunch) : null,
    holiday: record.holiday ? formatHoliday(record.holiday) : null,
  };
}

export function formatManualPunchRequest(request: any) {
  return {
    id: request.id,
    employeeId: request.employeeId,
    requestedPunchTime: formatTimestamp(request.requestedPunchTime),
    requestedPunchType: request.requestedPunchType,
    reason: request.reason,
    supportingDocumentName: request.supportingDocumentName ?? null,
    supportingDocumentUrl: request.supportingDocumentUrl ?? null,
    supportingDocumentMimeType: request.supportingDocumentMimeType ?? null,
    supportingDocumentSize: request.supportingDocumentSize ?? null,
    status: request.status,
    requestedBy: request.requestedBy,
    hrReviewedBy: request.hrReviewedBy ?? null,
    hrReviewedAt: formatTimestamp(request.hrReviewedAt),
    hrReviewNote: request.hrReviewNote ?? null,
    approvedBy: request.approvedBy ?? null,
    approvedAt: formatTimestamp(request.approvedAt),
    supervisorDelegationId: request.supervisorDelegationId ?? null,
    rejectedBy: request.rejectedBy ?? null,
    rejectedAt: formatTimestamp(request.rejectedAt),
    rejectionReason: request.rejectionReason ?? null,
    createdAt: formatTimestamp(request.createdAt),
    updatedAt: formatTimestamp(request.updatedAt),
    employee: request.employee ? formatEmployee(request.employee) : null,
  };
}

export function formatOvertimeRequest(request: any) {
  return {
    id: request.id,
    employeeId: request.employeeId,
    attendanceDailyRecordId: request.attendanceDailyRecordId ?? null,
    overtimeDate: formatDate(request.overtimeDate),
    startAt: formatTimestamp(request.startAt),
    endAt: formatTimestamp(request.endAt),
    requestedMinutes: request.requestedMinutes,
    approvedMinutes: request.approvedMinutes ?? 0,
    overtimeDays: request.overtimeDays ?? '0.00',
    reason: request.reason,
    status: request.status,
    requestedBy: request.requestedBy,
    requestedSupervisorDelegationId: request.requestedSupervisorDelegationId ?? null,
    approvedBy: request.approvedBy ?? null,
    approvedAt: formatTimestamp(request.approvedAt),
    rejectedBy: request.rejectedBy ?? null,
    rejectedAt: formatTimestamp(request.rejectedAt),
    rejectionReason: request.rejectionReason ?? null,
    supervisorDelegationId: request.supervisorDelegationId ?? null,
    payrollNote: request.payrollNote ?? null,
    createdAt: formatTimestamp(request.createdAt),
    updatedAt: formatTimestamp(request.updatedAt),
    employee: request.employee ? formatEmployee(request.employee) : null,
    attendanceDailyRecord: request.attendanceDailyRecord ? formatAttendanceDailyRecord(request.attendanceDailyRecord) : null,
    attendanceEvidence: request.attendanceEvidence ?? null,
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
    reserved: balance.reserved ?? '0.00',
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
  const annualLeaveDates = (request.annualLeaveDates ?? []).map((date: any) => formatAnnualLeaveRequestDate(date));
  const approvedDays = calculateApprovedLeaveDays(request, annualLeaveDates);
  const consumedDays = sumUtilizationDays(annualLeaveDates, 'CONSUMED');
  const scheduledDays = sumUtilizationDays(annualLeaveDates, 'SCHEDULED');
  const interruptedDays = sumUtilizationDays(annualLeaveDates, 'INTERRUPTED');
  const remainingDays = Math.max(0, Number(approvedDays) - Number(consumedDays)).toFixed(2);
  const requestedDays = String(request.requestedDays);

  return {
    id: request.id,
    employeeId: request.employeeId,
    leaveTypeId: request.leaveTypeId,
    fiscalYearId: request.fiscalYearId ?? null,
    startDate: formatDate(request.startDate),
    endDate: formatDate(request.endDate),
    requestedDays,
    approvedDays,
    consumedDays,
    scheduledDays,
    interruptedDays,
    remainingDays,
    isPartialApproval: request.status === 'APPROVED' && Number(approvedDays) < Number(requestedDays),
    reason: request.reason,
    status: request.status,
    requestedBy: request.requestedBy,
    approvedBy: request.approvedBy ?? null,
    approvedAt: formatTimestamp(request.approvedAt),
    rejectedBy: request.rejectedBy ?? null,
    rejectedAt: formatTimestamp(request.rejectedAt),
    rejectionReason: request.rejectionReason ?? null,
    supervisorDelegationId: request.supervisorDelegationId ?? null,
    createdAt: formatTimestamp(request.createdAt),
    updatedAt: formatTimestamp(request.updatedAt),
    employee: request.employee ? formatEmployee(request.employee) : null,
    leaveType: request.leaveType ? formatLeaveType(request.leaveType) : null,
    fiscalYear: request.fiscalYear ? formatLeaveFiscalYear(request.fiscalYear) : null,
    annualLeaveDates,
    interruptions: (request.interruptions ?? []).map(formatLeaveInterruption),
  };
}

function formatAnnualLeaveRequestDate(date: any) {
  return {
    id: date.id,
    leaveRequestId: date.leaveRequestId,
    date: formatDate(date.leaveDate),
    requestedDayValue: date.requestedDayValue,
    approvedDayValue: date.approvedDayValue ?? null,
    status: date.status,
    source: date.source ?? 'ORIGINAL',
    utilizationStatus: date.utilizationStatus ?? 'SCHEDULED',
    createdAt: formatTimestamp(date.createdAt),
    updatedAt: formatTimestamp(date.updatedAt),
  };
}

function calculateApprovedLeaveDays(request: any, annualLeaveDates: Array<{ approvedDayValue: string | null; source: string }>) {
  if (request.status !== 'APPROVED') return '0.00';
  if (annualLeaveDates.length === 0) return String(request.requestedDays);

  const total = annualLeaveDates.filter((date) => date.source === 'ORIGINAL').reduce((sum, date) => sum + Number(date.approvedDayValue ?? 0), 0);
  return total.toFixed(2);
}

function sumUtilizationDays(
  annualLeaveDates: Array<{
    approvedDayValue: string | null;
    status: string;
    utilizationStatus: string;
  }>,
  utilizationStatus: string,
) {
  return annualLeaveDates
    .filter((date) => date.status === 'APPROVED' && date.utilizationStatus === utilizationStatus)
    .reduce((sum, date) => sum + Number(date.approvedDayValue ?? 0), 0)
    .toFixed(2);
}

function formatLeaveInterruption(interruption: any) {
  return {
    id: interruption.id,
    leaveRequestId: interruption.leaveRequestId,
    reason: interruption.reason,
    recallAuthority: interruption.recallAuthority,
    authorityUserId: interruption.authorityUserId ?? null,
    actualWorkStartDate: formatDate(interruption.actualWorkStartDate),
    actualWorkEndDate: formatDate(interruption.actualWorkEndDate),
    status: interruption.status,
    requestedBy: interruption.requestedBy,
    reviewedBy: interruption.reviewedBy ?? null,
    reviewedAt: formatTimestamp(interruption.reviewedAt),
    rejectionReason: interruption.rejectionReason ?? null,
    supervisorDelegationId: interruption.supervisorDelegationId ?? null,
    createdAt: formatTimestamp(interruption.createdAt),
    updatedAt: formatTimestamp(interruption.updatedAt),
    dates: (interruption.dates ?? []).map((date: any) => ({
      id: date.id,
      leaveInterruptionId: date.leaveInterruptionId,
      kind: date.kind,
      date: formatDate(date.leaveDate),
      dayValue: date.dayValue,
      createdAt: formatTimestamp(date.createdAt),
    })),
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
        pendingManualPunchRequests: sections.manager.pendingManualPunchRequests.map((request: any) => formatManualPunchRequest(request)),
        recentTeamPunches: sections.manager.recentTeamPunches.map((punch: any) => formatAttendancePunch(punch)),
      },
    };
  }

  if (sections?.employee) {
    return {
      employee: {
        ...sections.employee,
        profile: formatEmployee(sections.employee.profile),
        latestWorkSchedule: sections.employee.latestWorkSchedule ? formatDashboardEmployeeWorkSchedule(sections.employee.latestWorkSchedule) : null,
        recentPunches: sections.employee.recentPunches.map((punch: any) => formatAttendancePunch(punch)),
        todayPunches: (sections.employee.todayPunches ?? []).map((punch: any) => formatAttendancePunch(punch)),
        manualPunchRequests: sections.employee.manualPunchRequests.map((request: any) => formatManualPunchRequest(request)),
        leaveRequests: (sections.employee.leaveRequests ?? []).map((request: any) => formatLeaveRequest(request)),
        annualLeaveBalances: (sections.employee.annualLeaveBalances ?? []).map((balance: any) => formatLeaveBalance(balance)),
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
