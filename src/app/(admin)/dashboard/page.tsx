import { requirePermission } from '@/lib/rbac-server'

export default async function DashboardPage() {
  const session = await requirePermission('product.view')
  return (
    <section>
      <h1 className="font-display text-xl font-semibold">Πίνακας ελέγχου</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Καλώς ήρθες, {session.user.name}. Ο κατάλογος θα εμφανιστεί εδώ μετά τον πρώτο συγχρονισμό.
      </p>
    </section>
  )
}
