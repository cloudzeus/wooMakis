import Image from 'next/image'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { SLOTS } from '@/lib/storefront-slots'

export const dynamic = 'force-dynamic'

/**
 * Which storefront positions are filled, and which are still falling back to a
 * placeholder. The assignment itself happens in Πολυμέσα, where the images are;
 * this screen exists so nobody has to remember which slots exist or discover a
 * placeholder by finding it live on the site.
 */
export default async function StorefrontPage() {
  await requirePermission('settings.manage')

  const assigned = await prisma.mediaAsset.findMany({
    where: { slot: { not: null } },
    select: { id: true, slot: true, cdnUrl: true, title: true, altText: true, width: true, height: true },
  })
  const bySlot = new Map(assigned.map(a => [a.slot!, a]))

  const [products, categories, brands] = await Promise.all([
    prisma.product.count({ where: { status: 'publish' } }),
    prisma.category.count(),
    prisma.brand.count({ where: { products: { some: {} } } }),
  ])

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold">Κατάστημα</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Περιεχόμενο που εμφανίζεται στο δημόσιο site.
          </p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="h-10 rounded-full border border-border px-5 text-sm leading-10 hover:bg-accent"
        >
          Άνοιγμα καταστήματος
        </Link>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { n: products, l: 'Δημοσιευμένα προϊόντα' },
          { n: categories, l: 'Κατηγορίες' },
          { n: brands, l: 'Μάρκες με προϊόντα' },
        ].map(s => (
          <div key={s.l} className="rounded-2xl border border-border bg-card p-5">
            <p className="text-2xl font-semibold tabular-nums">{s.n}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5">
        <h2 className="mb-1 font-display text-base font-semibold">Εικόνες θέσεων</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Η ανάθεση γίνεται στα{' '}
          <Link href="/media" className="underline underline-offset-2">Πολυμέσα</Link>,
          επιλέγοντας θέση κάτω από κάθε αρχείο.
        </p>

        <ul className="space-y-3">
          {SLOTS.map(slot => {
            const asset = bySlot.get(slot.key)
            return (
              <li
                key={slot.key}
                className="flex flex-wrap items-center gap-4 rounded-xl border border-border p-3"
              >
                <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {asset ? (
                    <Image src={asset.cdnUrl} alt={asset.altText ?? ''} fill sizes="128px"
                           className="object-cover" unoptimized />
                  ) : (
                    <div className="grid h-full place-items-center text-[11px] text-muted-foreground">
                      placeholder
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{slot.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{slot.hint}</p>
                  {asset ? (
                    <p className="mt-1 text-xs text-[var(--success)]">
                      ✓ {asset.title ?? 'Χωρίς τίτλο'}
                      {asset.width && asset.height && ` · ${asset.width}×${asset.height}`}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-[var(--warning)]">
                      ⚠ Δεν έχει οριστεί εικόνα. Το site δείχνει προσωρινή φωτογραφία.
                    </p>
                  )}
                </div>

                <Link
                  href="/media"
                  className="rounded-full border border-border px-4 py-2 text-xs hover:bg-accent"
                >
                  {asset ? 'Αλλαγή' : 'Ορισμός'}
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
