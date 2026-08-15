'use server'

import { revalidatePath } from 'next/cache'
import { requirePermission } from '@/lib/rbac-server'
import {
  previewTermPush, pushTerm, saveTerm, translateTerm, verifyTerm,
  type TermPushResult, type TermResult,
} from '@/lib/admin/terms'

function refresh(id: string) {
  revalidatePath(`/brands/${id}`)
  revalidatePath('/brands')
}

export async function saveBrand(
  id: string,
  translations: { locale: string; name: string; description: string }[],
): Promise<TermResult> {
  await requirePermission('brand.edit')
  const r = await saveTerm('brand', id, translations)
  if (r.ok) refresh(id)
  return r
}

export async function translateBrand(id: string, toLocale: string): Promise<TermResult> {
  await requirePermission('brand.edit')
  const r = await translateTerm('brand', id, toLocale)
  if (r.ok) refresh(id)
  return r
}

export async function previewBrandPush(id: string) {
  await requirePermission('brand.view')
  const p = await previewTermPush('brand', id, { content: true })
  return { plans: p.plans.map(x => ({ locale: x.locale, plan: { url: x.plan.url, body: x.plan.body } })), warnings: p.warnings }
}

export async function pushBrand(id: string): Promise<TermPushResult> {
  await requirePermission('sync.push')
  const r = await pushTerm('brand', id, { content: true }, true)
  if (r.ok) refresh(id)
  return r
}

export async function verifyBrand(id: string): Promise<TermPushResult> {
  await requirePermission('brand.view')
  return verifyTerm('brand', id)
}
