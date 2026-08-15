import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { can } from '@/lib/rbac'
import { hasFfmpeg } from '@/lib/media-processing'
import { MediaLibrary, type LibraryItem } from './media-library'
import type { FolderNode } from './folder-bar'

export const dynamic = 'force-dynamic'

export default async function MediaPage() {
  const session = await requirePermission('media.view')

  const [assets, folderRows, ffmpegReady, productCount] = await Promise.all([
    prisma.mediaAsset.findMany({
      where: { kind: 'LIBRARY' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.mediaFolder.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { assets: true, children: true } } },
    }),
    hasFfmpeg(),
    prisma.mediaAsset.count({ where: { kind: 'PRODUCT' } }),
  ])

  const items: LibraryItem[] = assets.map(a => {
    const d = a.derivatives as { durationSeconds?: number } | null
    return {
      id: a.id,
      cdnUrl: a.cdnUrl,
      mimeType: a.mimeType,
      bytes: a.bytes,
      width: a.width,
      height: a.height,
      title: a.title,
      altText: a.altText,
      slot: a.slot,
      createdAt: a.createdAt.toISOString(),
      durationSeconds: typeof d?.durationSeconds === 'number' ? d.durationSeconds : null,
      folderId: a.folderId,
    }
  })

  const folders: FolderNode[] = folderRows.map(f => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
    assetCount: f._count.assets,
    childCount: f._count.children,
  }))

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Πολυμέσα</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} αρχεία σε {folders.length} φακέλους
          {' · '}
          <span title="Εικόνες προϊόντων από το WooCommerce, δεν διαχειρίζονται από εδώ">
            {productCount} εικόνες προϊόντων
          </span>
        </p>
      </header>

      <MediaLibrary
        items={items}
        folders={folders}
        canUpload={can(session, 'media.upload')}
        canDelete={can(session, 'media.delete')}
        canAssign={can(session, 'settings.manage')}
        ffmpegReady={ffmpegReady}
      />
    </section>
  )
}
