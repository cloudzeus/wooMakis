'use client'

import { TermEditor, type TermTranslation } from '@/components/admin/term-editor'
import type { Gate, KeyStatus } from '@/components/admin/woo-push'
import {
  previewCategoryPush, pushCategory, saveCategory, translateCategory, verifyCategory,
} from './actions'

export function CategoryEditor({
  id, subtitle, translations, gate, canEdit, canPush, deepseekReady, keyStatus,
}: {
  id: string
  subtitle: string
  translations: TermTranslation[]
  gate: Gate
  canEdit: boolean
  canPush: boolean
  deepseekReady: boolean
  keyStatus?: KeyStatus
}) {
  return (
    <TermEditor
      kind="category"
      subtitle={subtitle}
      translations={translations}
      gate={gate}
      keyStatus={keyStatus}
      canEdit={canEdit}
      canPush={canPush}
      deepseekReady={deepseekReady}
      actions={{
        save: t => saveCategory(id, t),
        translate: loc => translateCategory(id, loc),
        preview: () => previewCategoryPush(id),
        push: () => pushCategory(id),
        verify: () => verifyCategory(id),
      }}
    />
  )
}
