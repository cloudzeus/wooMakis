'use client'

import { useState, useTransition } from 'react'
import { RowActions } from '@/components/admin/row-actions'
import {
  createFaq, createPage, deleteFaq, deletePage, moveFaq,
  savePage, saveFaq, translateFaq, translatePage,
} from './actions'

export type PageRow = {
  id: string
  slug: string
  kind: string
  published: boolean
  translations: { locale: string; title: string; body: string; summary: string }[]
}

export type FaqRow = {
  id: string
  category: string
  published: boolean
  menuOrder: number
  translations: { locale: string; question: string; answer: string }[]
}

const LOCALES = ['el', 'en'] as const

/** Blank translation so the editor always renders both languages. */
function pageTr(rows: PageRow['translations'], locale: string) {
  return rows.find(t => t.locale === locale) ?? { locale, title: '', body: '', summary: '' }
}
function faqTr(rows: FaqRow['translations'], locale: string) {
  return rows.find(t => t.locale === locale) ?? { locale, question: '', answer: '' }
}

export function ContentManager({
  pages, faq, deepseekReady,
}: {
  pages: PageRow[]
  faq: FaqRow[]
  deepseekReady: boolean
}) {
  const [tab, setTab] = useState<'pages' | 'faq'>('pages')
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function run(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    start(async () => {
      const r = await fn()
      setMsg(r.ok ? { ok: true, text: r.message! } : { ok: false, text: r.error! })
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full bg-muted p-1">
          {(['pages', 'faq'] as const).map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={`h-9 cursor-pointer rounded-full px-4 text-sm font-medium ${
                tab === k ? 'bg-card shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {k === 'pages' ? `Σελίδες (${pages.length})` : `Ερωτήσεις (${faq.length})`}
            </button>
          ))}
        </div>
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

      {!deepseekReady && (
        <p className="rounded-2xl bg-[var(--warning)]/10 px-4 py-2.5 text-xs text-[var(--warning)]">
          ⚠ Η αυτόματη μετάφραση απαιτεί <code>DEEPSEEK_API_KEY</code> στο .env.
        </p>
      )}

      {tab === 'pages'
        ? <Pages pages={pages} pending={pending} deepseekReady={deepseekReady} run={run} />
        : <Faq items={faq} pending={pending} deepseekReady={deepseekReady} run={run} />}
    </div>
  )
}

type Runner = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) => void

function Pages({
  pages, pending, deepseekReady, run,
}: {
  pages: PageRow[]; pending: boolean; deepseekReady: boolean; run: Runner
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')

  return (
    <div className="space-y-3">
      <form
        onSubmit={e => { e.preventDefault(); run(() => createPage(newTitle)); setNewTitle('') }}
        className="flex flex-wrap gap-2 rounded-2xl border border-border bg-card p-4"
      >
        <input
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          placeholder="Τίτλος νέας σελίδας"
          aria-label="Τίτλος νέας σελίδας"
          className="h-10 flex-1 rounded-full border border-border bg-card px-4 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          + Νέα σελίδα
        </button>
      </form>

      {pages.map(p => (
        <PageEditor
          key={p.id}
          page={p}
          expanded={open === p.id}
          onToggle={() => setOpen(open === p.id ? null : p.id)}
          pending={pending}
          deepseekReady={deepseekReady}
          run={run}
        />
      ))}
    </div>
  )
}

function PageEditor({
  page, expanded, onToggle, pending, deepseekReady, run,
}: {
  page: PageRow; expanded: boolean; onToggle: () => void
  pending: boolean; deepseekReady: boolean; run: Runner
}) {
  const [form, setForm] = useState(LOCALES.map(l => pageTr(page.translations, l)))
  const [published, setPublished] = useState(page.published)

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="cursor-pointer text-left text-sm font-medium hover:underline"
        >
          {expanded ? '▾' : '▸'} {pageTr(page.translations, 'el').title || page.slug}
        </button>
        <code className="text-xs text-muted-foreground">/{page.slug}</code>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {page.kind}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${
            published
              ? 'bg-[var(--success)]/12 text-[var(--success)]'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {published ? '✓ Δημοσιευμένη' : '○ Πρόχειρη'}
        </span>

        <div className="ml-auto">
          <RowActions
            label={`Ενέργειες για ${page.slug}`}
            actions={[
              { label: 'Προβολή στο κατάστημα', href: `/${page.slug}`, external: true },
              {
                label: 'Μετάφραση EN με DeepSeek',
                disabled: !deepseekReady,
                hint: deepseekReady ? 'Έλεγξε το κείμενο πριν δημοσιεύσεις' : 'Λείπει το DEEPSEEK_API_KEY',
                onSelect: () => run(() => translatePage(page.id, 'en')),
              },
              {
                label: 'Διαγραφή',
                danger: true,
                disabled: page.kind !== 'GENERIC',
                hint: page.kind !== 'GENERIC' ? 'Θεσμική σελίδα — απόσυρέ την αντί να τη σβήσεις' : undefined,
                onSelect: () => run(() => deletePage(page.id)),
              },
            ]}
          />
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-border px-5 py-4">
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={published}
              onChange={e => setPublished(e.target.checked)}
              className="size-4 cursor-pointer accent-[var(--navy)]"
            />
            Δημοσιευμένη
          </label>

          {form.map((t, i) => (
            <div key={t.locale} className="space-y-2">
              <span className="inline-block rounded-full bg-[var(--navy)]/10 px-2 py-0.5 text-[11px] uppercase text-[var(--navy)]">
                {t.locale}
              </span>
              <input
                value={t.title}
                onChange={e => {
                  const next = [...form]; next[i] = { ...t, title: e.target.value }; setForm(next)
                }}
                placeholder="Τίτλος"
                aria-label={`Τίτλος ${t.locale}`}
                className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm"
              />
              <input
                value={t.summary}
                onChange={e => {
                  const next = [...form]; next[i] = { ...t, summary: e.target.value }; setForm(next)
                }}
                placeholder="Σύντομη περίληψη (προαιρετικό)"
                aria-label={`Περίληψη ${t.locale}`}
                className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm"
              />
              <textarea
                value={t.body}
                onChange={e => {
                  const next = [...form]; next[i] = { ...t, body: e.target.value }; setForm(next)
                }}
                rows={14}
                aria-label={`Κείμενο ${t.locale}`}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs"
              />
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            Μορφοποίηση: <code>## </code> για επικεφαλίδα, <code>- </code> για λίστα,
            κενή γραμμή για νέα παράγραφο. Δεν δέχεται HTML — το κείμενο εμφανίζεται
            όπως γράφτηκε, ώστε να μη μπορεί να μπει script στη σελίδα του πελάτη.
          </p>

          <button
            onClick={() => run(() => savePage(page.id, form, published))}
            disabled={pending}
            className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Αποθήκευση σελίδας
          </button>
        </div>
      )}
    </section>
  )
}

function Faq({
  items, pending, deepseekReady, run,
}: {
  items: FaqRow[]; pending: boolean; deepseekReady: boolean; run: Runner
}) {
  const [draft, setDraft] = useState({ category: '', question: '', answer: '' })
  const [open, setOpen] = useState<string | null>(null)

  const categories = [...new Set(items.map(i => i.category))]

  return (
    <div className="space-y-3">
      <form
        onSubmit={e => {
          e.preventDefault()
          run(() => createFaq(draft.category, draft.question, draft.answer))
          setDraft({ category: draft.category, question: '', answer: '' })
        }}
        className="space-y-3 rounded-2xl border border-border bg-card p-5"
      >
        <h2 className="font-display text-base font-semibold">Νέα ερώτηση</h2>
        <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
          <input
            value={draft.category}
            onChange={e => setDraft({ ...draft, category: e.target.value })}
            placeholder="Κατηγορία"
            aria-label="Κατηγορία"
            list="faq-categories"
            className="h-10 rounded-full border border-border bg-card px-4 text-sm"
          />
          <datalist id="faq-categories">
            {categories.map(c => <option key={c} value={c} />)}
          </datalist>
          <input
            value={draft.question}
            onChange={e => setDraft({ ...draft, question: e.target.value })}
            placeholder="Ερώτηση"
            aria-label="Ερώτηση"
            className="h-10 rounded-full border border-border bg-card px-4 text-sm"
          />
        </div>
        <textarea
          value={draft.answer}
          onChange={e => setDraft({ ...draft, answer: e.target.value })}
          placeholder="Απάντηση"
          aria-label="Απάντηση"
          rows={4}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          + Προσθήκη
        </button>
      </form>

      {items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
          Δεν υπάρχουν ερωτήσεις ακόμα.
        </p>
      )}

      {categories.map(cat => (
        <section key={cat} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h3>
          {items.filter(i => i.category === cat).map(item => (
            <FaqEditor
              key={item.id}
              item={item}
              expanded={open === item.id}
              onToggle={() => setOpen(open === item.id ? null : item.id)}
              pending={pending}
              deepseekReady={deepseekReady}
              run={run}
            />
          ))}
        </section>
      ))}
    </div>
  )
}

function FaqEditor({
  item, expanded, onToggle, pending, deepseekReady, run,
}: {
  item: FaqRow; expanded: boolean; onToggle: () => void
  pending: boolean; deepseekReady: boolean; run: Runner
}) {
  const [category, setCategory] = useState(item.category)
  const [published, setPublished] = useState(item.published)
  const [form, setForm] = useState(LOCALES.map(l => faqTr(item.translations, l)))

  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="cursor-pointer text-left text-sm hover:underline"
        >
          {expanded ? '▾' : '▸'} {faqTr(item.translations, 'el').question || '(χωρίς ερώτηση)'}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {!published && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
              ○ Πρόχειρη
            </span>
          )}
          {item.translations.length < 2 && (
            <span className="rounded-full bg-[var(--warning)]/12 px-2 py-0.5 text-[11px] text-[var(--warning)]">
              μόνο ΕΛ
            </span>
          )}
          <RowActions
            label="Ενέργειες για την ερώτηση"
            actions={[
              { label: '↑ Πιο πάνω', onSelect: () => run(() => moveFaq(item.id, -1)) },
              { label: '↓ Πιο κάτω', onSelect: () => run(() => moveFaq(item.id, 1)) },
              {
                label: 'Μετάφραση EN με DeepSeek',
                disabled: !deepseekReady,
                hint: deepseekReady ? undefined : 'Λείπει το DEEPSEEK_API_KEY',
                onSelect: () => run(() => translateFaq(item.id, 'en')),
              },
              { label: 'Διαγραφή', danger: true, onSelect: () => run(() => deleteFaq(item.id)) },
            ]}
          />
        </div>
      </div>

      {expanded && (
        <div className="space-y-3 border-t border-border px-5 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={category}
              onChange={e => setCategory(e.target.value)}
              aria-label="Κατηγορία"
              className="h-9 w-56 rounded-full border border-border bg-card px-4 text-sm"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={published}
                onChange={e => setPublished(e.target.checked)}
                className="size-4 cursor-pointer accent-[var(--navy)]"
              />
              Δημοσιευμένη
            </label>
          </div>

          {form.map((t, i) => (
            <div key={t.locale} className="space-y-2">
              <span className="inline-block rounded-full bg-[var(--navy)]/10 px-2 py-0.5 text-[11px] uppercase text-[var(--navy)]">
                {t.locale}
              </span>
              <input
                value={t.question}
                onChange={e => {
                  const next = [...form]; next[i] = { ...t, question: e.target.value }; setForm(next)
                }}
                placeholder="Ερώτηση"
                aria-label={`Ερώτηση ${t.locale}`}
                className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm"
              />
              <textarea
                value={t.answer}
                onChange={e => {
                  const next = [...form]; next[i] = { ...t, answer: e.target.value }; setForm(next)
                }}
                placeholder="Απάντηση"
                aria-label={`Απάντηση ${t.locale}`}
                rows={4}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
              />
            </div>
          ))}

          <p className="text-xs text-muted-foreground">
            Άφησε κενή μια γλώσσα για να αφαιρεθεί — η σελίδα πέφτει τότε στα ελληνικά,
            αντί να δείχνει άδεια απάντηση.
          </p>

          <button
            onClick={() => run(() => saveFaq(item.id, category, published, form))}
            disabled={pending}
            className="h-10 cursor-pointer rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            Αποθήκευση
          </button>
        </div>
      )}
    </div>
  )
}
