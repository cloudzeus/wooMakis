import { redirect } from 'next/navigation'
import { auth } from '@/auth'
import { LoginForm } from './login-form'

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-lg">
        <h1 className="mb-6 font-display text-xl font-semibold">Σύνδεση</h1>
        <LoginForm />
      </div>
    </main>
  )
}
