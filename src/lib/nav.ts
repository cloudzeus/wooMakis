export type NavItem = {
  href: string
  label: string
  /** The permission that reveals this item. */
  permission: string
}

export type NavGroup = {
  /** Null renders the items ungrouped at the top, above the first heading. */
  title: string | null
  items: NavItem[]
}

/**
 * Sidebar structure.
 *
 * Grouped by where the data lives, not by screen type, because that is the
 * distinction that actually matters when working here:
 *
 * - WooCommerce: mirrored from mylens.gr. Edits here can travel back upstream.
 * - CMS: content that exists only in this application and feeds the storefront.
 * - Διαχείριση: who can do what, and how the system is configured.
 *
 * Each item names the permission that reveals it; a group whose items are all
 * hidden does not render its heading either (see components/shell/sidebar.tsx).
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: null,
    items: [
      { href: '/dashboard', label: 'Πίνακας ελέγχου', permission: 'product.view' },
    ],
  },
  {
    title: 'WooCommerce',
    items: [
      { href: '/products',   label: 'Προϊόντα',     permission: 'product.view' },
      { href: '/categories', label: 'Κατηγορίες',   permission: 'category.view' },
      { href: '/brands',     label: 'Μάρκες',       permission: 'brand.view' },
      { href: '/customers',  label: 'Πελάτες',      permission: 'customer.view' },
      { href: '/sync',       label: 'Συγχρονισμός', permission: 'sync.view' },
    ],
  },
  {
    title: 'CMS',
    items: [
      { href: '/media',      label: 'Πολυμέσα',   permission: 'media.view' },
      { href: '/storefront', label: 'Κατάστημα',  permission: 'settings.manage' },
    ],
  },
  {
    title: 'Διαχείριση',
    items: [
      { href: '/users',    label: 'Χρήστες',   permission: 'user.manage' },
      { href: '/roles',    label: 'Ρόλοι',     permission: 'role.manage' },
      { href: '/settings', label: 'Ρυθμίσεις', permission: 'settings.manage' },
    ],
  },
]

/** Flat list, kept for the proxy matcher and for tests that assert coverage. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap(g => g.items)
