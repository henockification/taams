import { and, desc, eq, gte, ilike, inArray, isNull, lte, ne, or } from 'drizzle-orm';
import { db } from '../../db';
import { attendanceDailyRecords, employeeSupervisors, employees, temporaryDepartmentAssignments } from '../../schema';

type DbClient = typeof db | any;

/**
 * What the supervisor report may show: everything for admins, otherwise the departments the
 * supervisor heads plus every department below them in the organization structure.
 */
export type SupervisorReportScope =
  | { type: 'all' }
  | { type: 'departments'; employeeId: string | null; headedDepartmentIds: string[]; departmentIds: string[] };

export type SupervisorAttendanceParams = {
  scope: SupervisorReportScope;
  departmentId?: string | null;
  search?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  status?: string | null;
};

/**
 * Attendance rows the supervisor may see. On each date an employee belongs to their temporary
 * department when an active temporary assignment covers that date, otherwise to their home
 * department — the same rule attendance approvals use. So people temporarily moved into the
 * supervisor's tree appear for those days, and people temporarily moved out drop off.
 */
export async function getSupervisorAttendanceRecords(params: SupervisorAttendanceParams, tx: DbClient = db) {
  const { scope: supervisorScope } = params;

  let departmentIds = supervisorScope.type === 'departments' ? supervisorScope.departmentIds : null;
  const requestedDepartmentId = params.departmentId;
  if (requestedDepartmentId) {
    if (departmentIds && !departmentIds.includes(requestedDepartmentId)) {
      throw new Error('You do not have permission to view this department');
    }
    departmentIds = [requestedDepartmentId];
  }
  if (departmentIds && departmentIds.length === 0) return [];

  const fromDate = params.dateFrom;
  const toDate = params.dateTo;
  const temporaryAssignmentInRange = and(
    eq(temporaryDepartmentAssignments.isActive, true),
    toDate ? lte(temporaryDepartmentAssignments.effectiveFrom, toDate) : undefined,
    fromDate ? gte(temporaryDepartmentAssignments.effectiveTo, fromDate) : undefined,
  );

  const search = params.search?.trim();
  const selfEmployeeId = supervisorScope.type === 'departments' ? supervisorScope.employeeId : null;
  // Candidates: home department in scope, or temporarily assigned into scope during the range.
  // Exact per-day membership is decided below once the records are loaded.
  const candidateEmployeeIds = tx
    .select({ id: employees.id })
    .from(employees)
    .where(and(
      departmentIds
        ? or(
          inArray(employees.departmentId, departmentIds),
          inArray(
            employees.id,
            tx
              .select({ id: temporaryDepartmentAssignments.employeeId })
              .from(temporaryDepartmentAssignments)
              .where(and(temporaryAssignmentInRange, inArray(temporaryDepartmentAssignments.targetDepartmentId, departmentIds))),
          ),
        )
        : undefined,
      selfEmployeeId ? ne(employees.id, selfEmployeeId) : undefined,
      search
        ? or(
          ilike(employees.employeeCode, `%${search}%`),
          ilike(employees.firstNameEn, `%${search}%`),
          ilike(employees.middleNameEn, `%${search}%`),
          ilike(employees.lastNameEn, `%${search}%`),
        )
        : undefined,
    ));
  const today = new Date().toISOString().slice(0, 10);

  const [records, assignments] = await Promise.all([
    tx.query.attendanceDailyRecords.findMany({
      where: and(
        inArray(attendanceDailyRecords.employeeId, candidateEmployeeIds),
        fromDate ? gte(attendanceDailyRecords.attendanceDate, fromDate) : undefined,
        toDate ? lte(attendanceDailyRecords.attendanceDate, toDate) : undefined,
        params.status ? eq(attendanceDailyRecords.status, params.status) : undefined,
      ),
      with: {
        employee: {
          with: {
            department: true,
            supervisorAssignments: {
              where: and(
                eq(employeeSupervisors.isPrimary, true),
                lte(employeeSupervisors.effectiveFrom, today),
                or(isNull(employeeSupervisors.effectiveTo), gte(employeeSupervisors.effectiveTo, today)),
              ),
              with: { supervisor: true },
            },
          },
        },
      },
      orderBy: [desc(attendanceDailyRecords.attendanceDate)],
    }),
    tx.query.temporaryDepartmentAssignments.findMany({
      where: and(temporaryAssignmentInRange, inArray(temporaryDepartmentAssignments.employeeId, candidateEmployeeIds)),
      columns: { employeeId: true, targetDepartmentId: true, effectiveFrom: true, effectiveTo: true },
      with: { targetDepartment: { columns: { nameEn: true } } },
    }),
  ]);

  const assignmentsByEmployee = new Map<string, any[]>();
  for (const assignment of assignments as any[]) {
    const current = assignmentsByEmployee.get(assignment.employeeId) ?? [];
    current.push(assignment);
    assignmentsByEmployee.set(assignment.employeeId, current);
  }
  // When assignments overlap, the most recently started one wins (as in attendance approvals).
  const assignmentOn = (employeeId: string, date: string) => (assignmentsByEmployee.get(employeeId) ?? [])
    .filter((assignment) => assignment.effectiveFrom <= date && assignment.effectiveTo >= date)
    .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0];

  return (records as any[])
    .map((record) => {
      const assignment = assignmentOn(record.employeeId, record.attendanceDate);
      return {
        record,
        effectiveDepartmentId: assignment?.targetDepartmentId ?? record.employee?.departmentId ?? null,
        effectiveDepartmentName: assignment?.targetDepartment?.nameEn ?? record.employee?.department?.nameEn ?? '',
        homeDepartmentName: record.employee?.department?.nameEn ?? '',
        isTemporary: Boolean(assignment),
      };
    })
    .filter((row) => !departmentIds || (row.effectiveDepartmentId !== null && departmentIds.includes(row.effectiveDepartmentId)));
}
