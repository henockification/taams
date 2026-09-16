import { Context } from 'hono';
import {
  CreateTemporaryDepartmentAssignmentRequestSchema,
  UpdateTemporaryDepartmentAssignmentRequestSchema,
} from '../../../../schemas/core.schema';
import {
  createTemporaryDepartmentAssignment,
  deactivateTemporaryDepartmentAssignment,
  getTemporaryAssignmentEligibleEmployees,
  getTemporaryDepartmentAssignments,
  updateTemporaryDepartmentAssignment,
} from '../../../../db/orm/core/manageTemporaryDepartmentAssignments';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { clearSessionCookie, getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse, validationErrorResponse } from '../../helpers/errors';
import { formatEmployee, formatTemporaryDepartmentAssignment } from '../../helpers/formatters';

export async function getTemporaryAssignmentEligibleEmployeesHandler(c: Context) {
  try {
    await resolveContext(c);
    const employees = await getTemporaryAssignmentEligibleEmployees();
    return c.json({ success: true, employees: employees.map((employee) => formatEmployee(employee)) });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch eligible employees');
  }
}

export async function getTemporaryDepartmentAssignmentsHandler(c: Context) {
  try {
    const context = await resolveContext(c);
    const assignments = await getTemporaryDepartmentAssignments(context);

    return c.json({
      success: true,
      temporaryDepartmentAssignments: assignments.map(formatTemporaryDepartmentAssignment),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch temporary department assignments');
  }
}

export async function createTemporaryDepartmentAssignmentHandler(c: Context) {
  try {
    const context = await resolveContext(c);
    const parsed = CreateTemporaryDepartmentAssignmentRequestSchema.safeParse(await c.req.json().catch(() => ({})));

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const assignment = await createTemporaryDepartmentAssignment(parsed.data, context);

    return c.json(
      {
        success: true,
        temporaryDepartmentAssignment: formatTemporaryDepartmentAssignment(assignment),
      },
      201,
    );
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create temporary department assignment');
  }
}

export async function updateTemporaryDepartmentAssignmentHandler(c: Context) {
  try {
    const context = await resolveContext(c);
    const parsed = UpdateTemporaryDepartmentAssignmentRequestSchema.safeParse(await c.req.json().catch(() => ({})));

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const assignment = await updateTemporaryDepartmentAssignment(c.req.param('id'), parsed.data, context);

    return c.json({
      success: true,
      temporaryDepartmentAssignment: formatTemporaryDepartmentAssignment(assignment),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update temporary department assignment');
  }
}

export async function deactivateTemporaryDepartmentAssignmentHandler(c: Context) {
  try {
    const context = await resolveContext(c);
    const assignment = await deactivateTemporaryDepartmentAssignment(c.req.param('id'), context);

    return c.json({
      success: true,
      temporaryDepartmentAssignment: formatTemporaryDepartmentAssignment(assignment),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to deactivate temporary department assignment');
  }
}

async function resolveContext(c: Context) {
  const token = getSessionCookie(c);
  if (!token) throw new Error('Authentication required');

  const session = await getSessionByToken(token);
  if (!session?.user?.id) {
    clearSessionCookie(c);
    throw new Error('Authentication required');
  }

  const roles = (session.user.role ?? []).map((role) => role.toLowerCase());
  const canManageTemporaryAssignments = roles.some((role) =>
    ['super_admin', 'superadmin', 'admin', 'human_resource', 'hr', 'hr_manager', 'hr_clerk'].includes(role),
  );
  if (!canManageTemporaryAssignments) {
    throw new Error('Human Resources permission is required to manage temporary assignments');
  }

  return {
    userId: session.user.id,
    roles: session.user.role ?? [],
    scope: { type: 'unrestricted' as const },
  };
}
