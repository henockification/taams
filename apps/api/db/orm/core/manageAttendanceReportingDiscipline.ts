import { and, count, eq, gte, inArray, lte } from 'drizzle-orm';
import { db } from '../../db';
import { attendanceDailyRecordAdjustments, attendanceDailyRecords } from '../../schema';

type EmployeeForReportingDiscipline = {
  id: string;
  departmentId?: string | null;
  department?: { nameEn?: string | null } | null;
  sourceDepartmentName?: string | null;
};

type AttendanceDailyStatus = 'PENDING_SUPERVISOR' | 'RETURNED' | 'SUPERVISOR_APPROVED' | 'HR_APPROVED';

export async function getAttendanceReportingDisciplineSummary(input: {
  employees: EmployeeForReportingDiscipline[];
  dateFrom: string;
  dateTo: string;
}) {
  if (input.employees.length === 0) {
    return createEmptySummary([]);
  }

  const employeeIds = input.employees.map((employee) => employee.id);
  const employeeById = new Map(input.employees.map((employee) => [employee.id, employee]));
  const inPeriod = and(
    gte(attendanceDailyRecords.attendanceDate, input.dateFrom),
    lte(attendanceDailyRecords.attendanceDate, input.dateTo),
  );
  // Slim columns plus a grouped adjustment count: loading each record with its employee,
  // department and adjustments made this take several seconds for a month.
  const [records, adjustmentCounts] = await Promise.all([
    db.select({ id: attendanceDailyRecords.id, employeeId: attendanceDailyRecords.employeeId, status: attendanceDailyRecords.status })
      .from(attendanceDailyRecords)
      .where(and(inArray(attendanceDailyRecords.employeeId, employeeIds), inPeriod)),
    db.select({ recordId: attendanceDailyRecordAdjustments.attendanceDailyRecordId, adjustments: count() })
      .from(attendanceDailyRecordAdjustments)
      .innerJoin(attendanceDailyRecords, eq(attendanceDailyRecords.id, attendanceDailyRecordAdjustments.attendanceDailyRecordId))
      .where(and(inArray(attendanceDailyRecords.employeeId, employeeIds), inPeriod))
      .groupBy(attendanceDailyRecordAdjustments.attendanceDailyRecordId),
  ]);
  const adjustmentsByRecord = new Map(adjustmentCounts.map((row) => [row.recordId, Number(row.adjustments)]));

  const rows = records.map((record) => ({
    status: record.status,
    employee: employeeById.get(record.employeeId) ?? null,
    adjustments: { length: adjustmentsByRecord.get(record.id) ?? 0 },
  }));

  return {
    ...summarizeRecords(rows),
    departmentBreakdown: buildDepartmentBreakdown(rows),
  };
}

function createEmptySummary(departmentBreakdown: any[]) {
  return {
    totalRecords: 0,
    reportedRecords: 0,
    adjustedRecords: 0,
    adjustmentCount: 0,
    hrApprovedRecords: 0,
    pendingSupervisorRecords: 0,
    returnedRecords: 0,
    reportingRate: 0,
    correctionRate: 0,
    hrReadyRate: 0,
    departmentBreakdown,
  };
}

function summarizeRecords(records: any[]) {
  const totalRecords = records.length;
  const reportedRecords = records.filter((record) => isReportedToHr(record.status)).length;
  const adjustedRecords = records.filter((record) => record.adjustments.length > 0).length;
  const adjustmentCount = records.reduce((sum, record) => sum + record.adjustments.length, 0);
  const hrApprovedRecords = records.filter((record) => record.status === 'HR_APPROVED').length;
  const pendingSupervisorRecords = records.filter((record) => record.status === 'PENDING_SUPERVISOR').length;
  const returnedRecords = records.filter((record) => record.status === 'RETURNED').length;

  return {
    totalRecords,
    reportedRecords,
    adjustedRecords,
    adjustmentCount,
    hrApprovedRecords,
    pendingSupervisorRecords,
    returnedRecords,
    reportingRate: percentage(reportedRecords, totalRecords),
    correctionRate: percentage(adjustedRecords, reportedRecords),
    hrReadyRate: percentage(hrApprovedRecords, totalRecords),
  };
}

function buildDepartmentBreakdown(records: any[]) {
  const grouped = new Map<string, any[]>();

  for (const record of records) {
    const departmentKey = record.employee?.departmentId ?? 'unassigned';
    grouped.set(departmentKey, [...(grouped.get(departmentKey) ?? []), record]);
  }

  return [...grouped.entries()]
    .map(([departmentId, departmentRecords]) => {
      const summary = summarizeRecords(departmentRecords);
      const employee = departmentRecords[0]?.employee;
      return {
        departmentId: departmentId === 'unassigned' ? null : departmentId,
        department: employee?.department?.nameEn ?? employee?.sourceDepartmentName ?? 'Unassigned',
        totalRecords: summary.totalRecords,
        reportedRecords: summary.reportedRecords,
        adjustedRecords: summary.adjustedRecords,
        adjustmentCount: summary.adjustmentCount,
        hrApprovedRecords: summary.hrApprovedRecords,
        reportingRate: summary.reportingRate,
        correctionRate: summary.correctionRate,
        hrReadyRate: summary.hrReadyRate,
      };
    })
    .sort((left, right) => {
      const reportingDiff = left.reportingRate - right.reportingRate;
      if (reportingDiff !== 0) return reportingDiff;
      return right.correctionRate - left.correctionRate;
    });
}

function isReportedToHr(status: AttendanceDailyStatus) {
  return status === 'SUPERVISOR_APPROVED' || status === 'HR_APPROVED';
}

function percentage(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 1000) / 10;
}
