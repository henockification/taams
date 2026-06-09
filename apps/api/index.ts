import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { apiReference } from '@scalar/hono-api-reference';
import dotenv from 'dotenv';

// Import centralized OpenAPI app
import { openApiApp } from './lib/openapi';

// Import feature modules
import systemApp from './routes/system';
import authApp from './routes/auth';
import usersApp from './routes/users/routes';
import profileApp from './routes/profile/routes';
import categoriesApp from './routes/categories/routes';
import itemsApp from './routes/items/routes';
import packagesApp from './routes/packages/routes';
import inventoryApp from './routes/inventory/routes';
import customersApp from './routes/customers/routes';
import ordersApp from './routes/orders/routes';
import checkoutApp from './routes/checkout/routes';
import stripeApp from './routes/stripe/routes';
import fileApp from './routes/file/routes';
import wishlistApp from './routes/wishlist/routes';
import contactApp from './routes/contact/routes';
import packageBoxesApp from './routes/packageBoxes/routes';

// Load environment variables
dotenv.config();

const app = new OpenAPIHono();

// Middleware - MUST be applied after auth routes
app.use('*', logger());
app.use('*', prettyJSON());
// Apply CORS middleware with conditional logic
app.use('/api/*', cors({
  origin: (origin, c) => {
    // Apply CORS restrictions for other routes
    const allowedOrigins = [
      'http://localhost:3008',
      'https://www.taams.com',
      process.env.FRONTEND_URL
    ].filter(Boolean); // Remove any undefined values
    
    const isAllowed = allowedOrigins.includes(origin || '');
    return isAllowed ? origin : null;
  },
  credentials: true,
}));

// Mount auth app FIRST - before middleware to avoid interference
app.route('/api/auth', authApp);

// Scalar API Documentation
app.get(
  '/api/docs',
  apiReference({
    theme: 'purple',
    spec: {
      url: '/api/openapi.json',
    },
  })
);

// OpenAPI configuration - mount directly on main app
app.doc('/api/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Taams API',
    version: 'v1',
    description: 'Taams API Documentation',
  },
  servers: [
    {
      url: process.env.VERCEL ? 'https://api.senawidget.com' : 'http://localhost:3009',
      description: process.env.VERCEL ? 'Production server' : 'Development server',
    },
  ],
});

// Mount feature modules
app.route('/api', systemApp);
app.route('/api', usersApp);
app.route('/api', profileApp);
app.route('/api', categoriesApp);
app.route('/api', itemsApp);
app.route('/api', packagesApp);
app.route('/api', inventoryApp);
app.route('/api', customersApp);
app.route('/api', ordersApp);
app.route('/api', checkoutApp);
app.route('/api', stripeApp);
app.route('/api', fileApp);
app.route('/api', wishlistApp);
app.route('/api', contactApp);
app.route('/api', packageBoxesApp);

// Mount centralized OpenAPI app for documentation
app.route('/api', openApiApp);


// 404 handler
app.notFound((c) => {
  return c.json({ message: 'Route not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
  const errorStack = err instanceof Error ? err.stack : undefined;
  
  console.error('Error details:', {
    message: errorMessage,
    stack: errorStack,
    path: c.req.path,
    method: c.req.method,
    url: c.req.url
  });
  return c.json({ 
    message: 'Something went wrong!',
    error: errorMessage,
    path: c.req.path
  }, 500);
});



export default app;



