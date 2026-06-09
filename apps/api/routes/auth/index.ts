import { OpenAPIHono } from '@hono/zod-openapi';
import { auth } from '../../lib/auth';

const authApp = new OpenAPIHono();

export default authApp;

// Better Auth routes - IMPORTANT: Must be placed after all other routes
authApp.all('*', async (c) => {
  console.log('Better Auth catch-all handler called for:', c.req.path);
  const request = c.req.raw;
  try {
    const response = await auth.handler(request);
    console.log('Better Auth response status:', response.status);
    return response;
  } catch (error) {
    console.error('Better Auth handler error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      path: c.req.path,
      method: c.req.method
    });
    return c.json({ 
      error: 'Better Auth handler failed',
      message: errorMessage,
      path: c.req.path
    }, 500);
  }
});
