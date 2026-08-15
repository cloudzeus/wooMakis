'use client'

import { signOut } from 'next-auth/react'

export function SignOutItem() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/login' })}
      className="cursor-pointer rounded-full px-4 py-2 text-sm hover:bg-accent">
      Αποσύνδεση
    </button>
  )
}
