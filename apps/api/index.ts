import { OpenAPIHono } from '@hono/zod-openapi';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { apiReference } from '@scalar/hono-api-reference';
import dotenv from 'dotenv';
import { requireAuthUnlessPublic } from './middleware/auth';
import { authRateLimiter } from './middleware/auth-rate-limit';
import { requireCsrfOrigin } from './middleware/csrf';
import { applyBodyLimit } from './middleware/request-limits';
import { securityHeaders } from './middleware/security-headers';
import { allowedCorsOrigins, normalizeOrigin } from './lib/cors';

import { openApiApp } from './lib/openapi';

import authApp from './routes/auth';
import usersApp from './routes/users/routes';
import profileApp from './routes/profile/routes';
import rbacApp from './routes/rbac/routes';
import coreApp from './routes/core/routes';
import zktecoApp from './routes/zkteco/routes';
import reportsApp from './routes/reports/routes';

dotenv.config();

const app = new OpenAPIHono();

app.use('*', cors({
  origin: (origin) => {
    const requestOrigin = origin ? normalizeOrigin(origin) : '';
    return allowedCorsOrigins.has(requestOrigin) ? origin : null;
  },
  credentials: true,
}));

app.use('*', securityHeaders);
app.use('*', applyBodyLimit);
app.use('*', logger());
app.use('*', prettyJSON());
app.use('*', async (c, next) => {
  const requestId = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', requestId);
  c.header('x-request-id', requestId);
  await next();
});
app.use('*', requireCsrfOrigin);
app.use('/api/auth/*', authRateLimiter);

app.route('/api/auth', authApp);

app.use('/api/*', requireAuthUnlessPublic);

app.get(
  '/api/docs',
  apiReference({
    theme: 'purple',
    spec: {
      url: '/api/openapi.json',
    },
  })
);

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

app.route('/api', usersApp);
app.route('/api', profileApp);
app.route('/api', rbacApp);
app.route('/api', coreApp);
app.route('/api', reportsApp);
app.route('/api/zkteco', zktecoApp);
app.route('/iclock', zktecoApp);
app.route('/api', openApiApp);

app.notFound((c) => {
  return c.json({ message: 'Route not found' }, 404);
});

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
  console.error('Error details:', {
    message: errorMessage,
    stack: err instanceof Error ? err.stack : undefined,
    path: c.req.path,
    method: c.req.method,
    url: c.req.url,
  });
  return c.json({
    message: 'Something went wrong!',
  }, 500);
});

export default app;
