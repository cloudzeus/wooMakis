import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      permissions: string[]
      trdrId: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    permissions?: string[]
    trdrId?: string | null
    permsAt?: number
  }
}
