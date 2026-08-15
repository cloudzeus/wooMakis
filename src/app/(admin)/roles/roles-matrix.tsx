'use client'

import { Fragment, useState, useTransition } from 'react'
import { RowActions } from '@/components/admin/row-actions'
import { createRole, deleteRole, setRolePermission } from './actions'

export type RoleCol = {
  id: string
  name: string
  description: string | null
  system: boolean
  userCount: number
  granted: string[]
}

export type PermRow = { key: string; description: string; group: string }

/**
 * The permission matrix: permissions down, roles across.
 *
 * A matrix rather than a per-role checklist because the question people
 * actually have is comparative — "who can push to WooCommerce?" — and that is
 * one row here versus opening every role in turn.
 */
export function RolesMatrix({
  permissions, roles, canManage,
}: {
  permissions: PermRow[]
  roles: RoleCol[]
  canManage: boolean
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name: '', description: '' })

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const r = await fn()
      setMsg(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error! })
    })
  }

  const groups = [...new Set(permissions.map(p => p.group))]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {roles.length} ρόλοι · {permissions.length} δικαιώματα
        </p>
        {canManage && (
          <button
            onClick={() => setAdding(a => !a)}
            className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            {adding ? 'Άκυρο' : '+ Νέος ρόλος'}
          </button>
        )}
      </div>

      {msg && (
        <p
          role="status"
          className={`rounded-2xl px-4 py-2.5 text-sm ${
            msg.ok ? 'bg-[var(--success)]/12 text-[var(--success)]' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {msg.ok ? '✓ ' : '⚠ '}{msg.text}
        </p>
      )}

      {adding && (
        <form
          onSubmit={e => {
            e.preventDefault()
            run(() => createRole(draft.name, draft.description))
            setDraft({ name: '', description: '' })
            setAdding(false)
          }}
          className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-[1fr_2fr_auto]"
        >
          <label className="block space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Όνομα</span>
            <input
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              placeholder="WAREHOUSE"
              className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm"
            />
            <span className="block text-[11px] text-muted-foreground">
              Κεφαλαία και κάτω παύλες. Ο νέος ρόλος ξεκινά χωρίς δικαιώματα.
            </span>
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Περιγραφή</span>
            <input
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="h-10 cursor-pointer self-start rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:mt-[22px]"
          >
            Δημιουργία
          </button>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border">
              <th className="sticky left-0 bg-card px-4 py-3 text-left text-xs uppercase tracking-wide text-muted-foreground">
                Δικαίωμα
              </th>
              {roles.map(r => (
                <th key={r.id} className="px-3 py-3 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold">{r.name}</span>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {r.userCount} {r.userCount === 1 ? 'χρήστης' : 'χρήστες'}
                    </span>
                    {canManage && (
                      <RowActions
                        label={`Ενέργειες για τον ρόλο ${r.name}`}
                        actions={[
                          { label: 'Χρήστες με αυτόν τον ρόλο', href: '/users' },
                          {
                            label: 'Διαγραφή ρόλου',
                            danger: true,
                            disabled: r.system || r.userCount > 0,
                            hint: r.system
                              ? 'Ρόλος συστήματος'
                              : r.userCount > 0 ? 'Έχει χρήστες' : undefined,
                            onSelect: () => run(() => deleteRole(r.id)),
                          },
                        ]}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map(group => (
              // Fragment shorthand cannot carry a key, and each group emits a
              // heading row plus its permission rows as siblings.
              <Fragment key={group}>
                <tr className="border-b border-border bg-muted/40">
                  <td
                    colSpan={roles.length + 1}
                    className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                  >
                    {group}
                  </td>
                </tr>
                {permissions.filter(p => p.group === group).map(p => (
                  <tr key={p.key} className="border-b border-border/60 last:border-0">
                    <td className="sticky left-0 bg-card px-4 py-2">
                      <div>{p.description}</div>
                      <code className="text-[11px] text-muted-foreground">{p.key}</code>
                    </td>
                    {roles.map(r => {
                      const on = r.granted.includes(p.key)
                      const locked = !canManage || r.name === 'SUPER_ADMIN'
                      return (
                        <td key={r.id} className="px-3 py-2 text-center">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={locked || pending}
                            onChange={e => run(() => setRolePermission(r.id, p.key, e.target.checked))}
                            aria-label={`${p.description} για ${r.name}`}
                            title={
                              r.name === 'SUPER_ADMIN'
                                ? 'Ο SUPER_ADMIN έχει πάντα όλα τα δικαιώματα'
                                : `${p.key} για ${r.name}`
                            }
                            className={`size-4 accent-[var(--navy)] ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Οι αλλαγές ισχύουν για τους συνδεδεμένους χρήστες μέσα σε 60 δευτερόλεπτα —
        τόσο κρατά η προσωρινή αποθήκευση δικαιωμάτων στο session.
      </p>
    </div>
  )
}
