import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n';

const intlMiddleware = createMiddleware(routing);
const hiddenCoreRoutes = ['/organization-structure', '/positions'];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const localePattern = new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`);
  const pathWithoutLocale = pathname.replace(localePattern, '') || '/';
  const isHiddenCoreRoute = hiddenCoreRoutes.some((route) => (
    pathWithoutLocale === route || pathWithoutLocale.startsWith(`${route}/`)
  ));

  if (isHiddenCoreRoute) {
    const redirectUrl = request.nextUrl.clone();
    const localeMatch = pathname.match(localePattern);
    redirectUrl.pathname = localeMatch ? `/${localeMatch[1]}/dashboard` : '/dashboard';
    return NextResponse.redirect(redirectUrl);
  }

  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for
  // - API routes
  // - _next (Next.js internals)
  // - _static (inside /public)
  // - all files in the public folder
  matcher: ['/((?!api|_next|_static|.*\\..*).*)']
};
