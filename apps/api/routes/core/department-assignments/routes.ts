import { Hono } from 'hono';
import {
  getHrDepartmentAssignmentsHandler,
  getHrDepartmentAssignmentUsersHandler,
  replaceHrDepartmentAssignmentsHandler,
} from './handlers/departmentAssignments';

const departmentAssignmentsApp = new Hono();

departmentAssignmentsApp.get('/department-assignments/hr-users', getHrDepartmentAssignmentUsersHandler);
departmentAssignmentsApp.get('/department-assignments', getHrDepartmentAssignmentsHandler);
departmentAssignmentsApp.put('/department-assignments/:userId', replaceHrDepartmentAssignmentsHandler);

export default departmentAssignmentsApp;
