import { Context } from 'hono';
import { getAllUsersPaginated } from '../../../db/orm/users/getAllUsers';

export async function getUsersHandler(c: Context) {
  try {
    console.log('Fetching users with ORM...');
    
    // Get pagination parameters from query string
    const page = parseInt(c.req.query('page') || '1');
    const pageSize = parseInt(c.req.query('pageSize') || '20');
    const search = c.req.query('search') || '';
    
    const result = await getAllUsersPaginated({ page, pageSize, search });

    // Transform the data to match the schema
    const transformedUsers = result.users.map(u => ({
      id: u.id,
      name: u.name,
      email: u.email,
      emailVerified: u.emailVerified,
      role: u.role || ['user'], // Default to ['user'] if null
      createdAt: u.createdAt.toISOString()
    }));
    
    console.log('Users fetched successfully:', result.users.length);
    
    return c.json({
      success: true as boolean,
      users: transformedUsers,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch users',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}
