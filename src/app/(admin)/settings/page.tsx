import { prisma } from '@/lib/prisma'
import { requirePermission } from '@/lib/rbac-server'
import { readGate } from '@/lib/woo/write'
import { isDeepSeekConfigured, DEEPSEEK_DEFAULT_MODEL } from '@/lib/deepseek'
import { ordersEnabled } from '@/lib/woo/orders'

export const dynamic = 'force-dynamic'

type Check = {
  label: string
  value: string
  /** ok = working, warn = works but worth knowing, off = not configured. */
  state: 'ok' | 'warn' | 'off'
  note?: string
}

function Row({ c }: { c: Check }) {
  const style = {
    ok: { icon: '✓', cls: 'bg-[var(--success)]/12 text-[var(--success)]' },
    warn: { icon: '!', cls: 'bg-[var(--warning)]/12 text-[var(--warning)]' },
    off: { icon: '○', cls: 'bg-muted text-muted-foreground' },
  }[c.state]
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/60 py-2.5 last:border-0">
      <span className={`inline-flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${style.cls}`}>
        <span aria-hidden>{style.icon}</span>
      </span>
      <span className="min-w-[13rem] text-[13px] font-medium">{c.label}</span>
      <code className="text-[12.5px] text-muted-foreground">{c.value}</code>
      {c.note && <span className="w-full pl-8 text-[11.5px] text-muted-foreground sm:w-auto sm:pl-0">{c.note}</span>}
    </div>
  )
}

function Card({ title, description, checks }: { title: string; description: string; checks: Check[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-display text-base font-semibold">{title}</h2>
      <p className="mb-2 mt-1 text-sm text-muted-foreground">{description}</p>
      {checks.map(c => <Row key={c.label} c={c} />)}
    </section>
  )
}

/** Shows whether a secret is present without ever showing the secret. */
function present(v: string | undefined): Check['state'] {
  return v ? 'ok' : 'off'
}
function masked(v: string | undefined): string {
  if (!v) return 'δεν έχει οριστεί'
  return `${v.slice(0, 6)}…${v.slice(-4)} (${v.length} χαρακτήρες)`
}

export default async function SettingsPage() {
  await requirePermission('settings.manage')

  const gate = readGate()
  const production = gate.environment === 'production'

  const [products, orders, customers, assets, users] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.customer.count(),
    prisma.mediaAsset.count(),
    prisma.user.count({ where: { active: true } }),
  ])

  const bytes = await prisma.mediaAsset.aggregate({ _sum: { bytes: true } })
  const gb = (Number(bytes._sum.bytes ?? 0) / 1024 ** 3).toFixed(2)

  return (
    <section className="space-y-4">
      <header>
        <h1 className="font-display text-xl font-semibold">Ρυθμίσεις</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Τι είναι συνδεδεμένο και τι επιτρέπεται. Οι τιμές διαβάζονται από το
          περιβάλλον και αλλάζουν στο <code>.env</code> ή στο Coolify, όχι από εδώ —
          μια ρύθμιση που αλλάζει από το UI και μια που αλλάζει από το deployment
          θα διαφωνούσαν σιωπηλά.
        </p>
      </header>

      {production && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          ⚠ <strong>Παραγωγή.</strong> Το <code>WOO_BASE_URL</code> δείχνει στο ζωντανό
          κατάστημα με πραγματικές παραγγελίες. Κάθε εγγραφή που ενεργοποιείται εδώ
          είναι άμεση και δεν αναιρείται από την εφαρμογή.
        </p>
      )}

      <Card
        title="WooCommerce"
        description="Η σύνδεση με το mylens.gr."
        checks={[
          {
            label: 'Κατάστημα',
            value: process.env.WOO_BASE_URL ?? 'δεν έχει οριστεί',
            state: present(process.env.WOO_BASE_URL),
          },
          {
            label: 'Περιβάλλον',
            value: gate.environment,
            state: production ? 'warn' : 'ok',
            note: production ? 'Οι εγγραφές αφορούν πραγματικά δεδομένα.' : undefined,
          },
          {
            label: 'Consumer key',
            value: masked(process.env.WOO_CONSUMER_KEY),
            state: present(process.env.WOO_CONSUMER_KEY),
            note: 'Το κλειδί που δόθηκε είναι μόνο ανάγνωσης. Για αποστολή αλλαγών '
              + 'χρειάζεται δικαίωμα Read/Write στο WP-Admin → WooCommerce → Ρυθμίσεις → '
              + 'Για προχωρημένους → REST API.',
          },
          {
            label: 'Εγγραφές επιτρεπτές',
            value: `WOO_ALLOW_WRITES=${gate.allowWrites}`,
            state: gate.allowWrites ? 'warn' : 'off',
          },
          {
            label: 'Δοκιμαστική λειτουργία',
            value: `WOO_DRY_RUN=${gate.dryRun}`,
            state: gate.dryRun ? 'ok' : 'warn',
            note: gate.dryRun
              ? 'Καμία εγγραφή δεν φεύγει· επιστρέφεται το payload για έλεγχο.'
              : 'Οι εγγραφές φεύγουν πραγματικά.',
          },
          {
            label: 'Δημιουργία παραγγελιών',
            value: `WOO_ALLOW_ORDERS=${process.env.WOO_ALLOW_ORDERS ?? 'false'}`,
            state: ordersEnabled() ? 'warn' : 'off',
            note: 'Ελέγχει αν το ταμείο του καταστήματος μπορεί να δημιουργήσει '
              + 'παραγγελία στο WooCommerce.',
          },
        ]}
      />

      <Card
        title="Αποθήκευση αρχείων"
        description="BunnyCDN. Οι εικόνες προϊόντων και τα πολυμέσα ζουν εδώ, όχι στο WordPress."
        checks={[
          {
            label: 'Storage zone',
            value: process.env.BUNNY_STORAGE_ZONE ?? 'δεν έχει οριστεί',
            state: present(process.env.BUNNY_STORAGE_ZONE),
          },
          {
            label: 'Pull zone',
            value: process.env.BUNNY_PULL_ZONE_URL ?? 'δεν έχει οριστεί',
            state: present(process.env.BUNNY_PULL_ZONE_URL),
          },
          {
            label: 'Storage API',
            value: process.env.BUNNY_STORAGE_API ?? 'δεν έχει οριστεί',
            state: present(process.env.BUNNY_STORAGE_API),
          },
          {
            label: 'AccessKey',
            // Names must match lib/bunny.ts exactly. They did not at first, and
            // a settings page that reports a working integration as missing is
            // worse than no settings page.
            value: masked(process.env.BUNNY_STORAGE_PASSWORD),
            state: present(process.env.BUNNY_STORAGE_PASSWORD),
          },
          {
            label: 'Αποθηκευμένα αρχεία',
            value: `${assets} αρχεία · ${gb} GB`,
            state: 'ok',
          },
        ]}
      />

      <Card
        title="Μετάφραση"
        description="DeepSeek, για προϊόντα, κατηγορίες και μάρκες."
        checks={[
          {
            label: 'API key',
            value: masked(process.env.DEEPSEEK_API_KEY),
            state: isDeepSeekConfigured() ? 'ok' : 'off',
            note: isDeepSeekConfigured() ? undefined : 'Τα κουμπιά μετάφρασης είναι ανενεργά.',
          },
          {
            label: 'Μοντέλο',
            value: process.env.DEEPSEEK_MODEL || DEEPSEEK_DEFAULT_MODEL,
            state: 'ok',
          },
        ]}
      />

      <Card
        title="Δεδομένα"
        description="Τι υπάρχει αυτή τη στιγμή στη βάση."
        checks={[
          { label: 'Προϊόντα', value: String(products), state: products > 0 ? 'ok' : 'off' },
          { label: 'Παραγγελίες', value: String(orders), state: orders > 0 ? 'ok' : 'off' },
          { label: 'Πελάτες', value: String(customers), state: customers > 0 ? 'ok' : 'off' },
          { label: 'Ενεργοί χρήστες διαχείρισης', value: String(users), state: 'ok' },
        ]}
      />
    </section>
  )
}
