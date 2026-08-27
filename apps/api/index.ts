import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { apiReference } from '@scalar/hono-api-reference';
import dotenv from 'dotenv';

// Import centralized OpenAPI app
import { openApiApp } from './lib/openapi';

// Import feature modules
import authApp from './routes/auth';
import usersApp from './routes/users/routes';
import rbacApp from './routes/rbac/routes';
import coreApp from './routes/core/routes';
import zktecoApp from './routes/zkteco/routes';
import reportsApp from './routes/reports/routes';

// Load environment variables
dotenv.config();

const app = new OpenAPIHono();

function splitOrigins(value?: string) {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOrigin(origin: string) {
  try {
    return new URL(origin).origin;
  } catch {
    return origin.replace(/\/+$/, '');
  }
}

function expandAllowedOrigin(origin: string) {
  const normalizedOrigin = normalizeOrigin(origin);
  const origins = [normalizedOrigin];

  try {
    const parsedOrigin = new URL(normalizedOrigin);
    const isWebOrigin = parsedOrigin.protocol === 'http:' || parsedOrigin.protocol === 'https:';
    const isLocalOrigin = parsedOrigin.hostname === 'localhost' || parsedOrigin.hostname === '127.0.0.1';

    if (isWebOrigin && !isLocalOrigin && parsedOrigin.protocol === 'http:') {
      origins.push(`https://${parsedOrigin.host}`);
    }
  } catch {
    // Keep the normalized value for non-URL origin entries.
  }

  return origins;
}

const allowedCorsOrigins = new Set(
  [
    'http://localhost:3011',
    'https://www.taams.com',
    ...splitOrigins(process.env.FRONT_END_URL),
    ...splitOrigins(process.env.FRONTEND_URL),
    ...splitOrigins(process.env.APP_BASE_URL),
    ...splitOrigins(process.env.CORS_ALLOWED_ORIGINS),
  ].flatMap(expandAllowedOrigin),
);

// Apply CORS before all routes so preflight works even if an adapter rewrites
// the internal path seen by Hono.
app.use('*', cors({
  // origin: (origin) => {
  //   const requestOrigin = origin ? normalizeOrigin(origin) : '';
  //   return allowedCorsOrigins.has(requestOrigin) ? origin : null;
  // },
  origin: 'http://taams-test.mofed.gov.et',
  credentials: true,
}));

app.use('*', logger());
app.use('*', prettyJSON());

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
    title: 'Tams API',
    version: 'v1',
    description: 'Tams API Documentation',
  },
  servers: [
    {
      url: process.env.VERCEL ? 'https://api.senawidget.com' : 'http://localhost:3012',
      description: process.env.VERCEL ? 'Production server' : 'Development server',
    },
  ],
});

// Mount feature modules
app.route('/api', usersApp);
app.route('/api', rbacApp);
app.route('/api', coreApp);
app.route('/api', reportsApp);
app.route('/api/zkteco', zktecoApp);
app.route('/iclock', zktecoApp);

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
