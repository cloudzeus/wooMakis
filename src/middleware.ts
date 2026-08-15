export { auth as middleware } from '@/auth'

export const config = {
  // `@/auth` reaches Prisma/pg in its jwt callback, which cannot run on the
  // edge runtime (`node:util/types` is unavailable there). Next 16 supports
  // the Node.js runtime for middleware — required, not an optimisation.
  runtime: 'nodejs',
  matcher: ['/dashboard/:path*', '/products/:path*', '/categories/:path*',
            '/customers/:path*', '/media/:path*', '/sync/:path*',
            '/users/:path*', '/roles/:path*', '/settings/:path*'],
}
