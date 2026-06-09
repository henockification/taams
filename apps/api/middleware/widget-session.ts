import type { Context, Next } from 'hono';
import * as jose from 'jose';

export async function requireWidgetSession(c: Context, next: Next) {
  const cookie = c.req.header('cookie') || '';
  const m = cookie.match(/(?:^|;\s*)w_session=([^;]+)/);
  if (!m) return c.json({ error: 'no session' }, 401);

  const token = m[1];
  try {
    const key = new TextEncoder().encode(process.env.APP_WIDGET_JWT_SECRET!);
    const { payload } = await jose.jwtVerify(token, key, {
      issuer: process.env.WIDGET_ISS || 'Sena Widget',
      audience: process.env.WIDGET_AUD || 'Widget',
    });

    const csrfHeader = c.req.header('x-widget-csrf');
    if (!csrfHeader || csrfHeader !== payload.csrf) {
      return c.json({ error: 'bad csrf' }, 403);
    }

    c.set('wSession', {
      tenantId: payload.ten as string,
      installationId: payload.inst as string,
    });

    return next();
  } catch (e) {
    return c.json({ error: 'invalid session' }, 401);
  }
}