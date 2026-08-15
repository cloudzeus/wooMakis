import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyCredentials, type AuthUserPayload } from '@/auth.config'
import { prisma } from '@/lib/prisma'

const PERMS_REFRESH_MS = 60_000

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        if (typeof creds?.email !== 'string' || typeof creds?.password !== 'string') return null
        return verifyCredentials(creds.email, creds.password)
      },
    }),
  ],
  callbacks: {
    authorized({ auth }) {
      return !!auth?.user
    },
    async jwt({ token, user }) {
      if (user) {
        const u = user as AuthUserPayload
        token.role = u.role
        token.permissions = u.permissions
        token.trdrId = u.trdrId
        token.permsAt = Date.now()
        return token
      }

      if (!token.permsAt || Date.now() - token.permsAt > PERMS_REFRESH_MS) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub! },
          include: { role: { include: { permissions: { include: { permission: true } } } } },
        })
        // Deleted or deactivated mid-session — invalidate the cookie.
        if (!dbUser || !dbUser.active) return null
        token.role = dbUser.role.name
        token.permissions = dbUser.role.permissions.map(rp => rp.permission.key)
        token.trdrId = dbUser.trdrId ?? null
        token.permsAt = Date.now()
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub!
      session.user.role = token.role ?? ''
      session.user.permissions = token.permissions ?? []
      session.user.trdrId = token.trdrId ?? null
      return session
    },
  },
})
