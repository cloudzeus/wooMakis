'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from '@/lib/nav'

export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Κύρια πλοήγηση" className="flex w-56 shrink-0 flex-col gap-1 p-3">
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link key={item.href} href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`rounded-full px-4 py-2 text-sm transition-colors ${
              active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
            }`}>
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
