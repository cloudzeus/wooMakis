import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { defaultCopyFor, getAllHomeSections, SECTION_LABELS } from '@/lib/home-sections'
import { SectionsManager, type SectionRow } from './sections-manager'

export const dynamic = 'force-dynamic'

/** Which bands actually use an image or a list, so the form hides what does not apply. */
const SHAPE: Record<string, { image: boolean; imageB: boolean; limit: boolean }> = {
  HERO:       { image: true,  imageB: false, limit: false },
  TRUST:      { image: false, imageB: false, limit: false },
  CATEGORIES: { image: false, imageB: false, limit: true },
  PRODUCTS:   { image: false, imageB: false, limit: true },
  PANELS:     { image: true,  imageB: true,  limit: false },
  BRANDS:     { image: false, imageB: false, limit: true },
  NEWSLETTER: { image: false, imageB: false, limit: false },
}

export default async function HomeSectionsPage() {
  await requirePermission('settings.manage')

  const [el, en, assets] = await Promise.all([
    getAllHomeSections('el'),
    getAllHomeSections('en'),
    prisma.mediaAsset.findMany({
      where: { slot: { not: null } },
      select: { slot: true },
      orderBy: { slot: 'asc' },
    }),
  ])

  const slots = assets.map(a => a.slot!).filter(Boolean)

  const rows: SectionRow[] = el.map(section => {
    const enRow = en.find(x => x.kind === section.kind)!
    const shape = SHAPE[section.kind]
    return {
      kind: section.kind,
      label: SECTION_LABELS[section.kind].el,
      help: SECTION_LABELS[section.kind].help,
      enabled: section.enabled,
      imageSlot: section.imageSlot ?? '',
      imageSlotB: section.imageSlotB ?? '',
      itemLimit: section.itemLimit,
      usesImage: shape.image,
      usesSecondImage: shape.imageB,
      usesLimit: shape.limit,
      translations: [
        { locale: 'el', ...section.copy },
        { locale: 'en', ...enRow.copy },
      ],
      defaults: {
        el: { locale: 'el', ...defaultCopyFor(section.kind, 'el') },
        en: { locale: 'en', ...defaultCopyFor(section.kind, 'en') },
      },
    }
  })

  return (
    <section className="space-y-4">
      <nav className="text-xs text-muted-foreground">
        <Link href="/storefront" className="hover:text-foreground">Κατάστημα</Link>
        <span className="mx-1">/</span>
        <span>Ενότητες αρχικής</span>
      </nav>

      <header>
        <h1 className="font-display text-xl font-semibold">Ενότητες αρχικής σελίδας</h1>
        <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
          Κάθε λωρίδα της αρχικής. Μπορείς να αλλάξεις σειρά, να κρύψεις μια ενότητα,
          να αλλάξεις κείμενα και εικόνες, και να ορίσεις πόσα προϊόντα ή κατηγορίες
          δείχνει. Τα προϊόντα και οι μάρκες έρχονται πάντα από τον κατάλογο.
        </p>
      </header>

      <SectionsManager rows={rows} slots={slots} />
    </section>
  )
}
