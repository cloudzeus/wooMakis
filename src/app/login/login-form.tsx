'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'

export function LoginForm() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError(null)
    const data = new FormData(e.currentTarget)
    const res = await signIn('credentials', {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
      redirect: false,
    })
    setPending(false)
    if (res?.error) {
      setError('Λάθος email ή κωδικός. Έλεγξε τα στοιχεία και δοκίμασε ξανά.')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-xs font-medium uppercase tracking-wide">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email"
          className="h-10 w-full rounded-full border border-border bg-card px-4 outline-none focus:ring-2 focus:ring-ring" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-xs font-medium uppercase tracking-wide">Κωδικός</label>
        <input id="password" name="password" type="password" required autoComplete="current-password"
          className="h-10 w-full rounded-full border border-border bg-card px-4 outline-none focus:ring-2 focus:ring-ring" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={pending}
        className="h-10 w-full cursor-pointer rounded-full bg-primary px-4 font-medium text-primary-foreground disabled:opacity-60">
        {pending ? 'Σύνδεση…' : 'Σύνδεση'}
      </button>
    </form>
  )
}
