'use client'

import { useState, useTransition } from 'react'
import { createFolder, deleteFolder, renameFolder } from './actions'

export type FolderNode = {
  id: string
  name: string
  parentId: string | null
  assetCount: number
  childCount: number
}

/**
 * Folder navigation: breadcrumb, the folders inside the current one, and the
 * create control.
 *
 * Selection is held by the parent so the upload queue and the grid both know
 * which folder is open; this component only reports changes upward.
 */
export function FolderBar({
  folders, currentId, onOpen, canManage, onChanged,
}: {
  folders: FolderNode[]
  currentId: string | null
  onOpen: (id: string | null) => void
  canManage: boolean
  onChanged: (msg: { ok: boolean; text: string }) => void
}) {
  const [pending, start] = useTransition()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)

  const byId = new Map(folders.map(f => [f.id, f]))
  const children = folders.filter(f => f.parentId === currentId)

  // Walk up to the root so the breadcrumb shows the full path.
  const trail: FolderNode[] = []
  let cursor = currentId ? byId.get(currentId) : undefined
  while (cursor) {
    trail.unshift(cursor)
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <nav aria-label="Διαδρομή φακέλων" className="flex flex-wrap items-center gap-1 text-sm">
        <button
          onClick={() => onOpen(null)}
          className={`rounded-full px-3 py-1 ${currentId === null ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
        >
          Όλα τα αρχεία
        </button>
        {trail.map((f, i) => (
          <span key={f.id} className="flex items-center gap-1">
            <span aria-hidden className="text-muted-foreground">/</span>
            <button
              onClick={() => onOpen(f.id)}
              className={`rounded-full px-3 py-1 ${i === trail.length - 1 ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
            >
              {f.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {children.map(f => (
          <span key={f.id} className="flex items-center gap-1 rounded-full border border-border pl-1 pr-1">
            {renaming === f.id ? (
              <RenameField
                initial={f.name}
                onCancel={() => setRenaming(null)}
                onSave={v =>
                  start(async () => {
                    const r = await renameFolder(f.id, v)
                    onChanged(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                    setRenaming(null)
                  })
                }
              />
            ) : (
              <>
                <button
                  onClick={() => onOpen(f.id)}
                  className="rounded-full px-3 py-1.5 text-sm hover:bg-accent"
                >
                  {f.name}
                  <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                    {f.assetCount}
                  </span>
                </button>
                {canManage && (
                  <>
                    <button
                      onClick={() => setRenaming(f.id)}
                      aria-label={`Μετονομασία ${f.name}`}
                      className="rounded-full px-1.5 py-1 text-xs text-muted-foreground hover:bg-accent"
                    >
                      ✎
                    </button>
                    <button
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await deleteFolder(f.id)
                          onChanged(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                        })
                      }
                      aria-label={`Διαγραφή ${f.name}`}
                      title="Τα αρχεία μέσα δεν διαγράφονται, μεταφέρονται στη ρίζα"
                      className="rounded-full px-1.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      ✕
                    </button>
                  </>
                )}
              </>
            )}
          </span>
        ))}

        {canManage && (
          creating ? (
            <span className="flex items-center gap-1">
              <input
                autoFocus
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setCreating(false); setName('') }
                  if (e.key === 'Enter' && name.trim()) {
                    start(async () => {
                      const r = await createFolder(name, currentId)
                      onChanged(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                      setCreating(false); setName('')
                    })
                  }
                }}
                placeholder="Όνομα φακέλου"
                className="h-9 w-44 rounded-full border border-border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                disabled={pending || !name.trim()}
                onClick={() =>
                  start(async () => {
                    const r = await createFolder(name, currentId)
                    onChanged(r.ok ? { ok: true, text: r.message } : { ok: false, text: r.error })
                    setCreating(false); setName('')
                  })
                }
                className="h-9 rounded-full bg-primary px-4 text-xs text-primary-foreground disabled:opacity-50"
              >
                Δημιουργία
              </button>
              <button
                onClick={() => { setCreating(false); setName('') }}
                className="h-9 rounded-full border border-border px-3 text-xs"
              >
                Άκυρο
              </button>
            </span>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="rounded-full border border-dashed border-border px-4 py-1.5 text-sm text-muted-foreground hover:border-solid hover:text-foreground"
            >
              + Νέος φάκελος
            </button>
          )
        )}
      </div>
    </div>
  )
}

function RenameField({
  initial, onSave, onCancel,
}: {
  initial: string
  onSave: (v: string) => void
  onCancel: () => void
}) {
  const [v, setV] = useState(initial)
  return (
    <input
      autoFocus
      value={v}
      onChange={e => setV(e.target.value)}
      onKeyDown={e => {
        if (e.key === 'Enter' && v.trim()) onSave(v)
        if (e.key === 'Escape') onCancel()
      }}
      onBlur={onCancel}
      className="h-8 w-40 rounded-full border border-border bg-card px-3 text-sm outline-none"
    />
  )
}
