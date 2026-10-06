import { Context } from 'hono';

// Leave date/balance validation messages the requester needs to see to fix their request.
const LEAVE_VALIDATION_PHRASES = [
  'is a scheduled off day',
  'is a holiday (',
  'is a half-day holiday (',
  'insufficient annual leave balance',
  'is already part of another active request',
  'conflicts with another authorized leave request',
  'does not include any scheduled working days',
];

export function coreErrorResponse(c: Context, error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  const lowerMessage = message.toLowerCase();
  const status = LEAVE_VALIDATION_PHRASES.some((phrase) => lowerMessage.includes(phrase))
    ? 400
    : lowerMessage.includes('not found')
      ? 404
      : lowerMessage.includes('authentication required')
        ? 401
        : lowerMessage.includes('duplicate') || lowerMessage.includes('unique')
          ? 409
          : lowerMessage.includes('only ') || lowerMessage.includes('not authorized') || lowerMessage.includes('permission')
            ? 403
            : lowerMessage.includes('cannot') || lowerMessage.includes('must ') || lowerMessage.includes('invalid') || lowerMessage.includes('required') || lowerMessage.includes('already used')
              ? 400
              : 500;

  console.error(fallback, {
    message,
    path: c.req.path,
    method: c.req.method,
  });

  return c.json({
    success: false,
    error: status >= 500 ? fallback : message,
  }, status);
}

export function validationErrorResponse(c: Context, details: string) {
  return c.json({
    success: false,
    error: 'Invalid request payload',
    details,
  }, 400);
}
