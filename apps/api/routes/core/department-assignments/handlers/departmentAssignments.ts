import { Context } from 'hono';
import { z } from 'zod';
import {
  assertCanManageHrDepartmentAssignments,
  getHrDepartmentAssignments,
  getHrDepartmentAssignmentUsers,
  replaceHrDepartmentAssignments,
} from '../../../../db/orm/core/manageHrDepartmentAssignments';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatDepartment } from '../../helpers/formatters';

const ReplaceHrDepartmentAssignmentsSchema = z.object({
  departmentIds: z.array(z.string().uuid()).default([]),
});

export async function getHrDepartmentAssignmentUsersHandler(c: Context) {
  try {
    const session = await resolveManagerSession(c);
    await assertCanManageHrDepartmentAssignments({
      userId: session.user.id,
      roles: session.user.role ?? [],
    });

    const users = await getHrDepartmentAssignmentUsers();
    return c.json({
      success: true,
      users: users.map(formatHrDepartmentAssignmentUser),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch HR department assignment users');
  }
}

export async function getHrDepartmentAssignmentsHandler(c: Context) {
  try {
    const session = await resolveManagerSession(c);
    await assertCanManageHrDepartmentAssignments({
      userId: session.user.id,
      roles: session.user.role ?? [],
    });

    const assignments = await getHrDepartmentAssignments();
    return c.json({
      success: true,
      assignments: assignments.map(formatHrDepartmentAssignment),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch HR department assignments');
  }
}

export async function replaceHrDepartmentAssignmentsHandler(c: Context) {
  try {
    const session = await resolveManagerSession(c);
    await assertCanManageHrDepartmentAssignments({
      userId: session.user.id,
      roles: session.user.role ?? [],
    });

    const parsed = ReplaceHrDepartmentAssignmentsSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) return validationErrorResponse(c, parsed.error.message);

    const user = await replaceHrDepartmentAssignments({
      targetUserId: c.req.param('userId'),
      departmentIds: parsed.data.departmentIds,
      actorUserId: session.user.id,
    });

    if (!user) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    return c.json({
      success: true,
      user: formatHrDepartmentAssignmentUser(user),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update HR department assignments');
  }
}

async function resolveManagerSession(c: Context) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');
  const session = await getSessionByToken(token);
  if (!session?.user?.id) throw new Error('Authentication required');
  return session;
}

function formatHrDepartmentAssignmentUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role ?? [],
    roles: user.roles ?? [],
    departmentAssignments: (user.departmentAssignments ?? []).map(formatHrDepartmentAssignment),
  };
}

function formatHrDepartmentAssignment(assignment: any) {
  return {
    id: assignment.id,
    userId: assignment.userId,
    departmentId: assignment.departmentId,
    isActive: assignment.isActive,
    createdBy: assignment.createdBy ?? null,
    updatedBy: assignment.updatedBy ?? null,
    createdAt: assignment.createdAt instanceof Date ? assignment.createdAt.toISOString() : assignment.createdAt,
    updatedAt: assignment.updatedAt instanceof Date ? assignment.updatedAt.toISOString() : assignment.updatedAt,
    department: assignment.department ? formatDepartment(assignment.department) : undefined,
    user: assignment.user
      ? {
          id: assignment.user.id,
          name: assignment.user.name,
          email: assignment.user.email ?? null,
          phone: assignment.user.phone ?? null,
          role: assignment.user.role ?? [],
        }
      : undefined,
  };
}
