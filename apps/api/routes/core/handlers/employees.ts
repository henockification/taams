import { Context } from 'hono';
import {
  CreateEmployeeRequestSchema,
  CreateEmployeeSupervisorRequestSchema,
  CreateEmployeeWorkScheduleRequestSchema,
  UpdateEmployeeRequestSchema,
} from '../../../schemas/core.schema';
import {
  createEmployee,
  createEmployeeSupervisor,
  getEmployeeById,
  getEmployees,
  getEmployeeSupervisors,
  updateEmployee,
} from '../../../db/orm/core/manageCore';
import {
  createEmployeeWorkSchedule as createEmployeeWorkScheduleRecord,
  getEmployeeWorkSchedules as getEmployeeWorkScheduleRecords,
} from '../../../db/orm/core/manageWorkSchedules';
import { coreErrorResponse, validationErrorResponse } from '../helpers/errors';
import {
  formatEmployee,
  formatEmployeeSupervisor,
  formatEmployeeWorkSchedule,
} from '../helpers/formatters';

export async function createEmployeeHandler(c: Context) {
  try {
    const body = await c.req.json();
    const parsed = CreateEmployeeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const employee = await createEmployee(parsed.data);

    return c.json({
      success: true,
      employee: formatEmployee(employee),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to create employee');
  }
}

export async function getEmployeesHandler(c: Context) {
  try {
    const result = await getEmployees();

    return c.json({
      success: true,
      employees: result.map(formatEmployee),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch employees');
  }
}

export async function getEmployeeHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const employee = await getEmployeeById(id);

    if (!employee) {
      return c.json({
        success: false,
        error: 'Employee not found',
      }, 404);
    }

    return c.json({
      success: true,
      employee: formatEmployee(employee),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch employee');
  }
}

export async function updateEmployeeHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateEmployeeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const employee = await updateEmployee(id, parsed.data);

    return c.json({
      success: true,
      employee: formatEmployee(employee),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update employee');
  }
}

export async function createEmployeeSupervisorHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = CreateEmployeeSupervisorRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const supervisor = await createEmployeeSupervisor(id, parsed.data);

    return c.json({
      success: true,
      supervisor: formatEmployeeSupervisor(supervisor),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to assign employee supervisor');
  }
}

export async function getEmployeeSupervisorsHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const supervisors = await getEmployeeSupervisors(id);

    return c.json({
      success: true,
      supervisors: supervisors.map(formatEmployeeSupervisor),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch employee supervisors');
  }
}

export async function createEmployeeWorkScheduleHandler(c: Context) {
  try {
    const employeeId = c.req.param('id');
    const body = await c.req.json();
    const parsed = CreateEmployeeWorkScheduleRequestSchema.safeParse({
      ...body,
      employeeId,
    });

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const employeeWorkSchedule = await createEmployeeWorkScheduleRecord(parsed.data);

    return c.json({
      success: true,
      employeeWorkSchedule: formatEmployeeWorkSchedule(employeeWorkSchedule),
    }, 201);
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to assign employee work schedule');
  }
}

export async function getEmployeeWorkSchedulesHandler(c: Context) {
  try {
    const employeeId = c.req.param('id');
    const schedules = await getEmployeeWorkScheduleRecords(employeeId);

    return c.json({
      success: true,
      employeeWorkSchedules: schedules.map(formatEmployeeWorkSchedule),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch employee work schedules');
  }
}
