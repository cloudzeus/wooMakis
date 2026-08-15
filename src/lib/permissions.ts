export type PermissionDef = { key: string; description: string }

export const PERMISSIONS: PermissionDef[] = [
  { key: 'product.view', description: 'Προβολή προϊόντων' },
  { key: 'product.edit', description: 'Επεξεργασία προϊόντων' },
  { key: 'product.delete', description: 'Διαγραφή προϊόντων' },
  { key: 'category.view', description: 'Προβολή κατηγοριών' },
  { key: 'category.edit', description: 'Επεξεργασία κατηγοριών' },
  { key: 'brand.view', description: 'Προβολή μαρκών' },
  { key: 'brand.edit', description: 'Επεξεργασία μαρκών' },
  { key: 'media.view', description: 'Προβολή πολυμέσων' },
  { key: 'media.upload', description: 'Μεταφόρτωση πολυμέσων' },
  { key: 'media.delete', description: 'Διαγραφή πολυμέσων' },
  { key: 'customer.view', description: 'Προβολή πελατών' },
  { key: 'customer.edit', description: 'Επεξεργασία πελατών' },
  { key: 'sync.view', description: 'Προβολή συγχρονισμού και ιστορικού' },
  { key: 'sync.run', description: 'Εκτέλεση λήψης από το WooCommerce' },
  { key: 'sync.push', description: 'Αποστολή αλλαγών στο WooCommerce' },
  { key: 'sync.config', description: 'Ρύθμιση συγχρονισμού και αντιστοίχισης πεδίων' },
  { key: 'user.manage', description: 'Διαχείριση χρηστών' },
  { key: 'role.manage', description: 'Διαχείριση ρόλων και δικαιωμάτων' },
  { key: 'settings.manage', description: 'Διαχείριση ρυθμίσεων' },
]

const ALL = PERMISSIONS.map(p => p.key)

export const ROLE_DEFAULTS: Record<string, string[]> = {
  SUPER_ADMIN: ALL,
  CATALOG_MANAGER: [
    'product.view', 'product.edit',
    'category.view', 'category.edit',
    'brand.view', 'brand.edit',
    'media.view', 'media.upload',
    'customer.view',
    'sync.view', 'sync.run',
  ],
  VIEWER: [
    'product.view', 'category.view', 'brand.view',
    'media.view', 'customer.view', 'sync.view',
  ],
}

export const SYSTEM_ROLE_NAMES = new Set(['SUPER_ADMIN', 'CATALOG_MANAGER', 'VIEWER'])
