import { Context } from 'hono';

export function coreErrorResponse(c: Context, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const lowerMessage = message.toLowerCase();
  const status = lowerMessage.includes('not found')
    ? 404
    : lowerMessage.includes('duplicate') || lowerMessage.includes('unique')
      ? 409
      : lowerMessage.includes('cannot')
        ? 400
        : 500;

  return c.json({
    success: false,
    error: fallback,
    details: message,
  }, status);
}

export function validationErrorResponse(c: Context, details: string) {
  return c.json({
    success: false,
    error: 'Invalid request payload',
    details,
  }, 400);
}
