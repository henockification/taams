import { and, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, notInArray, or } from 'drizzle-orm';
import { db } from '../../db';
import { attendanceDailyRecords, departments, employeeSupervisors, employees, temporaryDepartmentAssignments } from '../../schema';

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
 * Attendance rows the supervisor may see, following the organization structure: the head of a
 * department sees everyone placed in that department or any department below it.
 *
 * Where someone is placed:
 * - A department head sits at the department(s) they head, whatever department their own employee
 *   record is filed under. So a head is visible to the heads above them and never to those below.
 * - Everyone else sits in their temporary department on days an active temporary assignment covers,
 *   otherwise in their home department (the same rule attendance approvals use).
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
  const viewerEmployeeId = supervisorScope.type === 'departments' ? supervisorScope.employeeId : null;

  // Heads are placed by the departments they head. A head is in scope only when every department
  // they head is in scope; a head of anything outside it (a parent or another branch) is above or
  // beside the viewer and stays hidden.
  const headedDepartments: Array<{ id: string; nameEn: string; headEmployeeId: string }> = await tx
    .select({ id: departments.id, nameEn: departments.nameEn, headEmployeeId: departments.headEmployeeId })
    .from(departments)
    .where(isNotNull(departments.headEmployeeId));
  const headedByEmployee = new Map<string, Array<{ id: string; nameEn: string }>>();
  for (const department of headedDepartments) {
    const current = headedByEmployee.get(department.headEmployeeId) ?? [];
    current.push({ id: department.id, nameEn: department.nameEn });
    headedByEmployee.set(department.headEmployeeId, current);
  }
  const inScope = (departmentId: string | null | undefined) =>
    !departmentIds || (Boolean(departmentId) && departmentIds.includes(departmentId!));
  const headsInScope = new Set<string>();
  const headsOutOfScope = new Set<string>();
  for (const [employeeId, headed] of headedByEmployee) {
    (headed.every((department) => inScope(department.id)) ? headsInScope : headsOutOfScope).add(employeeId);
  }
  if (viewerEmployeeId) {
    headsInScope.delete(viewerEmployeeId);
    headsOutOfScope.add(viewerEmployeeId);
  }

  // Candidates: heads placed in scope, plus anyone filed (or temporarily assigned) in scope during
  // the range. Exact per-day placement is decided below once the records are loaded.
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
          headsInScope.size > 0 ? inArray(employees.id, [...headsInScope]) : undefined,
        )
        : undefined,
      headsOutOfScope.size > 0 ? notInArray(employees.id, [...headsOutOfScope]) : undefined,
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
        holiday: { columns: { nameEn: true } },
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
      const headed = headedByEmployee.get(record.employeeId);
      if (headed) {
        return {
          record,
          inScope: headsInScope.has(record.employeeId),
          effectiveDepartmentName: headed.map((department) => department.nameEn).join(', '),
          homeDepartmentName: record.employee?.department?.nameEn ?? '',
          isTemporary: false,
        };
      }
      const assignment = assignmentOn(record.employeeId, record.attendanceDate);
      const effectiveDepartmentId = assignment?.targetDepartmentId ?? record.employee?.departmentId ?? null;
      return {
        record,
        inScope: inScope(effectiveDepartmentId) && record.employeeId !== viewerEmployeeId,
        effectiveDepartmentName: assignment?.targetDepartment?.nameEn ?? record.employee?.department?.nameEn ?? '',
        homeDepartmentName: record.employee?.department?.nameEn ?? '',
        isTemporary: Boolean(assignment),
      };
    })
    .filter((row) => row.inScope);
}
