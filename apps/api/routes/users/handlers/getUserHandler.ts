import { Context } from 'hono';
import { getUserById } from '../../../db/orm/users/getUserById';

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
    
    const user = await getUserById(userId);
    
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
      email: user.email,
      emailVerified: user.emailVerified,
      role: user.role || ['user'], // Default to ['user'] if null
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      image: user.image,
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
      details: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
}