'use client'

import { useCallback, useRef, useState } from 'react'
import { uploadMedia } from './actions'

type QueueItem = {
  file: File
  status: 'waiting' | 'working' | 'done' | 'error'
  message?: string
}

/** Two at a time: enough to hide latency, few enough that one big video does not starve the rest. */
const CONCURRENCY = 2

/**
 * Multi-file upload.
 *
 * Each file is sent as its OWN server-action call rather than one giant
 * FormData. Three reasons: the body-size limit applies per request, a single
 * failure cannot take the whole batch with it, and per-file status is real
 * rather than one spinner over the group.
 */
export function UploadQueue({
  folderId, canUpload, ffmpegReady, onDone,
}: {
  folderId: string | null
  canUpload: boolean
  ffmpegReady: boolean
  onDone: () => void
}) {
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [running, setRunning] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const runQueue = useCallback(async (items: QueueItem[]) => {
    setRunning(true)
    let cursor = 0

    const worker = async () => {
      while (cursor < items.length) {
        const i = cursor++
        setQueue(q => q.map((it, n) => (n === i ? { ...it, status: 'working' } : it)))

        const fd = new FormData()
        fd.set('file', items[i].file)
        if (folderId) fd.set('folderId', folderId)

        try {
          const r = await uploadMedia(fd)
          setQueue(q => q.map((it, n) => (n === i
            ? { ...it, status: r.ok ? 'done' : 'error', message: r.ok ? r.message : r.error }
            : it)))
        } catch (err) {
          setQueue(q => q.map((it, n) => (n === i
            ? { ...it, status: 'error', message: err instanceof Error ? err.message : String(err) }
            : it)))
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
    setRunning(false)
    onDone()
  }, [folderId, onDone])

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    const items: QueueItem[] = files.map(file => ({ file, status: 'waiting' }))
    setQueue(items)
    void runQueue(items)
    if (inputRef.current) inputRef.current.value = ''
  }

  const done = queue.filter(q => q.status === 'done').length
  const failed = queue.filter(q => q.status === 'error').length

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Μεταφόρτωση</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Πολλά αρχεία ταυτόχρονα. Οι εικόνες γίνονται WebP με μέγιστη πλευρά
            1920px, τα βίντεο MP4 (H.264/AAC).
          </p>
        </div>

        <label
          className={`h-10 shrink-0 rounded-full px-6 text-sm font-medium leading-10 ${
            canUpload && !running
              ? 'cursor-pointer bg-primary text-primary-foreground'
              : 'cursor-not-allowed bg-muted text-muted-foreground'
          }`}
        >
          {running ? 'Μεταφόρτωση…' : 'Επιλογή αρχείων'}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ffmpegReady ? 'image/*,video/*' : 'image/*'}
            disabled={!canUpload || running}
            onChange={onPick}
            className="hidden"
          />
        </label>
      </div>

      {!ffmpegReady && (
        <p className="mb-3 rounded-xl bg-[var(--warning)]/10 px-3 py-2 text-xs text-[var(--warning)]">
          ⚠ Το ffmpeg δεν βρέθηκε στον server. Οι εικόνες ανεβαίνουν κανονικά, τα βίντεο όχι.
        </p>
      )}

      {queue.length > 0 && (
        <>
          <div className="mb-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums">{done}/{queue.length} ολοκληρώθηκαν</span>
            {failed > 0 && <span className="tabular-nums text-destructive">{failed} απέτυχαν</span>}
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {queue.map((it, i) => (
              <li
                key={`${it.file.name}-${i}`}
                className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-muted/40"
              >
                <span className="w-4 shrink-0" aria-hidden>
                  {it.status === 'done' ? '✓' : it.status === 'error' ? '⚠' : it.status === 'working' ? '⟳' : '·'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{it.file.name}</span>
                  {it.message && (
                    <span className={it.status === 'error' ? 'text-destructive' : 'text-muted-foreground'}>
                      {it.message}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
