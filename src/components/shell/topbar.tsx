import Image from 'next/image'
import { SignOutItem } from './sign-out-item'

export function Topbar({ name, role }: { name: string; role: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-5">
      <Image src="/mylens-logo-adaptive.svg" alt="wooMakis" width={49} height={28} priority />
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">{name} · {role}</span>
        <SignOutItem />
      </div>
    </header>
  )
}
