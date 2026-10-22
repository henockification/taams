import { Context } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../../../db/db';
import { employees } from '../../../db/schema';
import { getUserById } from '../../../db/orm/users/getUserById';
import { formatUserLock } from '../../rbac/handlers/formatters';

export async function getUserHandler(c: Context) {
  try {
    const userId = c.req.param('id');
    
    if (!userId) {
      return c.json({
        success: false,
        error: 'User ID is required',
      }, 400);
    }

    console.log('Fetching user by ID:', userId);
    
    const [user, employee] = await Promise.all([
      getUserById(userId),
      db.query.employees.findFirst({
        where: eq(employees.userId, userId),
        columns: { id: true, employeeCode: true, biometricId: true },
      }),
    ]);
    
    if (!user) {
      return c.json({
        success: false,
        error: 'User not found',
      }, 404);
    }

    // Transform the data to match the schema
    const transformedUser = {
      id: user.id,
      name: user.name,
      email: user.email ?? null,
      phone: user.phone ?? null,
      emailVerified: user.emailVerified,
      role: user.role || ['user'],
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      image: user.image,
      ...formatUserLock(user),
      // The detail page shows Restore access instead of Revoke access when these are set.
      accessRevoked: Boolean(user.accessRevokedAt),
      accessRevokedAt: user.accessRevokedAt ? user.accessRevokedAt.toISOString() : null,
      accessRevokedReason: user.accessRevokedReason ?? null,
      employee: employee
        ? { id: employee.id, employeeCode: employee.employeeCode ?? null, biometricId: employee.biometricId ?? null }
        : null,
    };
    
    console.log('User fetched successfully:', user.id);
    
    return c.json({
      success: true as boolean,
      user: transformedUser,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch user',
    }, 500);
  }
}