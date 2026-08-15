export type NavItem = { href: string; label: string; permission: string }

export const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',  label: 'Πίνακας ελέγχου', permission: 'product.view' },
  { href: '/products',   label: 'Προϊόντα',        permission: 'product.view' },
  { href: '/categories', label: 'Κατηγορίες',      permission: 'category.view' },
  { href: '/media',      label: 'Πολυμέσα',        permission: 'media.view' },
  { href: '/customers',  label: 'Πελάτες',         permission: 'customer.view' },
  { href: '/sync',       label: 'Συγχρονισμός',    permission: 'sync.view' },
  { href: '/users',      label: 'Χρήστες',         permission: 'user.manage' },
  { href: '/roles',      label: 'Ρόλοι',           permission: 'role.manage' },
  { href: '/settings',   label: 'Ρυθμίσεις',       permission: 'settings.manage' },
]
