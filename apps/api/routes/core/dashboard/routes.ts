import { Hono } from 'hono';
import { createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../../../schemas/shared';
import { DashboardSummaryResponseSchema, DepartmentHeadDashboardSummaryResponseSchema, ExecutiveDashboardSummaryResponseSchema, HrDashboardSummaryResponseSchema } from '../../../schemas/core.schema';
import { openApiApp } from '../../../lib/openapi';
import { getDashboardSummaryHandler, getDepartmentHeadDashboardSummaryHandler, getExecutiveDashboardSummaryHandler, getHrDashboardSummaryHandler } from './handlers/dashboard';

const dashboardApp = new Hono();

export const getDashboardSummaryRoute = createRoute({
  method: 'get',
  path: '/dashboard/summary',
  tags: ['Core', 'Dashboard'],
  summary: 'Get Role-Aware Dashboard Summary',
  responses: {
    200: {
      content: { 'application/json': { schema: DashboardSummaryResponseSchema } },
      description: 'Role-aware dashboard summary',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Authentication required',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Failed to fetch dashboard summary',
    },
  },
});

export const getExecutiveDashboardSummaryRoute = createRoute({
  method: 'get',
  path: '/executive-dashboard/summary',
  tags: ['Core', 'Dashboard'],
  summary: 'Get Executive Dashboard Summary',
  request: {
    query: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ExecutiveDashboardSummaryResponseSchema } },
      description: 'Executive dashboard summary',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Authentication required',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Permission required',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Failed to fetch executive dashboard summary',
    },
  },
});

export const getHrDashboardSummaryRoute = createRoute({
  method: 'get',
  path: '/hr-dashboard/summary',
  tags: ['Core', 'Dashboard'],
  summary: 'Get HR Dashboard Summary',
  request: {
    query: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: HrDashboardSummaryResponseSchema } },
      description: 'HR dashboard summary',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Authentication required',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Permission required',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Failed to fetch HR dashboard summary',
    },
  },
});

export const getDepartmentHeadDashboardSummaryRoute = createRoute({
  method: 'get',
  path: '/department-head-dashboard/summary',
  tags: ['Core', 'Dashboard'],
  summary: 'Get Supervisor Dashboard Summary',
  request: {
    query: z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DepartmentHeadDashboardSummaryResponseSchema } },
      description: 'Supervisor dashboard summary',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Authentication required',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Permission required',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Failed to fetch supervisor dashboard summary',
    },
  },
});

dashboardApp.get('/dashboard/summary', getDashboardSummaryHandler);
dashboardApp.get('/executive-dashboard/summary', getExecutiveDashboardSummaryHandler);
dashboardApp.get('/hr-dashboard/summary', getHrDashboardSummaryHandler);
dashboardApp.get('/department-head-dashboard/summary', getDepartmentHeadDashboardSummaryHandler);

openApiApp.openapi(getDashboardSummaryRoute, getDashboardSummaryHandler as any);
openApiApp.openapi(getExecutiveDashboardSummaryRoute, getExecutiveDashboardSummaryHandler as any);
openApiApp.openapi(getHrDashboardSummaryRoute, getHrDashboardSummaryHandler as any);
openApiApp.openapi(getDepartmentHeadDashboardSummaryRoute, getDepartmentHeadDashboardSummaryHandler as any);

export default dashboardApp;
