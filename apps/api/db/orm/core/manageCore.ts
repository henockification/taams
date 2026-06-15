import { asc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { departments, employeeSupervisors, employees, positions, user } from '../../schema';
import type {
  CreateDepartmentInput,
  CreateEmployeeInput,
  CreateEmployeeSupervisorInput,
  CreatePositionInput,
  UpdateDepartmentInput,
  UpdateEmployeeInput,
  UpdatePositionInput,
} from '../../../types/core.types';

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
    employmentStatus: input.employmentStatus,
    employmentType: input.employmentType,
    hireDate: input.hireDate,
    terminationDate: input.terminationDate,
    isActive: input.isActive,
  });
}

function removeUndefined<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}
