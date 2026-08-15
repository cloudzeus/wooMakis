'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/rbac-server'
import {
  previewTermPush, pushTerm, saveTerm, translateTerm, verifyTerm,
  type TermPushResult, type TermResult,
} from '@/lib/admin/terms'

function refresh(id: string) {
  revalidatePath(`/categories/${id}`)
  revalidatePath('/categories')
}

export async function saveCategory(
  id: string,
  translations: { locale: string; name: string; description: string }[],
): Promise<TermResult> {
  await requirePermission('category.edit')
  const r = await saveTerm('category', id, translations)
  if (r.ok) refresh(id)
  return r
}

export async function translateCategory(id: string, toLocale: string): Promise<TermResult> {
  await requirePermission('category.edit')
  const r = await translateTerm('category', id, toLocale)
  if (r.ok) refresh(id)
  return r
}

export async function previewCategoryPush(id: string) {
  await requirePermission('category.view')
  const p = await previewTermPush('category', id, { content: true })
  return { plans: p.plans.map(x => ({ locale: x.locale, plan: { url: x.plan.url, body: x.plan.body } })), warnings: p.warnings }
}

export async function pushCategory(id: string): Promise<TermPushResult> {
  await requirePermission('sync.push')
  const r = await pushTerm('category', id, { content: true }, true)
  if (r.ok) refresh(id)
  return r
}

export async function verifyCategory(id: string): Promise<TermPushResult> {
  await requirePermission('category.view')
  return verifyTerm('category', id)
}
