'use client'

import Image from 'next/image'
import { useState } from 'react'
import {
  DndContext, KeyboardSensor, PointerSensor, closestCenter,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, arrayMove, rectSortingStrategy,
  sortableKeyboardCoordinates, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type SortableImage = {
  assetId: string
  cdnUrl: string
  mimeType: string
  bytes: number
  width: number | null
  height: number | null
}

/**
 * Drag to reorder product images. Position 0 is the main photo, which is what
 * WooCommerce uses as the product thumbnail.
 *
 * Keyboard support is not optional here: a drag-only control is unusable
 * without a pointer. dnd-kit's KeyboardSensor gives space-to-lift and arrows to
 * move, and the instructions say so rather than leaving it to be discovered.
 */
export function ImageSorter({
  images, disabled, onReorder, onRemove,
}: {
  images: SortableImage[]
  disabled?: boolean
  onReorder: (assetIds: string[]) => void
  onRemove?: (assetId: string) => void
}) {
  const [items, setItems] = useState(images)

  const sensors = useSensors(
    // A small distance threshold so a click on the remove button is not read as
    // the start of a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const from = items.findIndex(i => i.assetId === active.id)
    const to = items.findIndex(i => i.assetId === over.id)
    const next = arrayMove(items, from, to)
    setItems(next)
    onReorder(next.map(i => i.assetId))
  }

  if (items.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
        Το προϊόν δεν έχει εικόνες.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Σύρε για αναδιάταξη. Η πρώτη εικόνα είναι η κύρια φωτογραφία του προϊόντος.
        Με πληκτρολόγιο: Tab στην εικόνα, Space για να τη σηκώσεις, βελάκια για
        μετακίνηση, Space ξανά για να την αφήσεις.
      </p>

      {/* A stable id is required, not cosmetic. dnd-kit derives its screen
          reader ids (`DndDescribedBy-N`) from a module-global counter, so the
          server renders 0 and the client 1, and React reports a hydration
          mismatch on every tile. */}
      <DndContext
        id="product-image-sorter"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={items.map(i => i.assetId)} strategy={rectSortingStrategy}>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((img, i) => (
              <SortableTile
                key={img.assetId}
                image={img}
                isMain={i === 0}
                disabled={disabled}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  )
}

function SortableTile({
  image, isMain, disabled, onRemove,
}: {
  image: SortableImage
  isMain: boolean
  disabled?: boolean
  onRemove?: (assetId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: image.assetId, disabled })

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 10 : undefined,
      }}
      className="relative"
    >
      <div
        {...attributes}
        {...listeners}
        className={`relative overflow-hidden rounded-xl border-2 bg-white ${
          disabled ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'
        }`}
        style={{ borderColor: isMain ? 'var(--navy)' : 'var(--border)' }}
        aria-label={isMain ? 'Κύρια εικόνα, σύρε για αναδιάταξη' : 'Σύρε για αναδιάταξη'}
      >
        <Image
          src={image.cdnUrl}
          alt=""
          width={image.width ?? 200}
          height={image.height ?? 200}
          className="aspect-square w-full object-contain p-2"
          unoptimized
        />
        {isMain && (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-[var(--navy)] px-2 py-0.5 text-[10px] text-white">
            Κύρια
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between gap-1">
        <span className="truncate text-[10px] text-muted-foreground">
          {image.mimeType.replace('image/', '').toUpperCase()} · {Math.round(image.bytes / 1024)} KB
        </span>
        {onRemove && !disabled && (
          <button
            type="button"
            onClick={() => onRemove(image.assetId)}
            aria-label="Αφαίρεση εικόνας"
            className="shrink-0 cursor-pointer rounded-full px-1.5 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            ✕
          </button>
        )}
      </div>
    </li>
  )
}
