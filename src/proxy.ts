import { NextResponse, type NextRequest } from 'next/server'

/**
 * Cheap gate only. This checks for the *presence* of a session cookie so that
 * signed-out visitors are bounced to /login without paying for a database
 * round-trip on every request. It deliberately does NOT validate the token.
 *
 * Real authorization happens in src/app/(admin)/layout.tsx, which calls auth()
 * and redirects, and in requirePermission() for each server action. A forged or
 * expired cookie gets past this proxy and is then rejected there.
 *
 * Exporting `auth` from '@/auth' directly as middleware would validate here, but
 * it drags Prisma/pg into the request path — unavailable on the edge runtime
 * (`node:util/types` missing), and a per-request DB query when pinned to Node.
 */
const PROTECTED_PREFIXES = [
  '/dashboard', '/products', '/categories', '/customers',
  '/media', '/sync', '/storefront', '/users', '/roles', '/settings',
]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (!PROTECTED_PREFIXES.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next()
  }

  const hasSession =
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token')

  if (!hasSession) {
    const url = new URL('/login', req.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
