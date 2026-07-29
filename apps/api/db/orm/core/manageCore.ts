import { randomUUID } from 'crypto';
import { and, asc, count, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { departments, employeeSupervisors, employees, positions, roles, user, userRoles } from '../../schema';
import type {
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateEmployeeSupervisorInput,
  CreatePositionInput,
  UpdateDepartmentInput,
  UpdateEmployeeInput,
  UpdatePositionInput,
} from '../../../types/core.types';
import type { PermanentEmployeeImportInput } from '../../../lib/employees/excel-import';

type DbClient = typeof db | any;

export async function createDepartment(input: CreateDepartmentInput) {
  if (input.parentDepartmentId) {
    await assertDepartmentExists(input.parentDepartmentId);
  }

  const [department] = await db
    .insert(departments)
    .values(normalizeDepartmentInput(input) as any)
    .returning();

  return department;
}

export async function getDepartments() {
  return db.select().from(departments).orderBy(asc(departments.nameEn));
}

export async function updateDepartment(id: string, input: UpdateDepartmentInput) {
  await assertDepartmentExists(id);

  if (input.parentDepartmentId) {
    if (input.parentDepartmentId === id) {
      throw new Error('Department cannot be its own parent');
    }
    await assertDepartmentExists(input.parentDepartmentId);
  }

  const updateData = normalizeDepartmentInput(input);

  if (Object.keys(updateData).length === 0) {
    return getDepartmentById(id);
  }

  const [department] = await db
    .update(departments)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(departments.id, id))
    .returning();

  return department;
}

export async function createPosition(input: CreatePositionInput) {
  const [position] = await db
    .insert(positions)
    .values(normalizePositionInput(input) as any)
    .returning();

  return position;
}

export async function getPositions() {
  return db.select().from(positions).orderBy(asc(positions.nameEn));
}

export async function updatePosition(id: string, input: UpdatePositionInput) {
  await assertPositionExists(id);

  const updateData = normalizePositionInput(input);

  if (Object.keys(updateData).length === 0) {
    return getPositionById(id);
  }

  const [position] = await db
    .update(positions)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(positions.id, id))
    .returning();

  return position;
}

export async function createEmployee(input: CreateEmployeeInput) {
  await assertEmployeeReferences(input);

  const [employee] = await db
    .insert(employees)
    .values(normalizeEmployeeInput(input) as any)
    .returning();

  return getEmployeeById(employee.id);
}

export async function getEmployees() {
  return db.query.employees.findMany({
    with: {
      department: true,
      position: true,
    },
    orderBy: (table, { asc }) => [asc(table.employeeCode)],
  });
}

export async function getEmployeesPaginated({
  page = 1,
  pageSize = 50,
  search = '',
}: {
  page?: number;
  pageSize?: number;
  search?: string;
}) {
  const offset = (page - 1) * pageSize;
  const normalizedSearch = search.trim();
  const searchCondition = normalizedSearch
    ? or(
        ilike(employees.employeeCode, `%${normalizedSearch}%`),
        ilike(employees.firstNameEn, `%${normalizedSearch}%`),
        ilike(employees.middleNameEn, `%${normalizedSearch}%`),
        ilike(employees.lastNameEn, `%${normalizedSearch}%`),
      )
    : undefined;

  const whereClause = searchCondition ?? undefined;

  const totalQuery = db.select({ value: count() }).from(employees);
  const employeeQuery = db.query.employees.findMany({
    where: whereClause,
    with: {
      department: true,
      position: true,
    },
    orderBy: (table, { asc }) => [asc(table.employeeCode)],
    limit: pageSize,
    offset,
  });

  const [totalResult, employeesPage] = await Promise.all([
    whereClause ? totalQuery.where(whereClause) : totalQuery,
    employeeQuery,
  ]);

  return {
    employees: employeesPage,
    total: Number(totalResult[0]?.value ?? 0),
    page,
    pageSize,
  };
}

export async function getEmployeeById(id: string, tx: DbClient = db) {
  return tx.query.employees.findFirst({
    where: eq(employees.id, id),
    with: {
      department: true,
      position: true,
    },
  });
}

export async function updateEmployee(id: string, input: UpdateEmployeeInput) {
  await assertEmployeeExists(id);
  await assertEmployeeReferences(input);

  const updateData = normalizeEmployeeInput(input);

  if (Object.keys(updateData).length === 0) {
    return getEmployeeById(id);
  }

  await db
    .update(employees)
    .set({ ...updateData, updatedAt: new Date() })
    .where(eq(employees.id, id));

  return getEmployeeById(id);
}

export type PermanentEmployeeImportResult = {
  created: number;
  updated: number;
  skipped: number;
  employees: (typeof employees.$inferSelect)[];
};

export async function upsertPermanentEmployees(inputs: PermanentEmployeeImportInput[]): Promise<PermanentEmployeeImportResult> {
  if (inputs.length === 0) {
    return { created: 0, updated: 0, skipped: 0, employees: [] };
  }

  const departmentCache = await buildDepartmentImportCache();
  const existingEmployees = await db
    .select()
    .from(employees)
    .where(inArray(employees.employeeCode, inputs.map((input) => input.employeeCode)));
  const existingEmployeeByCode = new Map(
    existingEmployees.map((employee) => [employee.employeeCode, employee])
  );
  const userIdByEmployeeCode = await ensureImportUserAccounts(inputs, existingEmployeeByCode);
  const importedAt = new Date();
  const employeeValues = [];
  let skipped = 0;
  let updated = 0;

  for (const input of inputs) {
    const department = await findOrCreateDepartmentByName(input.sourceDepartmentName, departmentCache);

    const employeeInput = normalizeEmployeeInput({
      ...input,
      userId: userIdByEmployeeCode.get(input.employeeCode) ?? input.userId ?? null,
      departmentId: department.id,
      positionId: null,
      positionName: input.positionName ?? input.sourcePositionName ?? null,
      employmentType: 'PERMANENT',
      sourceImportedAt: importedAt,
    });

    const existingEmployee = existingEmployeeByCode.get(input.employeeCode);
    if (existingEmployee && employeeMatchesImport(existingEmployee, employeeInput)) {
      skipped += 1;
      continue;
    }

    if (existingEmployee) {
      updated += 1;
    }

    employeeValues.push(employeeInput);
  }

  if (employeeValues.length === 0) {
    return { created: 0, updated: 0, skipped, employees: [] };
  }

  const importedEmployees = await db
    .insert(employees)
    .values(employeeValues as any)
    .onConflictDoUpdate({
      target: employees.employeeCode,
      set: {
        payrollId: null,
        biometricId: null,
        userId: sql`COALESCE(${employees.userId}, excluded.user_id)`,
        firstNameEn: sql`excluded.first_name_en`,
        middleNameEn: sql`excluded.middle_name_en`,
        lastNameEn: sql`excluded.last_name_en`,
        firstNameAm: sql`excluded.first_name_am`,
        middleNameAm: sql`excluded.middle_name_am`,
        lastNameAm: sql`excluded.last_name_am`,
        gender: sql`excluded.gender`,
        phoneNumber: sql`excluded.phone_number`,
        email: sql`excluded.email`,
        departmentId: sql`excluded.department_id`,
        positionId: null,
        positionName: sql`excluded.position_name`,
        employmentStatus: sql`excluded.employment_status`,
        employmentType: sql`excluded.employment_type`,
        hireDate: sql`excluded.hire_date`,
        terminationDate: null,
        sourceIdNo: sql`excluded.source_id_no`,
        sourceEmployeeCode: sql`excluded.source_employee_code`,
        sourceEmploymentStatus: sql`excluded.source_employment_status`,
        sourceDepartmentName: sql`excluded.source_department_name`,
        sourcePositionName: sql`excluded.source_position_name`,
        sourcePositionCode: sql`excluded.source_position_code`,
        salary: sql`excluded.salary`,
        salaryStep: sql`excluded.salary_step`,
        sourceImportedAt: importedAt,
        sourceRawPayload: sql`excluded.source_raw_payload`,
        isActive: sql`excluded.is_active`,
        updatedAt: importedAt,
      } as any,
    })
    .returning();

  return {
    created: employeeValues.length - updated,
    updated,
    skipped,
    employees: importedEmployees,
  };
}

export async function createEmployeeSupervisor(employeeId: string, input: CreateEmployeeSupervisorInput) {
  await assertEmployeeExists(employeeId);
  await assertEmployeeExists(input.supervisorId);

  if (employeeId === input.supervisorId) {
    throw new Error('Employee cannot be their own supervisor');
  }

  const [assignment] = await db
    .insert(employeeSupervisors)
    .values({
      employeeId,
      supervisorId: input.supervisorId,
      isPrimary: input.isPrimary ?? true,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
    } as any)
    .returning();

  return getEmployeeSupervisorById(assignment.id);
}

export async function getEmployeeSupervisors(employeeId: string) {
  await assertEmployeeExists(employeeId);

  return db.query.employeeSupervisors.findMany({
    where: eq(employeeSupervisors.employeeId, employeeId),
    with: {
      supervisor: {
        with: {
          department: true,
          position: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.effectiveFrom)],
  });
}

async function getDepartmentById(id: string, tx: DbClient = db) {
  return tx.query.departments.findFirst({
    where: eq(departments.id, id),
  });
}

async function getPositionById(id: string, tx: DbClient = db) {
  return tx.query.positions.findFirst({
    where: eq(positions.id, id),
  });
}

async function getEmployeeSupervisorById(id: string, tx: DbClient = db) {
  return tx.query.employeeSupervisors.findFirst({
    where: eq(employeeSupervisors.id, id),
    with: {
      supervisor: {
        with: {
          department: true,
          position: true,
        },
      },
    },
  });
}

async function getEmployeeByCode(employeeCode: string, tx: DbClient = db) {
  return tx.query.employees.findFirst({
    where: eq(employees.employeeCode, employeeCode),
    with: {
      department: true,
      position: true,
    },
  });
}

async function buildDepartmentImportCache() {
  const cache = new Map<string, Awaited<ReturnType<typeof getDepartments>>[number]>();
  const allDepartments = await getDepartments();
  allDepartments.forEach((department) => {
    [department.nameEn, department.nameAm ?? '', department.code ?? '']
      .map(normalizeLookup)
      .filter(Boolean)
      .forEach((key) => cache.set(key, department));
  });
  return cache;
}

async function findOrCreateDepartmentByName(
  name: string,
  cache: Map<string, Awaited<ReturnType<typeof getDepartments>>[number]>
) {
  const normalizedName = normalizeLookup(name);
  const found = cache.get(normalizedName);

  if (found) return found;

  const department = await createDepartment({
    nameEn: name,
    code: null,
    isActive: true,
  });

  cache.set(normalizedName, department);
  return department;
}

async function ensureImportUserAccounts(
  inputs: PermanentEmployeeImportInput[],
  existingEmployeeByCode: Map<string, typeof employees.$inferSelect>
) {
  const accountByEmployeeCode = new Map<string, { employeeCode: string; name: string; email: string }>();

  for (const input of inputs) {
    const existingEmployee = existingEmployeeByCode.get(input.employeeCode);
    if (existingEmployee?.userId) {
      continue;
    }

    accountByEmployeeCode.set(input.employeeCode, {
      employeeCode: input.employeeCode,
      name: buildImportUserName(input),
      email: buildImportUserEmail(input),
    });
  }

  const accounts = Array.from(accountByEmployeeCode.values());
  if (accounts.length === 0) return new Map<string, string>();

  const uniqueAccountByEmail = new Map<string, { employeeCode: string; name: string; email: string }>();
  for (const account of accounts) {
    if (!uniqueAccountByEmail.has(account.email)) {
      uniqueAccountByEmail.set(account.email, account);
    }
  }

  const emails = Array.from(uniqueAccountByEmail.keys());
  const existingUsers = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(inArray(user.email, emails));
  const existingUserByEmail = new Map(existingUsers.map((foundUser) => [foundUser.email, foundUser]));
  const usersToCreate = Array.from(uniqueAccountByEmail.values())
    .filter((account) => !existingUserByEmail.has(account.email))
    .map((account) => ({
      id: randomUUID(),
      name: account.name,
      email: account.email,
      emailVerified: true,
      role: ['employee'],
    }));

  if (usersToCreate.length > 0) {
    await db
      .insert(user)
      .values(usersToCreate)
      .onConflictDoNothing({ target: user.email });
  }

  const users = await db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(inArray(user.email, emails));
  const userByEmail = new Map(users.map((foundUser) => [foundUser.email, foundUser]));
  const userIdByEmployeeCode = new Map<string, string>();

  for (const account of accounts) {
    const foundUser = userByEmail.get(account.email);
    if (foundUser) {
      userIdByEmployeeCode.set(account.employeeCode, foundUser.id);
    }
  }

  const employeeRole = await db.query.roles.findFirst({
    where: eq(roles.name, 'employee'),
    columns: { id: true },
  });

  if (employeeRole && usersToCreate.length > 0) {
    const createdUserIds = usersToCreate
      .map((createdUser) => userByEmail.get(createdUser.email)?.id)
      .filter((id): id is string => Boolean(id));

    if (createdUserIds.length > 0) {
      await db
        .insert(userRoles)
        .values(
          createdUserIds.map((userId) => ({
            userId,
            roleId: employeeRole.id,
          }))
        )
        .onConflictDoNothing({
          target: [userRoles.userId, userRoles.roleId],
        });
    }
  }

  return userIdByEmployeeCode;
}

async function assertDepartmentExists(id: string, tx: DbClient = db) {
  const found = await tx.query.departments.findFirst({
    where: eq(departments.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Department not found');
}

async function assertPositionExists(id: string, tx: DbClient = db) {
  const found = await tx.query.positions.findFirst({
    where: eq(positions.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Position not found');
}

async function assertEmployeeExists(id: string, tx: DbClient = db) {
  const found = await tx.query.employees.findFirst({
    where: eq(employees.id, id),
    columns: { id: true },
  });

  if (!found) throw new Error('Employee not found');
}

async function assertUserExists(userId: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, userId),
    columns: { id: true },
  });

  if (!found) throw new Error('User not found');
}

async function assertEmployeeReferences(input: Partial<CreateEmployeeInput>) {
  if (input.userId) await assertUserExists(input.userId);
  if (input.departmentId) await assertDepartmentExists(input.departmentId);
  if (input.positionId) await assertPositionExists(input.positionId);
}

function normalizeDepartmentInput(input: UpdateDepartmentInput) {
  return removeUndefined({
    nameEn: input.nameEn,
    nameAm: input.nameAm,
    code: input.code,
    parentDepartmentId: input.parentDepartmentId,
    isActive: input.isActive,
  });
}

function normalizePositionInput(input: UpdatePositionInput) {
  return removeUndefined({
    nameEn: input.nameEn,
    nameAm: input.nameAm,
    code: input.code,
    isActive: input.isActive,
  });
}

function normalizeEmployeeInput(input: UpdateEmployeeInput) {
  let sourceImportedAt: Date | null | undefined;
  if (input.sourceImportedAt instanceof Date) {
    sourceImportedAt = input.sourceImportedAt;
  } else if (typeof input.sourceImportedAt === 'string' && input.sourceImportedAt) {
    sourceImportedAt = new Date(input.sourceImportedAt);
  } else if (input.sourceImportedAt === null) {
    sourceImportedAt = null;
  }

  return removeUndefined({
    userId: input.userId,
    employeeCode: input.employeeCode,
    payrollId: input.payrollId,
    biometricId: input.biometricId,
    firstNameEn: input.firstNameEn,
    middleNameEn: input.middleNameEn,
    lastNameEn: input.lastNameEn,
    firstNameAm: input.firstNameAm,
    middleNameAm: input.middleNameAm,
    lastNameAm: input.lastNameAm,
    gender: input.gender,
    phoneNumber: input.phoneNumber,
    email: input.email,
    departmentId: input.departmentId,
    positionId: input.positionId,
    positionName: input.positionName,
    employmentStatus: input.employmentStatus,
    employmentType: input.employmentType,
    hireDate: input.hireDate,
    terminationDate: input.terminationDate,
    sourceIdNo: input.sourceIdNo,
    sourceEmployeeCode: input.sourceEmployeeCode,
    sourceEmploymentStatus: input.sourceEmploymentStatus,
    sourceDepartmentName: input.sourceDepartmentName,
    sourcePositionName: input.sourcePositionName,
    sourcePositionCode: input.sourcePositionCode,
    salary: input.salary === null || input.salary === undefined ? input.salary : String(input.salary),
    salaryStep: input.salaryStep,
    sourceImportedAt,
    sourceRawPayload: input.sourceRawPayload,
    isActive: input.isActive,
  });
}

function employeeMatchesImport(
  employee: typeof employees.$inferSelect,
  input: ReturnType<typeof normalizeEmployeeInput>
) {
  return (
    (nullableString(employee.userId) !== null || nullableString(input.userId) === null) &&
    nullableString(employee.employeeCode) === nullableString(input.employeeCode) &&
    nullableString(employee.firstNameEn) === nullableString(input.firstNameEn) &&
    nullableString(employee.middleNameEn) === nullableString(input.middleNameEn) &&
    nullableString(employee.lastNameEn) === nullableString(input.lastNameEn) &&
    nullableString(employee.firstNameAm) === nullableString(input.firstNameAm) &&
    nullableString(employee.middleNameAm) === nullableString(input.middleNameAm) &&
    nullableString(employee.lastNameAm) === nullableString(input.lastNameAm) &&
    nullableString(employee.gender) === nullableString(input.gender) &&
    nullableString(employee.phoneNumber) === nullableString(input.phoneNumber) &&
    nullableString(employee.email) === nullableString(input.email) &&
    nullableString(employee.departmentId) === nullableString(input.departmentId) &&
    nullableString(employee.positionId) === nullableString(input.positionId) &&
    nullableString(employee.positionName) === nullableString(input.positionName) &&
    nullableString(employee.employmentStatus) === nullableString(input.employmentStatus) &&
    nullableString(employee.employmentType) === nullableString(input.employmentType) &&
    nullableString(employee.hireDate) === nullableString(input.hireDate) &&
    nullableString(employee.terminationDate) === nullableString(input.terminationDate) &&
    nullableString(employee.sourceIdNo) === nullableString(input.sourceIdNo) &&
    nullableString(employee.sourceEmployeeCode) === nullableString(input.sourceEmployeeCode) &&
    nullableString(employee.sourceEmploymentStatus) === nullableString(input.sourceEmploymentStatus) &&
    nullableString(employee.sourceDepartmentName) === nullableString(input.sourceDepartmentName) &&
    nullableString(employee.sourcePositionName) === nullableString(input.sourcePositionName) &&
    nullableString(employee.sourcePositionCode) === nullableString(input.sourcePositionCode) &&
    nullableString(employee.salary) === nullableString(input.salary) &&
    nullableString(employee.salaryStep) === nullableString(input.salaryStep) &&
    Boolean(employee.isActive) === Boolean(input.isActive)
  );
}

function nullableString(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeLookup(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildImportUserName(input: PermanentEmployeeImportInput) {
  return [input.firstNameEn, input.middleNameEn, input.lastNameEn]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim() || input.employeeCode;
}

function buildImportUserEmail(input: PermanentEmployeeImportInput) {
  const importedEmail = input.email?.trim().toLowerCase();
  if (importedEmail) return importedEmail;

  const firstInitial = normalizeEmailNamePart(input.firstNameEn).charAt(0);
  const middleName = normalizeEmailNamePart(input.middleNameEn ?? '');
  const fallbackName = normalizeEmailNamePart(input.lastNameEn);
  const localPart = `${firstInitial}${middleName || fallbackName}`;

  return `${localPart || randomUUID()}@mofed.gov.et`;
}

function normalizeEmailNamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
