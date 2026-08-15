'use client'

import { useState } from 'react'
import type { FaqEntry } from '@/lib/content'
import {
  HAIRLINE, INK, INK_MUTED, SURFACE,
} from '@/components/store/tokens'

/**
 * FAQ accordion.
 *
 * Built on <details>/<summary> rather than a div with a click handler: it is
 * keyboard operable, announced correctly by screen readers, expandable by the
 * browser's own find-in-page, and works before hydration. The only JavaScript
 * here is the filter box.
 */
export function FaqList({
  groups, searchLabel, emptyLabel,
}: {
  groups: { category: string; items: FaqEntry[] }[]
  searchLabel: string
  emptyLabel: string
}) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()

  const filtered = groups
    .map(g => ({
      ...g,
      items: q
        ? g.items.filter(i =>
            i.question.toLowerCase().includes(q) || i.answer.toLowerCase().includes(q))
        : g.items,
    }))
    .filter(g => g.items.length > 0)

  return (
    <div className="space-y-8">
      <input
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder={searchLabel}
        aria-label={searchLabel}
        className="h-12 w-full rounded-full border px-5 text-[14px] outline-none focus:ring-2"
        style={{ borderColor: HAIRLINE, background: SURFACE, color: INK }}
      />

      {filtered.length === 0 && (
        <p className="py-10 text-center text-[14px]" style={{ color: INK_MUTED }}>
          {emptyLabel}
        </p>
      )}

      {filtered.map(group => (
        <section key={group.category}>
          <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: INK_MUTED }}>
            {group.category}
          </h2>
          <div className="space-y-2">
            {group.items.map(item => (
              <details
                key={item.id}
                // Open while filtering: a search that hides the answer it just
                // matched makes the reader click every result to check it.
                open={!!q}
                className="group rounded-2xl px-5 py-4"
                style={{ background: SURFACE, border: `1px solid ${HAIRLINE}` }}
              >
                <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[15px] font-semibold">
                  {item.question}
                  <span
                    aria-hidden
                    className="mt-0.5 shrink-0 transition-transform group-open:rotate-45"
                    style={{ color: INK_MUTED }}
                  >
                    +
                  </span>
                </summary>
                <div className="mt-3 space-y-3 text-[14.5px] leading-relaxed" style={{ color: INK_MUTED }}>
                  {item.answer.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
