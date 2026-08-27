import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../schemas/shared';
import {
  CreateDepartmentRequestSchema,
  CreateEmployeeRequestSchema,
  CreateEmployeeSupervisorRequestSchema,
  CreateEmployeeWorkScheduleRequestSchema,
  CreatePositionRequestSchema,
  DepartmentResponseSchema,
  DepartmentsResponseSchema,
  EmployeeResponseSchema,
  EmployeeSupervisorResponseSchema,
  EmployeeSupervisorsResponseSchema,
  EmployeeWorkScheduleResponseSchema,
  EmployeeWorkSchedulesResponseSchema,
  EmployeesResponseSchema,
  EmployeesPaginatedResponseSchema,
  PermanentEmployeeImportResponseSchema,
  PositionResponseSchema,
  PositionsResponseSchema,
  UpdateDepartmentRequestSchema,
  UpdateEmployeeRequestSchema,
  UpdateEmployeeWorkScheduleRequestSchema,
  UpdatePositionRequestSchema,
} from '../../schemas/core.schema';
import { openApiApp } from '../../lib/openapi';
import biometricDevicesApp from './biometric-devices/routes';
import biometricExemptionsApp from './biometric-exemptions/routes';
import holidaysApp from './holidays/routes';
import attendancePunchesApp from './attendance-punches/routes';
import attendanceApprovalsApp from './attendance-approvals/routes';
import manualPunchRequestsApp from './manual-punch-requests/routes';
import overtimeRequestsApp from './overtime-requests/routes';
import leaveManagementApp from './leave-management/routes';
import supervisorDelegationsApp from './supervisor-delegations/routes';
import notificationLogsApp from './notification-logs/routes';
import timeOperationsApp from './time-operations/routes';
import dashboardApp from './dashboard/routes';
import shiftsApp from './shifts/routes';
import workSchedulesApp from './work-schedules/routes';
import {
  createDepartmentHandler,
  getDepartmentsHandler,
  updateDepartmentHandler,
} from './handlers/departments';
import {
  createPositionHandler,
  getPositionsHandler,
  updatePositionHandler,
} from './handlers/positions';
import {
  createEmployeeHandler,
  createEmployeeSupervisorHandler,
  createEmployeeWorkScheduleHandler,
  deleteEmployeeWorkScheduleHandler,
  getAllEmployeeWorkSchedulesHandler,
  importContractEmployeesHandler,
  getEmployeeHandler,
  getEmployeesHandler,
  getEmployeesPaginatedHandler,
  getEmployeeSupervisorsHandler,
  getEmployeeWorkSchedulesHandler,
  importPermanentEmployeesHandler,
  updateEmployeeWorkScheduleHandler,
  updateEmployeeHandler,
} from './handlers/employees';

const coreApp = new Hono();

const uuidParam = z.object({
  id: z.string().uuid().openapi({ example: 'a52da4a6-4b69-4aa0-865c-1a03fddb731f' }),
});

export const createDepartmentRoute = createRoute({
  method: 'post',
  path: '/departments',
  tags: ['Core', 'Departments'],
  summary: 'Create Department',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateDepartmentRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: DepartmentResponseSchema } },
      description: 'Created department',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getDepartmentsRoute = createRoute({
  method: 'get',
  path: '/departments',
  tags: ['Core', 'Departments'],
  summary: 'Get Departments',
  responses: {
    200: {
      content: { 'application/json': { schema: DepartmentsResponseSchema } },
      description: 'Department list',
    },
  },
});

export const updateDepartmentRoute = createRoute({
  method: 'put',
  path: '/departments/{id}',
  tags: ['Core', 'Departments'],
  summary: 'Update Department',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateDepartmentRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DepartmentResponseSchema } },
      description: 'Updated department',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Department not found',
    },
  },
});

export const createPositionRoute = createRoute({
  method: 'post',
  path: '/positions',
  tags: ['Core', 'Positions'],
  summary: 'Create Position',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePositionRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: PositionResponseSchema } },
      description: 'Created position',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getPositionsRoute = createRoute({
  method: 'get',
  path: '/positions',
  tags: ['Core', 'Positions'],
  summary: 'Get Positions',
  responses: {
    200: {
      content: { 'application/json': { schema: PositionsResponseSchema } },
      description: 'Position list',
    },
  },
});

export const updatePositionRoute = createRoute({
  method: 'put',
  path: '/positions/{id}',
  tags: ['Core', 'Positions'],
  summary: 'Update Position',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdatePositionRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PositionResponseSchema } },
      description: 'Updated position',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Position not found',
    },
  },
});

export const createEmployeeRoute = createRoute({
  method: 'post',
  path: '/employees',
  tags: ['Core', 'Employees'],
  summary: 'Create Employee',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateEmployeeRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: EmployeeResponseSchema } },
      description: 'Created employee',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getEmployeesRoute = createRoute({
  method: 'get',
  path: '/employees',
  tags: ['Core', 'Employees'],
  summary: 'Get Employees',
  responses: {
    200: {
      content: { 'application/json': { schema: EmployeesResponseSchema } },
      description: 'Employee list',
    },
  },
});

export const getEmployeesPaginatedRoute = createRoute({
  method: 'get',
  path: '/employees/paginated',
  tags: ['Core', 'Employees'],
  summary: 'Get Employees Paginated',
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional(),
      pageSize: z.coerce.number().int().positive().optional(),
      search: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: EmployeesPaginatedResponseSchema } },
      description: 'Employee list with pagination',
    },
  },
});

export const getEmployeeRoute = createRoute({
  method: 'get',
  path: '/employees/{id}',
  tags: ['Core', 'Employees'],
  summary: 'Get Employee',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: EmployeeResponseSchema } },
      description: 'Employee detail',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Employee not found',
    },
  },
});

export const importPermanentEmployeesRoute = createRoute({
  method: 'post',
  path: '/employees/permanent/import',
  tags: ['Core', 'Employees'],
  summary: 'Import Permanent Employees From Excel',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any().openapi({ type: 'string', format: 'binary' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PermanentEmployeeImportResponseSchema } },
      description: 'Permanent employee import result',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid import file or all rows failed',
    },
  },
});

export const importContractEmployeesRoute = createRoute({
  method: 'post',
  path: '/employees/contract/import',
  tags: ['Core', 'Employees'],
  summary: 'Import Contract Employees From Excel',
  request: {
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any().openapi({ type: 'string', format: 'binary' }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: PermanentEmployeeImportResponseSchema } },
      description: 'Contract employee import result',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid import file or all rows failed',
    },
  },
});

export const updateEmployeeRoute = createRoute({
  method: 'put',
  path: '/employees/{id}',
  tags: ['Core', 'Employees'],
  summary: 'Update Employee',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateEmployeeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: EmployeeResponseSchema } },
      description: 'Updated employee',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Employee not found',
    },
  },
});

export const createEmployeeSupervisorRoute = createRoute({
  method: 'post',
  path: '/employees/{id}/supervisors',
  tags: ['Core', 'Employees'],
  summary: 'Assign Employee Supervisor',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: CreateEmployeeSupervisorRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: EmployeeSupervisorResponseSchema } },
      description: 'Created supervisor assignment',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getEmployeeSupervisorsRoute = createRoute({
  method: 'get',
  path: '/employees/{id}/supervisors',
  tags: ['Core', 'Employees'],
  summary: 'Get Employee Supervisors',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: EmployeeSupervisorsResponseSchema } },
      description: 'Employee supervisors',
    },
  },
});

export const createEmployeeWorkScheduleRoute = createRoute({
  method: 'post',
  path: '/employees/{id}/work-schedules',
  tags: ['Core', 'Employees'],
  summary: 'Assign Employee Work Schedule',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: CreateEmployeeWorkScheduleRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: EmployeeWorkScheduleResponseSchema } },
      description: 'Created employee work schedule assignment',
    },
    400: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Invalid request',
    },
  },
});

export const getEmployeeWorkSchedulesRoute = createRoute({
  method: 'get',
  path: '/employees/{id}/work-schedules',
  tags: ['Core', 'Employees'],
  summary: 'Get Employee Work Schedules',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: EmployeeWorkSchedulesResponseSchema } },
      description: 'Employee work schedules',
    },
  },
});

export const getAllEmployeeWorkSchedulesRoute = createRoute({
  method: 'get',
  path: '/employees/work-schedules',
  tags: ['Core', 'Employees'],
  summary: 'Get All Employee Work Schedule Assignments',
  responses: {
    200: {
      content: { 'application/json': { schema: EmployeeWorkSchedulesResponseSchema } },
      description: 'Employee work schedule assignments',
    },
  },
});

export const updateEmployeeWorkScheduleRoute = createRoute({
  method: 'put',
  path: '/employees/work-schedules/{id}',
  tags: ['Core', 'Employees'],
  summary: 'Update Employee Work Schedule Assignment',
  request: {
    params: uuidParam,
    body: {
      content: {
        'application/json': {
          schema: UpdateEmployeeWorkScheduleRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: EmployeeWorkScheduleResponseSchema } },
      description: 'Updated employee work schedule assignment',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Assignment not found',
    },
  },
});

export const deleteEmployeeWorkScheduleRoute = createRoute({
  method: 'delete',
  path: '/employees/work-schedules/{id}',
  tags: ['Core', 'Employees'],
  summary: 'Remove Employee Work Schedule Assignment',
  request: {
    params: uuidParam,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: z.object({ success: z.boolean() }) } },
      description: 'Removed employee work schedule assignment',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Assignment not found',
    },
  },
});

coreApp.post('/departments', createDepartmentHandler);
coreApp.get('/departments', getDepartmentsHandler);
coreApp.put('/departments/:id', updateDepartmentHandler);
coreApp.post('/positions', createPositionHandler);
coreApp.get('/positions', getPositionsHandler);
coreApp.put('/positions/:id', updatePositionHandler);
coreApp.post('/employees', createEmployeeHandler);
coreApp.get('/employees', getEmployeesHandler);
coreApp.get('/employees/paginated', getEmployeesPaginatedHandler);
coreApp.post('/employees/permanent/import', importPermanentEmployeesHandler);
coreApp.post('/employees/contract/import', importContractEmployeesHandler);
coreApp.get('/employees/work-schedules', getAllEmployeeWorkSchedulesHandler);
coreApp.put('/employees/work-schedules/:id', updateEmployeeWorkScheduleHandler);
coreApp.delete('/employees/work-schedules/:id', deleteEmployeeWorkScheduleHandler);
coreApp.get('/employees/:id', getEmployeeHandler);
coreApp.put('/employees/:id', updateEmployeeHandler);
coreApp.post('/employees/:id/supervisors', createEmployeeSupervisorHandler);
coreApp.get('/employees/:id/supervisors', getEmployeeSupervisorsHandler);
coreApp.post('/employees/:id/work-schedules', createEmployeeWorkScheduleHandler);
coreApp.get('/employees/:id/work-schedules', getEmployeeWorkSchedulesHandler);
coreApp.route('/', dashboardApp);
coreApp.route('/', biometricDevicesApp);
coreApp.route('/', biometricExemptionsApp);
coreApp.route('/', holidaysApp);
coreApp.route('/', attendancePunchesApp);
coreApp.route('/', attendanceApprovalsApp);
coreApp.route('/', manualPunchRequestsApp);
coreApp.route('/', overtimeRequestsApp);
coreApp.route('/', leaveManagementApp);
coreApp.route('/', supervisorDelegationsApp);
coreApp.route('/', notificationLogsApp);
coreApp.route('/', timeOperationsApp);
coreApp.route('/', shiftsApp);
coreApp.route('/', workSchedulesApp);

openApiApp
  .openapi(createDepartmentRoute, createDepartmentHandler as any)
  .openapi(getDepartmentsRoute, getDepartmentsHandler as any)
  .openapi(updateDepartmentRoute, updateDepartmentHandler as any)
  .openapi(createPositionRoute, createPositionHandler as any)
  .openapi(getPositionsRoute, getPositionsHandler as any)
  .openapi(updatePositionRoute, updatePositionHandler as any)
  .openapi(createEmployeeRoute, createEmployeeHandler as any)
  .openapi(getEmployeesRoute, getEmployeesHandler as any)
  .openapi(getEmployeesPaginatedRoute, getEmployeesPaginatedHandler as any)
  .openapi(importPermanentEmployeesRoute, importPermanentEmployeesHandler as any)
  .openapi(importContractEmployeesRoute, importContractEmployeesHandler as any)
  .openapi(getEmployeeRoute, getEmployeeHandler as any)
  .openapi(updateEmployeeRoute, updateEmployeeHandler as any)
  .openapi(createEmployeeSupervisorRoute, createEmployeeSupervisorHandler as any)
  .openapi(getEmployeeSupervisorsRoute, getEmployeeSupervisorsHandler as any)
  .openapi(createEmployeeWorkScheduleRoute, createEmployeeWorkScheduleHandler as any)
  .openapi(getEmployeeWorkSchedulesRoute, getEmployeeWorkSchedulesHandler as any)
  .openapi(getAllEmployeeWorkSchedulesRoute, getAllEmployeeWorkSchedulesHandler as any)
  .openapi(updateEmployeeWorkScheduleRoute, updateEmployeeWorkScheduleHandler as any)
  .openapi(deleteEmployeeWorkScheduleRoute, deleteEmployeeWorkScheduleHandler as any);

export default coreApp;
