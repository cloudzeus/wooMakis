'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { SLOTS } from '@/lib/storefront-slots'
import { assignSlot, deleteMedia, moveAssets, updateMedia } from './actions'
import { FolderBar, type FolderNode } from './folder-bar'
import { UploadQueue } from './upload-queue'

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
  folderId: string | null
}

function human(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function MediaLibrary({
  items, folders, canUpload, canDelete, canAssign, ffmpegReady,
}: {
  items: LibraryItem[]
  folders: FolderNode[]
  canUpload: boolean
  canDelete: boolean
  canAssign: boolean
  ffmpegReady: boolean
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [folderId, setFolderId] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Root shows only unfiled assets, so opening a folder is the only way to see
  // its contents and "Όλα τα αρχεία" does not duplicate everything.
  const visible = useMemo(
    () => items.filter(i => i.folderId === folderId),
    [items, folderId],
  )

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-4">
      <FolderBar
        folders={folders}
        currentId={folderId}
        onOpen={id => { setFolderId(id); setSelected(new Set()) }}
        canManage={canUpload}
        onChanged={m => { setMsg(m); router.refresh() }}
      />

      <UploadQueue
        folderId={folderId}
        canUpload={canUpload}
        ffmpegReady={ffmpegReady}
        onDone={() => router.refresh()}
      />

      {selected.size > 0 && canUpload && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <span className="text-sm tabular-nums">{selected.size} επιλεγμένα</span>
          <select
            defaultValue=""
            onChange={e =>
              start(async () => {
                const r = await moveAssets([...selected], e.target.value || null)
                setMsg(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                setSelected(new Set())
                router.refresh()
              })
            }
            aria-label="Μεταφορά σε φάκελο"
            className="h-9 cursor-pointer rounded-full border border-border bg-card px-4 text-sm"
          >
            <option value="" disabled>Μεταφορά σε…</option>
            <option value="">Ρίζα (χωρίς φάκελο)</option>
            {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
          <button
            onClick={() => setSelected(new Set())}
            className="h-9 rounded-full border border-border px-4 text-sm"
          >
            Καθαρισμός
          </button>
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {folderId ? 'Ο φάκελος είναι άδειος.' : 'Η βιβλιοθήκη είναι άδεια.'} Ανέβασε αρχεία για να τα χρησιμοποιήσεις στο site.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map(it => {
            const isVideo = it.mimeType.startsWith('video/')
            return (
              <li key={it.id} className={`overflow-hidden rounded-2xl border bg-card ${selected.has(it.id) ? 'border-[var(--navy)]' : 'border-border'}`}>
                <div className="relative aspect-video bg-white">
                  {canUpload && (
                    <label className="absolute right-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-card/90 shadow">
                      <input
                        type="checkbox"
                        checked={selected.has(it.id)}
                        onChange={() => toggle(it.id)}
                        aria-label={`Επιλογή ${it.title ?? 'αρχείου'}`}
                      />
                    </label>
                  )}
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
