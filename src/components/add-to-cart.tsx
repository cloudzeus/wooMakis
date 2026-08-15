'use client'

import { useState, useTransition } from 'react'
import { addToCart } from '@/app/(store)/kalathi/actions'

export function AddToCart({ productId, disabled }: { productId: string; disabled?: boolean }) {
  const [pending, start] = useTransition()
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (disabled) {
    return (
      <span className="mt-2 inline-block text-xs text-[#0f2429]/40">Εξαντλημένο</span>
    )
  }

  return (
    <div className="mt-2">
      <button
        onClick={() =>
          start(async () => {
            const r = await addToCart(productId, 1)
            if (r.ok) {
              setDone(true)
              setError(null)
              setTimeout(() => setDone(false), 2000)
            } else {
              setError(r.error)
            }
          })
        }
        disabled={pending}
        className="w-full cursor-pointer rounded-full border border-[#00cfc9] px-4 py-2 text-xs font-medium text-[#00cfc9] transition-colors hover:bg-[#00cfc9] hover:text-white disabled:opacity-50"
      >
        {pending ? 'Προσθήκη…' : done ? '✓ Προστέθηκε' : 'Προσθήκη στο καλάθι'}
      </button>
      {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
