'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavGroup } from '@/lib/nav'

/**
 * Grouped sidebar. Groups arrive pre-filtered by permission, so a group whose
 * items are all hidden never reaches here and its heading never renders — an
 * empty "Διαχείριση" heading would tell a VIEWER that something exists which
 * they cannot reach.
 */
export function Sidebar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname()

  return (
    <nav aria-label="Κύρια πλοήγηση" className="w-56 shrink-0 space-y-5 p-3">
      {groups.map((group, i) => (
        <div key={group.title ?? `top-${i}`} className="space-y-1">
          {group.title && (
            <h2 className="px-4 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {group.title}
            </h2>
          )}

          {group.items.map(item => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-full px-4 py-2 text-sm transition-colors ${
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      ))}
    </nav>
  )
}
