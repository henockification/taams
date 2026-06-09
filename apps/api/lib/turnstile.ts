interface TurnstileResponse {
    success: boolean;
    'error-codes'?: string[];
  }

  function isTurnstileResponse(value: unknown): value is TurnstileResponse {
    return (
      typeof value === 'object' &&
      value !== null &&
      'success' in value &&
      typeof (value as { success: unknown }).success === 'boolean'
    );
  }
  
  export async function verifyTurnstileToken(token: string) {
    const secretKey = process.env.TURNSTILE_SECRET_KEY;
  
    const response = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secretKey,
          response: token,
        }),
      }
    );
  
    const data: unknown = await response.json();
    if (!isTurnstileResponse(data)) {
      return false;
    }
    return data.success;
  }