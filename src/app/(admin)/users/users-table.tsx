'use client'

import { useState, useTransition } from 'react'
import { RowActions } from '@/components/admin/row-actions'
import { createUser, resetUserPassword, setUserActive, setUserRole } from './actions'

export type UserRow = {
  id: string
  email: string
  name: string
  active: boolean
  roleId: string
  roleName: string
  permissionCount: number
  createdAt: string
}

export type RoleRow = {
  id: string
  name: string
  permissionCount: number
  userCount: number
  system: boolean
}

export function UsersTable({ rows, roles }: { rows: UserRow[]; roles: RoleRow[] }) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [adding, setAdding] = useState(false)
  const [resetting, setResetting] = useState<string | null>(null)

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const r = await fn()
      setMsg(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error! })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {roles.map(r => (
            <span
              key={r.id}
              className="rounded-full border border-border px-3 py-1.5 text-xs"
              title={`${r.permissionCount} δικαιώματα`}
            >
              {r.name}
              <span className="ml-2 tabular-nums text-muted-foreground">{r.userCount}</span>
            </span>
          ))}
        </div>
        <button
          onClick={() => setAdding(a => !a)}
          className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
        >
          {adding ? 'Άκυρο' : '+ Νέος χρήστης'}
        </button>
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

      {adding && <NewUserForm roles={roles} pending={pending} onSubmit={(d) => run(() => createUser(d))} />}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3">Όνομα</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Ρόλος</th>
              <th className="px-4 py-3">Κατάσταση</th>
              <th className="px-4 py-3 text-right">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(u => (
              <tr key={u.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">
                  <select
                    value={u.roleId}
                    disabled={pending}
                    onChange={e => run(() => setUserRole(u.id, e.target.value))}
                    aria-label={`Ρόλος για ${u.name}`}
                    className="h-9 cursor-pointer rounded-full border border-border bg-card px-3 text-xs"
                  >
                    {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {u.permissionCount} δικ.
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      u.active
                        ? 'bg-[var(--success)]/12 text-[var(--success)]'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <span aria-hidden>{u.active ? '✓' : '○'}</span>
                    {u.active ? 'Ενεργός' : 'Ανενεργός'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    <RowActions
                      label={`Ενέργειες για ${u.name}`}
                      actions={[
                        {
                          label: 'Αλλαγή κωδικού',
                          onSelect: () => setResetting(resetting === u.id ? null : u.id),
                        },
                        {
                          label: u.active ? 'Απενεργοποίηση' : 'Ενεργοποίηση',
                          onSelect: () => run(() => setUserActive(u.id, !u.active)),
                          danger: u.active,
                          hint: u.active
                            ? 'Ο χρήστης δεν θα μπορεί να συνδεθεί'
                            : undefined,
                        },
                        { label: 'Ρόλοι και δικαιώματα', href: '/roles' },
                        {
                          label: 'Αποστολή email',
                          href: `mailto:${u.email}`,
                        },
                      ]}
                    />
                  </div>

                  {resetting === u.id && (
                    <ResetPassword
                      pending={pending}
                      onCancel={() => setResetting(null)}
                      onSubmit={pw => { run(() => resetUserPassword(u.id, pw)); setResetting(null) }}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NewUserForm({
  roles, pending, onSubmit,
}: {
  roles: RoleRow[]
  pending: boolean
  onSubmit: (d: { name: string; email: string; password: string; roleId: string }) => void
}) {
  const [d, setD] = useState({ name: '', email: '', password: '', roleId: roles[0]?.id ?? '' })
  return (
    <form
      onSubmit={e => { e.preventDefault(); onSubmit(d) }}
      className="grid gap-3 rounded-2xl border border-border bg-card p-5 sm:grid-cols-4"
    >
      <Field label="Όνομα" value={d.name} onChange={v => setD({ ...d, name: v })} />
      <Field label="Email" type="email" value={d.email} onChange={v => setD({ ...d, email: v })} />
      <Field
        label="Κωδικός" type="password" value={d.password}
        onChange={v => setD({ ...d, password: v })}
        help="Τουλάχιστον 10 χαρακτήρες, γράμματα και αριθμοί."
      />
      <label className="block space-y-1">
        <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Ρόλος</span>
        <select
          value={d.roleId}
          onChange={e => setD({ ...d, roleId: e.target.value })}
          className="h-10 w-full cursor-pointer rounded-full border border-border bg-card px-4 text-sm"
        >
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:col-span-4 sm:w-fit"
      >
        Δημιουργία
      </button>
    </form>
  )
}

function ResetPassword({
  pending, onSubmit, onCancel,
}: {
  pending: boolean
  onSubmit: (pw: string) => void
  onCancel: () => void
}) {
  const [pw, setPw] = useState('')
  return (
    <div className="mt-2 flex justify-end gap-1.5">
      <input
        type="password"
        value={pw}
        onChange={e => setPw(e.target.value)}
        placeholder="Νέος κωδικός"
        autoComplete="new-password"
        className="h-9 w-44 rounded-full border border-border bg-card px-3 text-xs"
      />
      <button
        disabled={pending || !pw}
        onClick={() => onSubmit(pw)}
        className="cursor-pointer rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground disabled:opacity-50"
      >
        Αλλαγή
      </button>
      <button onClick={onCancel} className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs">
        Άκυρο
      </button>
    </div>
  )
}

function Field({
  label, value, onChange, type = 'text', help,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; help?: string
}) {
  return (
    <label className="block space-y-1">
      <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoComplete={type === 'password' ? 'new-password' : undefined}
        className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {help && <span className="block text-[11px] text-muted-foreground">{help}</span>}
    </label>
  )
}
