import { Context } from 'hono';
import {
  CreateDepartmentRequestSchema,
  MoveDepartmentRequestSchema,
  SetDepartmentHeadRequestSchema,
  UpdateDepartmentRequestSchema,
} from '../../../schemas/core.schema';
import {
  createDepartment,
  getDepartments,
  moveDepartment,
  searchDepartmentHeadCandidates,
  setDepartmentHead,
  updateDepartment,
} from '../../../db/orm/core/manageCore';
import { coreErrorResponse, validationErrorResponse } from '../helpers/errors';
import { formatDepartment } from '../helpers/formatters';

export async function createDepartmentHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreateDepartmentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const department = await createDepartment(parsed.data);

    return c.json({
      success: true,
      department: formatDepartment(department),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create department');
  }
}

export async function getDepartmentsHandler(c: Context) {
  try {
    const result = await getDepartments();

    return c.json({
      success: true,
      departments: result.map(formatDepartment),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch departments');
  }
}

export async function updateDepartmentHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateDepartmentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const department = await updateDepartment(id, parsed.data);

    return c.json({
      success: true,
      department: formatDepartment(department),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update department');
  }
}

export async function moveDepartmentHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = MoveDepartmentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const department = await moveDepartment(id, parsed.data);

    return c.json({
      success: true,
      department: formatDepartment(department),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to move department');
  }
}

export async function setDepartmentHeadHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = SetDepartmentHeadRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const department = await setDepartmentHead(id, parsed.data);

    return c.json({
      success: true,
      department: formatDepartment(department),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to set department head');
  }
}

export async function getDepartmentHeadCandidatesHandler(c: Context) {
  try {
    const candidates = await searchDepartmentHeadCandidates(c.req.query('search') ?? '');

    return c.json({
      success: true,
      employees: candidates.map((employee) => ({
        id: employee.id,
        employeeCode: employee.employeeCode,
        fullName: [employee.firstNameEn, employee.middleNameEn, employee.lastNameEn].filter(Boolean).join(' '),
        departmentName: employee.department?.nameEn ?? null,
      })),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to search department head candidates');
  }
}
