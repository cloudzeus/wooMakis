'use client'

import { TermEditor, type TermTranslation } from '@/components/admin/term-editor'
import type { Gate } from '@/components/admin/woo-push'
import { previewBrandPush, pushBrand, saveBrand, translateBrand, verifyBrand } from './actions'

export function BrandEditor({
  id, subtitle, translations, gate, canEdit, canPush, deepseekReady,
}: {
  id: string
  subtitle: string
  translations: TermTranslation[]
  gate: Gate
  canEdit: boolean
  canPush: boolean
  deepseekReady: boolean
}) {
  return (
    <TermEditor
      kind="brand"
      subtitle={subtitle}
      translations={translations}
      gate={gate}
      canEdit={canEdit}
      canPush={canPush}
      deepseekReady={deepseekReady}
      actions={{
        save: t => saveBrand(id, t),
        translate: loc => translateBrand(id, loc),
        preview: () => previewBrandPush(id),
        push: () => pushBrand(id),
        verify: () => verifyBrand(id),
      }}
    />
  )
}
