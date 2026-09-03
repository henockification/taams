const UNHELPFUL_ERROR_VALUES = new Set([
  '[object Object]',
  'object Object',
  'undefined',
  'null',
  '',
]);

export function getReadableSyncError(message: string | null | undefined, fallback: string) {
  const normalized = message?.trim() ?? '';

  if (UNHELPFUL_ERROR_VALUES.has(normalized)) {
    return fallback;
  }

  return normalized;
}
