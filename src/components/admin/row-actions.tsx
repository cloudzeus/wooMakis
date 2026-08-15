'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

/** Wide enough that "Άνοιγμα στο WooCommerce" fits on one line. */
const MENU_WIDTH = 244

export type RowAction = {
  label: string
  /** Navigates. Mutually exclusive with onSelect. */
  href?: string
  /** Runs something. Mutually exclusive with href. */
  onSelect?: () => void
  /** Opens in a new tab. Only meaningful with href. */
  external?: boolean
  disabled?: boolean
  /** Why it is disabled, or what the action does. Shown as a title. */
  hint?: string
  /** Renders in the destructive colour and sits below a separator. */
  danger?: boolean
}

/**
 * The actions menu at the right-hand end of a table row.
 *
 * One implementation for every list screen, because the alternative — each
 * table growing its own buttons — is how a row ends up with four inconsistent
 * affordances and no room for the data.
 *
 * Notes on the mechanics, all of which were needed to make it usable:
 *
 *  - The menu is `position: fixed` and placed from the trigger's measured
 *    rect. Inside a table that scrolls horizontally, an absolutely positioned
 *    menu is clipped by the `overflow-x-auto` wrapper and the last rows'
 *    menus simply cannot be seen.
 *  - It flips above the trigger when there is not enough room below, so the
 *    bottom row of a long table is not a dead end.
 *  - Escape closes and returns focus to the trigger; arrow keys move through
 *    the items. A menu you can open but not leave with the keyboard is worse
 *    than no menu.
 */
export function RowActions({ actions, label = 'Ενέργειες' }: {
  actions: RowAction[]
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const usable = actions.filter(a => !a.disabled)

  useEffect(() => {
    if (!open) return

    function place() {
      const t = triggerRef.current?.getBoundingClientRect()
      if (!t) return
      const height = Math.min(actions.length * 36 + 16, 320)
      const below = window.innerHeight - t.bottom
      setPos({
        top: below < height + 8 ? t.top - height - 4 : t.bottom + 4,
        left: Math.max(8, Math.min(t.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      })
    }
    place()

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); triggerRef.current?.focus() }
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    // Capture phase: a scroll inside the table wrapper does not bubble to
    // window, and without this the menu detaches from its row.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open, actions.length])

  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>('[data-item]')?.focus()
  }, [open, pos])

  function move(from: HTMLElement, delta: number) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[data-item]') ?? [])
    const i = items.indexOf(from)
    items[(i + delta + items.length) % items.length]?.focus()
  }

  const itemClass = (a: RowAction) =>
    `flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-[13px] outline-none ` +
    (a.disabled
      ? 'cursor-not-allowed text-muted-foreground/60'
      : a.danger
        ? 'cursor-pointer text-destructive hover:bg-destructive/10 focus:bg-destructive/10'
        : 'cursor-pointer hover:bg-accent focus:bg-accent')

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'ArrowDown' || e.key === 'Enter') { e.preventDefault(); setOpen(true) }
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        className="grid size-8 cursor-pointer place-items-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus:ring-2 focus:ring-ring"
      >
        <span aria-hidden className="text-base leading-none">⋯</span>
      </button>

      {open && pos && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: MENU_WIDTH }}
          className="z-50 max-h-80 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-lg"
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); move(e.target as HTMLElement, 1) }
            if (e.key === 'ArrowUp') { e.preventDefault(); move(e.target as HTMLElement, -1) }
          }}
        >
          {actions.map((a, i) => {
            const separated = a.danger && !actions[i - 1]?.danger && i > 0
            const key = `${a.label}-${i}`

            if (a.disabled) {
              return (
                <div key={key} className={itemClass(a)} role="menuitem" aria-disabled title={a.hint}>
                  {a.label}
                </div>
              )
            }

            const body = (
              <>
                {a.label}
                {a.external && <span aria-hidden className="ml-auto text-muted-foreground">↗</span>}
              </>
            )

            return (
              <div key={key} className={separated ? 'mt-1.5 border-t border-border pt-1.5' : undefined}>
                {a.href ? (
                  <Link
                    data-item
                    role="menuitem"
                    href={a.href}
                    title={a.hint}
                    target={a.external ? '_blank' : undefined}
                    rel={a.external ? 'noreferrer' : undefined}
                    onClick={() => setOpen(false)}
                    className={itemClass(a)}
                  >
                    {body}
                  </Link>
                ) : (
                  <button
                    data-item
                    role="menuitem"
                    type="button"
                    title={a.hint}
                    onClick={() => { setOpen(false); a.onSelect?.() }}
                    className={itemClass(a)}
                  >
                    {body}
                  </button>
                )}
              </div>
            )
          })}

          {usable.length === 0 && (
            <p className="px-3 py-2 text-[13px] text-muted-foreground">Καμία διαθέσιμη ενέργεια.</p>
          )}
        </div>
      )}
    </>
  )
}
