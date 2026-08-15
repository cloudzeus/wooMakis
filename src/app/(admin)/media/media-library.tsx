'use client'

import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'
import { assignSlot, deleteMedia, updateMedia, uploadMedia } from './actions'

export type LibraryItem = {
  id: string
  cdnUrl: string
  mimeType: string
  bytes: number
  width: number | null
  height: number | null
  title: string | null
  altText: string | null
  slot: string | null
  createdAt: string
  durationSeconds: number | null
}

/** Named positions the storefront reads. Keep in step with the pages that use them. */
export const SLOTS = [
  { key: 'editorial-hero', label: 'Εικόνα ενότητας «Καθαρή όραση»' },
] as const

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function MediaLibrary({
  items, canUpload, canDelete, canAssign, ffmpegReady,
}: {
  items: LibraryItem[]
  canUpload: boolean
  canDelete: boolean
  canAssign: boolean
  ffmpegReady: boolean
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    setMsg(null)
    start(async () => {
      const r = await uploadMedia(fd)
      setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
      if (r.ok) formRef.current?.reset()
    })
  }

  return (
    <div className="space-y-5">
      <form
        ref={formRef}
        onSubmit={onSubmit}
        className="rounded-2xl border border-border bg-card p-5"
      >
        <h2 className="mb-1 font-display text-base font-semibold">Μεταφόρτωση</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Οι εικόνες μετατρέπονται σε WebP με μέγιστη πλευρά 1920px. Τα βίντεο
          συμπιέζονται σε MP4 (H.264/AAC), ίδιο όριο διαστάσεων.
        </p>

        {!ffmpegReady && (
          <p className="mb-4 rounded-xl bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
            ⚠ Το ffmpeg δεν βρέθηκε στον server. Η μεταφόρτωση εικόνων λειτουργεί
            κανονικά, τα βίντεο όχι.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1 sm:col-span-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Αρχείο
            </span>
            <input
              type="file" name="file" required
              accept={ffmpegReady ? 'image/*,video/*' : 'image/*'}
              disabled={!canUpload || pending}
              className="w-full cursor-pointer rounded-xl border border-border bg-card p-2 text-sm file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:text-primary-foreground"
            />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Τίτλος
            </span>
            <input name="title" disabled={!canUpload || pending}
              className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="block space-y-1">
            <span className="block text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Εναλλακτικό κείμενο
            </span>
            <input name="altText" disabled={!canUpload || pending}
              className="h-10 w-full rounded-full border border-border bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
        </div>

        <button
          type="submit" disabled={!canUpload || pending}
          className="mt-4 h-10 cursor-pointer rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {pending ? 'Επεξεργασία…' : 'Μεταφόρτωση'}
        </button>

        {msg && (
          <p
            role="status"
            className={`mt-3 rounded-xl px-3 py-2 text-sm ${
              msg.ok ? 'bg-[var(--success)]/12 text-[var(--success)]' : 'bg-destructive/10 text-destructive'
            }`}
          >
            {msg.ok ? '✓ ' : '⚠ '}{msg.text}
          </p>
        )}
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Η βιβλιοθήκη είναι άδεια. Ανέβασε μια εικόνα για να τη χρησιμοποιήσεις στο site.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map(it => {
            const isVideo = it.mimeType.startsWith('video/')
            return (
              <li key={it.id} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="relative aspect-video bg-white">
                  {isVideo ? (
                    <video src={it.cdnUrl} controls preload="metadata" className="h-full w-full object-contain" />
                  ) : (
                    <Image src={it.cdnUrl} alt={it.altText ?? ''} fill sizes="320px"
                           className="object-contain" unoptimized />
                  )}
                  {it.slot && (
                    <span className="absolute left-2 top-2 rounded-full bg-[var(--navy)] px-2 py-0.5 text-[10px] text-white">
                      {SLOTS.find(s => s.key === it.slot)?.label ?? it.slot}
                    </span>
                  )}
                </div>

                <div className="space-y-2 p-3">
                  {editing === it.id ? (
                    <EditFields
                      item={it}
                      onDone={(t, a) =>
                        start(async () => {
                          const r = await updateMedia(it.id, { title: t, altText: a })
                          setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                          setEditing(null)
                        })
                      }
                      onCancel={() => setEditing(null)}
                    />
                  ) : (
                    <>
                      <p className="truncate text-sm font-medium">{it.title ?? 'Χωρίς τίτλο'}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.mimeType.replace(/^(image|video)\//, '').toUpperCase()} · {human(it.bytes)}
                        {it.width && it.height && <> · {it.width}×{it.height}</>}
                        {it.durationSeconds !== null && <> · {Math.round(it.durationSeconds)}s</>}
                      </p>
                    </>
                  )}

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      onClick={() => navigator.clipboard.writeText(it.cdnUrl)}
                      className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs hover:bg-accent"
                    >
                      Αντιγραφή URL
                    </button>
                    {canUpload && editing !== it.id && (
                      <button onClick={() => setEditing(it.id)}
                              className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs hover:bg-accent">
                        Επεξεργασία
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={() =>
                          start(async () => {
                            const r = await deleteMedia(it.id)
                            setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                          })
                        }
                        className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs text-destructive hover:bg-destructive/10"
                      >
                        Διαγραφή
                      </button>
                    )}
                  </div>

                  {canAssign && !isVideo && (
                    <select
                      value={it.slot ?? ''}
                      onChange={e =>
                        start(async () => {
                          const r = await assignSlot(it.id, e.target.value || null)
                          setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                        })
                      }
                      aria-label="Θέση στο site"
                      className="h-8 w-full cursor-pointer rounded-full border border-border bg-card px-3 text-xs"
                    >
                      <option value="">Χωρίς θέση στο site</option>
                      {SLOTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function EditFields({
  item, onDone, onCancel,
}: {
  item: LibraryItem
  onDone: (title: string, alt: string) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(item.title ?? '')
  const [alt, setAlt] = useState(item.altText ?? '')
  return (
    <div className="space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Τίτλος"
             className="h-8 w-full rounded-full border border-border bg-card px-3 text-xs" />
      <input value={alt} onChange={e => setAlt(e.target.value)} placeholder="Εναλλακτικό κείμενο"
             className="h-8 w-full rounded-full border border-border bg-card px-3 text-xs" />
      <div className="flex gap-1.5">
        <button onClick={() => onDone(title, alt)}
                className="cursor-pointer rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
          Αποθήκευση
        </button>
        <button onClick={onCancel}
                className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs">
          Άκυρο
        </button>
      </div>
    </div>
  )
}
