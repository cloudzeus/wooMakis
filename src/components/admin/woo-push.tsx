'use client'

import { useState } from 'react'

export type Gate = { allowWrites: boolean; dryRun: boolean; environment: string }

/** Result of the safe write-permission probe, when the page ran one. */
export type KeyStatus = { canRead: boolean; canWrite: boolean; detail: string }

export type Verdict = { field: string; sent: unknown; live: unknown; match: boolean }
export type Report = { locale: string; wooId: number; verdicts: Verdict[]; ok: boolean }

export type ScopeOption<K extends string> = {
  key: K
  label: string
  /** Shown under the label — say what WooCommerce does with it, not what it is. */
  hint: string
}

/**
 * The one place a WooCommerce write can be triggered from the UI.
 *
 * Three things are non-negotiable here and are why this is a shared component
 * rather than copied markup:
 *
 *  1. The gates are always displayed, so nobody discovers writes were off after
 *     wondering why nothing changed.
 *  2. The payload can always be previewed before sending.
 *  3. Production requires typing an exact phrase. A disabled button is not a
 *     confirmation; a phrase the operator has to read and retype is.
 */
export function WooPushPanel<K extends string>({
  title, description, gate, options, warnings,
  onPreview, onPush, onVerify, canPush, pending, keyStatus,
}: {
  title: string
  description: string
  gate: Gate
  options: ScopeOption<K>[]
  warnings?: string[]
  onPreview: (scope: Record<K, boolean>) => void
  onPush: (scope: Record<K, boolean>) => void
  onVerify?: () => void
  canPush: boolean
  pending: boolean
  keyStatus?: KeyStatus
  }) {
  const [scope, setScope] = useState<Record<K, boolean>>(
    Object.fromEntries(options.map(o => [o.key, false])) as Record<K, boolean>,
  )

  const blocked = !gate.allowWrites || gate.dryRun
  const production = gate.environment === 'production'
  const phrase = production ? 'confirm production push' : 'confirm push'
  const [typed, setTyped] = useState('')

  const chosen = options.filter(o => scope[o.key])

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>

      <StatusLine gate={gate} keyStatus={keyStatus} />

      {warnings?.map(w => (
        <p key={w} className="mt-2 rounded-xl bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
          ⚠ {w}
        </p>
      ))}

      <fieldset className="mt-4">
        <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Τι θα σταλεί
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {options.map(o => (
            <label key={o.key} className="flex cursor-pointer gap-2 rounded-xl border border-border p-3">
              <input
                type="checkbox"
                checked={scope[o.key]}
                onChange={e => { setScope({ ...scope, [o.key]: e.target.checked }); setTyped('') }}
                className="mt-0.5 size-4 shrink-0 cursor-pointer accent-[var(--navy)]"
              />
              <span>
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onPreview(scope)}
          disabled={pending || chosen.length === 0}
          className="h-9 cursor-pointer rounded-full border border-border px-4 text-sm hover:bg-accent disabled:opacity-40"
        >
          Δες τι θα σταλεί
        </button>

        {onVerify && (
          <button
            type="button"
            onClick={onVerify}
            disabled={pending}
            className="h-9 cursor-pointer rounded-full border border-border px-4 text-sm hover:bg-accent disabled:opacity-40"
          >
            Σύγκρινε με το mylens.gr
          </button>
        )}

        {canPush && !blocked && (
          <>
            <input
              value={typed}
              onChange={e => setTyped(e.target.value)}
              placeholder={phrase}
              aria-label="Φράση επιβεβαίωσης"
              className="h-9 w-60 rounded-full border border-border bg-card px-4 text-sm"
            />
            <button
              type="button"
              onClick={() => { onPush(scope); setTyped('') }}
              disabled={pending || typed !== phrase || chosen.length === 0}
              className="h-9 cursor-pointer rounded-full bg-destructive px-4 text-sm font-medium text-white disabled:opacity-40"
            >
              Αποστολή στο WooCommerce
            </button>
          </>
        )}
      </div>

      {blocked && (
        <div className="mt-3 rounded-xl bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Γιατί δεν μπορώ να στείλω τώρα;</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-4">
            {keyStatus && !keyStatus.canWrite && (
              <li>
                <strong>Το κλειδί API του καταστήματος δεν επιτρέπει εγγραφή.</strong> Αυτό
                αλλάζει μόνο μέσα στο WordPress: WooCommerce → Ρυθμίσεις → Για προχωρημένους
                → REST API → άνοιξε το κλειδί → Δικαιώματα: «Ανάγνωση/Εγγραφή».
              </li>
            )}
            <li>
              Ο διακόπτης ασφαλείας της εφαρμογής είναι κλειστός. Αλλάζει στις ρυθμίσεις του
              server (<code>WOO_ALLOW_WRITES=true</code> και <code>WOO_DRY_RUN=false</code>),
              όχι από αυτή τη σελίδα — σκόπιμα, ώστε να μην ανοίγει κατά λάθος με ένα κλικ.
            </li>
          </ol>
          <p className="mt-2">
            Στο μεταξύ τα δύο κουμπιά παραπάνω δουλεύουν κανονικά: δεν γράφουν τίποτα,
            μόνο διαβάζουν.
          </p>
        </div>
      )}
      {!canPush && (
        <p className="mt-3 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          Δεν έχεις το δικαίωμα <code>sync.push</code>.
        </p>
      )}
    </section>
  )
}

/**
 * The state of play, in one line a shop owner can act on.
 *
 * The raw environment-variable names used to be printed here. They told a
 * developer exactly what was wrong and told everybody else nothing, so the
 * plain answer leads and the variable names are folded away for whoever has to
 * change them on the server.
 */
function StatusLine({ gate, keyStatus }: { gate: Gate; keyStatus?: KeyStatus }) {
  const blocked = !gate.allowWrites || gate.dryRun
  const production = gate.environment === 'production'

  const state = blocked
    ? { icon: '🔒', label: 'Κλειδωμένο', cls: 'bg-muted text-muted-foreground',
        text: 'Καμία αλλαγή δεν φεύγει προς το κατάστημα.' }
    : { icon: '⚡', label: 'Ενεργό', cls: 'bg-destructive/10 text-destructive',
        text: 'Οι αλλαγές που θα στείλεις εφαρμόζονται αμέσως στο κατάστημα.' }

  return (
    <div className="mt-3 space-y-2">
      <p className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${state.cls}`}>
          <span aria-hidden>{state.icon}</span>{state.label}
        </span>
        <span className="text-muted-foreground">{state.text}</span>
      </p>

      {production && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">
          ⚠ Συνδεδεμένο στο <strong>ζωντανό mylens.gr</strong>, με πραγματικούς πελάτες και
          παραγγελίες — όχι σε δοκιμαστικό αντίγραφο. Ό,τι σταλεί το βλέπουν αμέσως οι
          επισκέπτες και δεν αναιρείται από εδώ.
        </p>
      )}

      {keyStatus && (
        <p className={`rounded-xl px-3 py-2 text-xs ${
          keyStatus.canWrite
            ? 'bg-[var(--success)]/12 text-[var(--success)]'
            : 'bg-[var(--warning)]/12 text-[var(--warning)]'
        }`}>
          {keyStatus.canWrite ? '✓ ' : '⚠ '}{keyStatus.detail}
        </p>
      )}

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer">Τεχνικές λεπτομέρειες</summary>
        <p className="mt-1 pl-4">
          <code>WOO_ALLOW_WRITES={String(gate.allowWrites)}</code>{' · '}
          <code>WOO_DRY_RUN={String(gate.dryRun)}</code>{' · '}
          <code>WOO_ENVIRONMENT={gate.environment}</code>
        </p>
      </details>
    </div>
  )
}

/** Read-back diff. `sent` is what we hold locally, `live` is what the store returned. */
export function VerdictTable({ reports }: { reports: Report[] }) {
  if (!reports.length) return null
  return (
    <div className="space-y-3">
      {reports.map(r => (
        <div key={`${r.locale}-${r.wooId}`} className="overflow-hidden rounded-2xl border border-border">
          <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2 text-sm">
            <span className={r.ok ? 'text-[var(--success)]' : 'text-destructive'} aria-hidden>
              {r.ok ? '✓' : '⚠'}
            </span>
            <strong>{r.locale.toUpperCase()}</strong>
            <span className="text-muted-foreground">Woo #{r.wooId}</span>
            <span className="ml-auto text-xs text-muted-foreground">
              {r.ok ? 'όλα τα πεδία συμφωνούν' : 'υπάρχουν διαφορές'}
            </span>
          </div>
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2">Πεδίο</th>
                <th className="px-4 py-2">Τοπικά</th>
                <th className="px-4 py-2">Στο WooCommerce</th>
                <th className="px-4 py-2">Έλεγχος</th>
              </tr>
            </thead>
            <tbody>
              {r.verdicts.map(v => (
                <tr key={v.field} className="border-b border-border/60 last:border-0 align-top">
                  <td className="px-4 py-2 font-mono">{v.field}</td>
                  <td className="max-w-[22ch] px-4 py-2"><Excerpt value={v.sent} /></td>
                  <td className="max-w-[22ch] px-4 py-2"><Excerpt value={v.live} /></td>
                  <td className="px-4 py-2">
                    <span className={v.match ? 'text-[var(--success)]' : 'text-destructive'}>
                      {v.match ? '✓ ίδιο' : '⚠ διαφορά'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function Excerpt({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    return <span className="text-muted-foreground">{value.length} στοιχεία</span>
  }
  const s = value == null || value === '' ? '—' : String(value)
  return <span className="line-clamp-3 break-words">{s.length > 120 ? `${s.slice(0, 120)}…` : s}</span>
}

