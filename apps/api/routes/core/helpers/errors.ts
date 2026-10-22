import { Context } from 'hono';

// Leave date/balance validation messages the requester needs to see to fix their request.
const LEAVE_VALIDATION_PHRASES = [
  'is a scheduled off day',
  'is a holiday (',
  'is a half-day holiday (',
  'insufficient annual leave balance',
  'is already part of another active request',
  'is already covered by another active leave request',
  'has already been requested',
  'conflicts with another authorized leave request',
  'does not include any scheduled working days',
];

// Postgres unique violations reach us as "Failed query: ..." with the reason only in `cause`.
function uniqueViolationMessage(error: unknown) {
  const cause = (error as { cause?: { code?: string; detail?: string } } | null)?.cause;
  if (cause?.code !== '23505') return null;
  const match = cause.detail?.match(/^Key \((.+?)\)=\((.*)\) already exists/);
  if (!match) return 'This record conflicts with an existing one (duplicate value)';
  const field = match[1].replace(/_/g, ' ');
  return `The ${field} "${match[2]}" is already used by another record (duplicate value)`;
}

export function coreErrorResponse(c: Context, error: unknown, fallback: string) {
  const message = uniqueViolationMessage(error) ?? (error instanceof Error ? error.message : 'Unknown error');
  const lowerMessage = message.toLowerCase();
  const status = LEAVE_VALIDATION_PHRASES.some((phrase) => lowerMessage.includes(phrase))
    ? 400
    : lowerMessage.includes('not found')
      ? 404
      : lowerMessage.includes('authentication required')
        ? 401
        : lowerMessage.includes('duplicate') || lowerMessage.includes('unique') || lowerMessage.includes('already has an active')
          || lowerMessage.includes('already has a user account') || lowerMessage.includes('already linked to another')
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
