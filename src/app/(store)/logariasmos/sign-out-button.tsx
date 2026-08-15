'use client'

import { useTransition } from 'react'
import { signOutCustomer } from '@/app/(store)/sindesi/actions'
import {
  HAIRLINE, INK, SURFACE,
} from '@/components/store/tokens'

export function SignOutButton({ label }: { label: string }) {
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => signOutCustomer())}
      className="h-11 cursor-pointer rounded-full border px-5 text-[13.5px] font-semibold disabled:opacity-60"
      style={{ borderColor: HAIRLINE, color: INK, background: SURFACE }}
    >
      {label}
    </button>
  )
}
