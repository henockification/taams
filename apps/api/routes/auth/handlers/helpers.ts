import { Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { cookieShouldBeSecure } from '../../../lib/runtime-env';

export const SESSION_COOKIE_NAME = 'taams_session';

export function setSessionCookie(c: Context, token: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: cookieShouldBeSecure(),
    sameSite: 'Lax',
    path: '/',
    expires: expiresAt,
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

export function getSessionCookie(c: Context) {
  return getCookie(c, SESSION_COOKIE_NAME);
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    path: "/",
    domain: process.env.COOKIE_DOMAIN || undefined,
  });
}

export function formatAuthUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    emailVerified: user.emailVerified,
    image: user.image,
    role: user.role ?? ['user'],
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function formatAuthSession(session: any) {
  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    ipAddress: session.ipAddress,
    userAgent: session.userAgent,
  };
}
