import { AsyncLocalStorage } from 'async_hooks';

export type TemporaryAssignmentSpan = {
  employeeId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceDepartmentName: string | null;
  targetDepartmentName: string | null;
};

/** Finds the temporary assignment, if any, that places an employee in another department on a date. */
export type TemporaryDepartmentLookup = (employeeId: string, date: string) => TemporaryAssignmentSpan | null;

export function buildTemporaryDepartmentLookup(spans: TemporaryAssignmentSpan[]): TemporaryDepartmentLookup {
  const byEmployee = new Map<string, TemporaryAssignmentSpan[]>();
  for (const span of spans) {
    const list = byEmployee.get(span.employeeId);
    if (list) list.push(span);
    else byEmployee.set(span.employeeId, [span]);
  }
  return (employeeId, date) => {
    const day = date.slice(0, 10);
    // Same rule as the attendance loader: the latest assignment covering the day wins.
    return (byEmployee.get(employeeId) ?? [])
      .filter((span) => span.effectiveFrom <= day && (!span.effectiveTo || span.effectiveTo >= day))
      .sort((left, right) => right.effectiveFrom.localeCompare(left.effectiveFrom))[0] ?? null;
  };
}

const lookupStorage = new AsyncLocalStorage<TemporaryDepartmentLookup>();

/** Runs `fn` with `departmentOn` resolving temporary assignments through `lookup`. */
export function withTemporaryDepartments<T>(lookup: TemporaryDepartmentLookup, fn: () => T): T {
  return lookupStorage.run(lookup, fn);
}

/**
 * The department an employee worked in on `date`: the temporary assignment's department when one
 * applies, with `temporaryFrom` naming the home department; otherwise the home department and ''.
 */
export function departmentOn(
  employee: { id?: string | null; department?: { nameEn?: string | null } | null } | null | undefined,
  date: string | null | undefined,
) {
  const home = employee?.department?.nameEn ?? '';
  const lookup = lookupStorage.getStore();
  const span = lookup && employee?.id && date ? lookup(employee.id, date) : null;
  if (!span) return { department: home, temporaryFrom: '' };
  return {
    department: span.targetDepartmentName ?? home,
    temporaryFrom: span.sourceDepartmentName ?? home,
  };
}
