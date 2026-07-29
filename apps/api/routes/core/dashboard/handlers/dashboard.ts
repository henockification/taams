import { Context } from 'hono';
import { getDashboardSummaryForUser } from '../../../../db/orm/core/manageDashboard';
import { getDepartmentHeadDashboardSummary } from '../../../../db/orm/core/manageDepartmentHeadDashboard';
import { getExecutiveDashboardSummary } from '../../../../db/orm/core/manageExecutiveDashboard';
import { getHrDashboardSummary } from '../../../../db/orm/core/manageHrDashboard';
import { userHasPermission } from '../../../../db/orm/rbac/manageRbac';
import { getSessionByToken } from '../../../../db/orm/auth/manageAuth';
import { clearSessionCookie, getSessionCookie } from '../../../auth/handlers/helpers';
import { coreErrorResponse } from '../../helpers/errors';
import { formatDashboardSummary } from '../../helpers/formatters';

export async function getDashboardSummaryHandler(c: Context) {
  try {
    const token = getSessionCookie(c);

    if (!token) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const session = await getSessionByToken(token);

    if (!session) {
      clearSessionCookie(c);
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const dashboard = await getDashboardSummaryForUser({
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      role: session.user.role,
    });

    return c.json({
      success: true,
      dashboard: formatDashboardSummary(dashboard),
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch dashboard summary');
  }
}

export async function getExecutiveDashboardSummaryHandler(c: Context) {
  try {
    const token = getSessionCookie(c);

    if (!token) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const session = await getSessionByToken(token);

    if (!session) {
      clearSessionCookie(c);
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const roles = (session.user.role ?? []).map((role) => role.toLowerCase());
    const hasExecutiveRole = roles.some((role) => (
      role === 'super_admin'
      || role === 'executive'
    ));
    const hasPermission = hasExecutiveRole || await userHasPermission(session.user.id, 'executive-dashboard:read');

    if (!hasPermission) {
      return c.json({ success: false, error: 'You do not have permission to view the executive dashboard' }, 403);
    }

    const date = c.req.query('date');
    const month = c.req.query('month');
    const executiveDashboard = await getExecutiveDashboardSummary({ date, month });

    return c.json({
      success: true,
      executiveDashboard,
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch executive dashboard summary');
  }
}

export async function getHrDashboardSummaryHandler(c: Context) {
  try {
    const token = getSessionCookie(c);

    if (!token) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const session = await getSessionByToken(token);

    if (!session) {
      clearSessionCookie(c);
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const roles = (session.user.role ?? []).map((role) => role.toLowerCase());
    const hasHrRole = roles.some((role) => (
      role === 'human_resource'
      || role === 'super_admin'
    ));
    const hasPermission = hasHrRole || await userHasPermission(session.user.id, 'hr-dashboard:read');

    if (!hasPermission) {
      return c.json({ success: false, error: 'You do not have permission to view the HR dashboard' }, 403);
    }

    const date = c.req.query('date');
    const hrDashboard = await getHrDashboardSummary({ date, userId: session.user.id });

    return c.json({
      success: true,
      hrDashboard,
    });
  } catch (error) {
    return coreErrorResponse(c, error, 'Failed to fetch HR dashboard summary');
  }
}

export async function getDepartmentHeadDashboardSummaryHandler(c: Context) {
  try {
    const token = getSessionCookie(c);

    if (!token) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const session = await getSessionByToken(token);

    if (!session) {
      clearSessionCookie(c);
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }

    const roles = (session.user.role ?? []).map((role) => role.toLowerCase());
    const hasRole = roles.some((role) => (
      role === 'super_admin'
      || role === 'admin'
      || role === 'manager'
      || role === 'department_manager'
      || role === 'department_head'
      || role === 'supervisor'
    ));
    const hasPermission = await userHasPermission(session.user.id, 'department-head-dashboard:read');

    const date = c.req.query('date');
    const departmentHeadDashboard = await getDepartmentHeadDashboardSummary({
      userId: session.user.id,
      roles: hasRole || hasPermission ? [...(session.user.role ?? []), 'supervisor'] : session.user.role,
      date,
    });

    return c.json({
      success: true,
      departmentHeadDashboard,
    });
  } catch (error) {
    if (
      error instanceof Error
      && (
        error.message.includes('requires a linked employee profile')
        || error.message.includes('available only to supervisors')
      )
    ) {
      return c.json({ success: false, error: error.message }, 403);
    }

    return coreErrorResponse(c, error, 'Failed to fetch supervisor dashboard summary');
  }
}
