'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { sanitizeHtml } from '@/lib/sanitize-html'

/**
 * Rich text for product, category and brand descriptions.
 *
 * Built on contentEditable rather than a library. The formatting these fields
 * need is bold, italic, lists, two heading levels and a link — that is a
 * toolbar, not an editing framework, and TipTap or Lexical would add a large
 * client bundle to an admin page that already ships a table and a drag layer.
 *
 * `document.execCommand` is formally deprecated and has no replacement; every
 * browser still implements it and every rich text editor still relies on the
 * same underlying engine. The risk it carries is inconsistent markup, not
 * unsafe markup, and the sanitiser handles the output either way.
 *
 * Two things matter more than the toolbar:
 *
 *  - Paste is intercepted and inserted as plain text. Pasting from Word or a
 *    web page otherwise drags in a page of styles, font tags and sometimes
 *    scripts, and the customer-facing page inherits it.
 *  - The value is sanitised here AND on the server. This pass is for what the
 *    editor shows; the server's pass is the one that counts.
 */
export function RichText({
  value, onChange, disabled, label, help, rows = 8,
}: {
  value: string
  onChange: (html: string) => void
  disabled?: boolean
  label: string
  help?: string
  rows?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId()
  const [html, setHtml] = useState(() => sanitizeHtml(value))
  const [source, setSource] = useState(false)

  // Only write into the DOM when the value changed elsewhere — assigning
  // innerHTML on every keystroke moves the caret to the start of the field.
  useEffect(() => {
    const el = ref.current
    if (el && !source && el.innerHTML !== html) el.innerHTML = html
  }, [html, source])

  function emit(next: string) {
    const clean = sanitizeHtml(next)
    setHtml(clean)
    onChange(clean)
  }

  function exec(command: string, arg?: string) {
    if (disabled) return
    ref.current?.focus()
    document.execCommand(command, false, arg)
    if (ref.current) emit(ref.current.innerHTML)
  }

  function addLink() {
    const url = window.prompt('Διεύθυνση συνδέσμου (https://…)')
    if (!url) return
    exec('createLink', url)
  }

  const tools: { label: string; title: string; run: () => void }[] = [
    { label: 'B', title: 'Έντονα', run: () => exec('bold') },
    { label: 'I', title: 'Πλάγια', run: () => exec('italic') },
    { label: 'H2', title: 'Επικεφαλίδα', run: () => exec('formatBlock', 'h2') },
    { label: 'H3', title: 'Υποεπικεφαλίδα', run: () => exec('formatBlock', 'h3') },
    { label: '• Λίστα', title: 'Λίστα με κουκκίδες', run: () => exec('insertUnorderedList') },
    { label: '1. Λίστα', title: 'Αριθμημένη λίστα', run: () => exec('insertOrderedList') },
    { label: 'Σύνδεσμος', title: 'Εισαγωγή συνδέσμου', run: addLink },
    { label: 'Καθαρισμός', title: 'Αφαίρεση μορφοποίησης', run: () => exec('removeFormat') },
  ]

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={`${id}-label`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <button
          type="button"
          onClick={() => setSource(s => !s)}
          className="cursor-pointer text-[11px] text-muted-foreground underline hover:text-foreground"
        >
          {source ? 'Επεξεργασία κειμένου' : 'Προβολή HTML'}
        </button>
      </div>

      {!source && (
        <div className="flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-border bg-muted/40 p-1.5">
          {tools.map(t => (
            <button
              key={t.label}
              type="button"
              title={t.title}
              aria-label={t.title}
              disabled={disabled}
              // Keeps the selection: a mousedown on a button blurs the editable
              // area first, and the command then applies to nothing.
              onMouseDown={e => e.preventDefault()}
              onClick={t.run}
              className="cursor-pointer rounded-lg px-2 py-1 text-xs hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {source ? (
        <textarea
          value={html}
          disabled={disabled}
          rows={rows + 2}
          aria-labelledby={`${id}-label`}
          onChange={e => emit(e.target.value)}
          className="w-full rounded-xl border border-border bg-card px-3 py-2 font-mono text-xs outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
        />
      ) : (
        <div
          ref={ref}
          contentEditable={!disabled}
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${id}-label`}
          onInput={e => emit((e.target as HTMLDivElement).innerHTML)}
          onBlur={e => emit((e.target as HTMLDivElement).innerHTML)}
          onPaste={e => {
            // Plain text only. A paste from Word or a web page otherwise brings
            // its entire style sheet along, and the storefront inherits it.
            e.preventDefault()
            const text = e.clipboardData.getData('text/plain')
            document.execCommand('insertText', false, text)
          }}
          style={{ minHeight: `${rows * 1.6}rem` }}
          className="woo-rich-text w-full overflow-y-auto rounded-b-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring aria-disabled:opacity-60"
        />
      )}

      {help && <p className="text-[11px] text-muted-foreground">{help}</p>}
    </div>
  )
}
