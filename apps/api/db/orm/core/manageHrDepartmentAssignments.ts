import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../../db';
import { departments, hrDepartmentAssignments, roles, user, userRoles } from '../../schema';
import { diffChanges, writeAuditEvent } from '../../../lib/audit';
import { normalizeRoleName } from '../../../lib/privileged-roles';

type DbClient = typeof db | any;

export type HrDepartmentAssignmentUser = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string[] | null;
  roles: string[];
  departmentAssignments: Array<{
    id: string;
    userId: string;
    departmentId: string;
    isActive: boolean;
    createdBy: string | null;
    updatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
    department: typeof departments.$inferSelect;
  }>;
};

export async function assertCanManageHrDepartmentAssignments(input: {
  userId: string;
  roles?: string[] | null;
}) {
  const roleNames = await getCombinedRoleNames(input.userId, input.roles);
  const hasUnrestrictedRole = roleNames.some((role) => ['super_admin', 'superadmin', 'admin', 'executive'].includes(role));
  const hasHrSupervisorRoles = roleNames.includes('human_resource') && roleNames.includes('supervisor');

  if (!hasUnrestrictedRole && !hasHrSupervisorRoles) {
    throw new Error('Department assignment management permission is required');
  }
}

export async function getHrDepartmentAssignmentUsers() {
  const users = await db.query.user.findMany({
    with: {
      userRoles: {
        with: {
          role: true,
        },
      },
      hrDepartmentAssignments: {
        where: eq(hrDepartmentAssignments.isActive, true),
        with: {
          department: true,
        },
        orderBy: (table, { asc }) => [asc(table.createdAt)],
      },
    },
    orderBy: (table, { asc }) => [asc(table.name)],
  });

  return users
    .map(formatHrUserCandidate)
    .filter((candidate) => candidate.roles.includes('human_resource'));
}

export async function getHrDepartmentAssignments() {
  return db.query.hrDepartmentAssignments.findMany({
    where: eq(hrDepartmentAssignments.isActive, true),
    with: {
      user: true,
      department: true,
      createdByUser: true,
      updatedByUser: true,
    },
    orderBy: (table, { asc }) => [asc(table.createdAt)],
  });
}

export async function replaceHrDepartmentAssignments(input: {
  targetUserId: string;
  departmentIds: string[];
  actorUserId: string;
}) {
  const departmentIds = [...new Set(input.departmentIds.filter(Boolean))];

  return db.transaction(async (tx) => {
    const targetUser = await tx.query.user.findFirst({
      where: eq(user.id, input.targetUserId),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    });

    if (!targetUser) throw new Error('User not found');
    const targetRoles = getRoleNamesFromUser(targetUser);
    if (!targetRoles.includes('human_resource')) {
      throw new Error('Only human_resource users can receive department assignments');
    }

    if (departmentIds.length > 0) {
      const foundDepartments = await tx.query.departments.findMany({
        where: inArray(departments.id, departmentIds),
        columns: { id: true },
      });
      const foundIds = new Set(foundDepartments.map((department: { id: string }) => department.id));
      const missing = departmentIds.filter((departmentId) => !foundIds.has(departmentId));
      if (missing.length > 0) throw new Error('One or more departments were not found');
    }

    const existing = await tx.query.hrDepartmentAssignments.findMany({
      where: and(
        eq(hrDepartmentAssignments.userId, input.targetUserId),
        eq(hrDepartmentAssignments.isActive, true),
      ),
      columns: { id: true, departmentId: true },
    });

    const nextIds = new Set(departmentIds);
    const existingIds = new Set(existing.map((assignment: { departmentId: string }) => assignment.departmentId));
    const deactivateIds = existing
      .filter((assignment: { id: string; departmentId: string }) => !nextIds.has(assignment.departmentId))
      .map((assignment: { id: string }) => assignment.id);
    const createIds = departmentIds.filter((departmentId) => !existingIds.has(departmentId));

    if (deactivateIds.length > 0) {
      await tx
        .update(hrDepartmentAssignments)
        .set({
          isActive: false,
          updatedBy: input.actorUserId,
          updatedAt: new Date(),
        })
        .where(inArray(hrDepartmentAssignments.id, deactivateIds));
    }

    if (departmentIds.length > 0) {
      await tx
        .update(hrDepartmentAssignments)
        .set({
          updatedBy: input.actorUserId,
          updatedAt: new Date(),
        })
        .where(and(
          eq(hrDepartmentAssignments.userId, input.targetUserId),
          eq(hrDepartmentAssignments.isActive, true),
        ));
    }

    if (createIds.length > 0) {
      await tx.insert(hrDepartmentAssignments).values(
        createIds.map((departmentId) => ({
          userId: input.targetUserId,
          departmentId,
          createdBy: input.actorUserId,
          updatedBy: input.actorUserId,
        })),
      );
    }

    await writeAuditEvent(tx, {
      action: 'HR_DEPARTMENT_ASSIGNMENTS_REPLACED',
      resourceType: 'user',
      resourceId: input.targetUserId,
      resourceLabel: targetUser.name,
      actorUserId: input.actorUserId,
      metadata: {
        departmentIds,
        created: createIds.length,
        deactivated: deactivateIds.length,
      },
      changes: diffChanges(
        { departmentIds: existing.map((assignment: { departmentId: string }) => assignment.departmentId).sort() },
        { departmentIds: [...departmentIds].sort() },
      ),
    });

    return getHrDepartmentAssignmentUserById(input.targetUserId, tx);
  });
}

async function getHrDepartmentAssignmentUserById(userId: string, tx: DbClient = db) {
  const found = await tx.query.user.findFirst({
    where: eq(user.id, userId),
    with: {
      userRoles: {
        with: {
          role: true,
        },
      },
      hrDepartmentAssignments: {
        where: eq(hrDepartmentAssignments.isActive, true),
        with: {
          department: true,
        },
        orderBy: (table: any, { asc }: any) => [asc(table.createdAt)],
      },
    },
  });

  return found ? formatHrUserCandidate(found) : null;
}

async function getCombinedRoleNames(userId: string, legacyRoles?: string[] | null) {
  const assignedRows = await db
    .select({ name: roles.name })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId));

  return [
    ...new Set([
      ...(legacyRoles ?? []).map(normalizeRoleName),
      ...assignedRows.map((row) => normalizeRoleName(row.name)),
    ]),
  ];
}

function formatHrUserCandidate(candidate: any): HrDepartmentAssignmentUser {
  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email ?? null,
    phone: candidate.phone ?? null,
    role: candidate.role ?? [],
    roles: getRoleNamesFromUser(candidate),
    departmentAssignments: candidate.hrDepartmentAssignments ?? [],
  };
}

function getRoleNamesFromUser(candidate: any) {
  return [
    ...new Set([
      ...(candidate.role ?? []).map(normalizeRoleName),
      ...((candidate.userRoles ?? []).map((userRole: any) => normalizeRoleName(userRole.role?.name ?? '')).filter(Boolean)),
    ]),
  ];
}
