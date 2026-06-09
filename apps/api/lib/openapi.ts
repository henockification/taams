import { OpenAPIHono } from '@hono/zod-openapi';

// Create a centralized OpenAPI Hono instance
export const openApiApp = new OpenAPIHono();

// Export the app for use in route registration
export default openApiApp;
