import { Context } from 'hono';
import {
  CreateEmployeeRequestSchema,
  CreateEmployeeSupervisorRequestSchema,
  CreateEmployeeWorkScheduleRequestSchema,
  UpdateEmployeeRequestSchema,
  UpdateEmployeeWorkScheduleRequestSchema,
} from '../../../schemas/core.schema';
import {
  createEmployee,
  createEmployeeSupervisor,
  getEmployeeById,
  getEmployees,
  getEmployeesPaginated,
  getEmployeeSupervisors,
  upsertPermanentEmployees,
  updateEmployee,
} from '../../../db/orm/core/manageCore';
import {
  mapExcelRowToEmployeeInput,
  parseEmployeeWorkbook,
} from '../../../lib/employees/excel-import';
import {
  createEmployeeWorkSchedule as createEmployeeWorkScheduleRecord,
  deleteEmployeeWorkSchedule,
  getAllEmployeeWorkSchedules,
  getEmployeeWorkSchedules as getEmployeeWorkScheduleRecords,
  updateEmployeeWorkSchedule,
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

export async function getEmployeesPaginatedHandler(c: Context) {
  try {
    const page = Number(c.req.query('page') || 1);
    const pageSize = Number(c.req.query('pageSize') || 50);
    const search = c.req.query('search') || '';
    const result = await getEmployeesPaginated({ page, pageSize, search });

    return c.json({
      success: true,
      employees: result.employees.map(formatEmployee),
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
      },
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

export async function importPermanentEmployeesHandler(c: Context) {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string' || typeof (file as any).arrayBuffer !== 'function') {
      return validationErrorResponse(c, 'An .xls or .xlsx file is required');
    }

    const upload = file as File;
    const buffer = Buffer.from(await upload.arrayBuffer());
    const rows = parseEmployeeWorkbook(buffer, upload.name);
    const seenEmployeeCodes = new Set<string>();
    const errors: { rowNumber: number; employeeCode: string | null; errors: string[] }[] = [];
    const validInputs = [];

    for (const [index, row] of rows.entries()) {
      const mapped = mapExcelRowToEmployeeInput(row, index + 2);

      if (!mapped.input) {
        errors.push({
          rowNumber: mapped.rowNumber,
          employeeCode: null,
          errors: mapped.errors,
        });
        continue;
      }

      if (seenEmployeeCodes.has(mapped.input.employeeCode)) {
        errors.push({
          rowNumber: mapped.rowNumber,
          employeeCode: mapped.input.employeeCode,
          errors: [`Duplicate Employee Id No in uploaded file: ${mapped.input.employeeCode}`],
        });
        continue;
      }
      seenEmployeeCodes.add(mapped.input.employeeCode);

      validInputs.push(mapped.input);
    }

    const result = validInputs.length > 0
      ? await upsertPermanentEmployees(validInputs)
      : { created: 0, updated: 0, skipped: 0, employees: [] };

    return c.json({
      success: true,
      created: result.created,
      updated: result.updated,
      skipped: result.skipped,
      failed: errors.length,
      totalRows: rows.length,
      errors,
      employees: result.employees.map(formatEmployee),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to import permanent employees');
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

export async function getAllEmployeeWorkSchedulesHandler(c: Context) {
  try {
    const schedules = await getAllEmployeeWorkSchedules();

    return c.json({
      success: true,
      employeeWorkSchedules: schedules.map(formatEmployeeWorkSchedule),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch employee work schedules');
  }
}

export async function updateEmployeeWorkScheduleHandler(c: Context) {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = UpdateEmployeeWorkScheduleRequestSchema.safeParse(body);

    if (!parsed.success) {
      return validationErrorResponse(c, parsed.error.message);
    }

    const employeeWorkSchedule = await updateEmployeeWorkSchedule(id, parsed.data);

    return c.json({
      success: true,
      employeeWorkSchedule: formatEmployeeWorkSchedule(employeeWorkSchedule),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to update employee work schedule');
  }
}

export async function deleteEmployeeWorkScheduleHandler(c: Context) {
  try {
    const id = c.req.param('id');
    await deleteEmployeeWorkSchedule(id);

    return c.json({ success: true });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to remove employee work schedule');
  }
}
