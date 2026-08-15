/**
 * Minimal DeepSeek chat-completions client, used for product translation.
 *
 * Simplified from the damask implementation: no settings table, no AiUsage
 * ledger — configuration comes from the environment only. If per-call cost
 * accounting is wanted later, that is the piece to port back.
 */

export const DEEPSEEK_DEFAULT_API_URL = 'https://api.deepseek.com/v1/chat/completions'
export const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat'

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

export class DeepSeekError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
    this.name = 'DeepSeekError'
  }
}

export function isDeepSeekConfigured(): boolean {
  return !!process.env.DEEPSEEK_API_KEY
}

export async function deepseekChat(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {},
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new DeepSeekError('Λείπει το DEEPSEEK_API_KEY — πρόσθεσέ το στο .env.')
  }
  const apiUrl = process.env.DEEPSEEK_API_URL || DEEPSEEK_DEFAULT_API_URL
  const model = process.env.DEEPSEEK_MODEL || DEEPSEEK_DEFAULT_MODEL

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 2048,
      // Low by default: translation should be faithful, not creative.
      temperature: opts.temperature ?? 0.2,
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
    cache: 'no-store',
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new DeepSeekError(`DeepSeek HTTP ${res.status}: ${body.slice(0, 300)}`, res.status)
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new DeepSeekError('Το DeepSeek επέστρεψε κενή απάντηση.')
  return content.trim()
}

const LANGUAGE_NAMES: Record<string, string> = {
  el: 'Greek',
  en: 'English',
}

export type TranslatableFields = {
  name: string
  shortDescription?: string | null
  description?: string | null
}

/**
 * Translates one product's copy between locales.
 *
 * Returns JSON rather than free text so the caller never has to guess which
 * paragraph is which. HTML in descriptions is preserved deliberately —
 * WooCommerce stores markup there, and stripping it would lose formatting the
 * storefront depends on.
 */
export async function translateProductFields(
  fields: TranslatableFields,
  fromLocale: string,
  toLocale: string,
): Promise<TranslatableFields> {
  const from = LANGUAGE_NAMES[fromLocale] ?? fromLocale
  const to = LANGUAGE_NAMES[toLocale] ?? toLocale

  const system = [
    `You translate e-commerce product copy from ${from} to ${to}.`,
    'This is an optical retailer: contact lenses, eyewear, and accessories.',
    'Rules:',
    '- Keep brand names, model names, SKUs, and measurements exactly as they are.',
    '- Preserve any HTML tags and their structure exactly.',
    '- Do not add marketing language that is not in the source.',
    '- Return ONLY a JSON object with keys: name, shortDescription, description.',
    '- If a source field is empty or null, return an empty string for it.',
  ].join('\n')

  const user = JSON.stringify({
    name: fields.name,
    shortDescription: fields.shortDescription ?? '',
    description: fields.description ?? '',
  })

  const raw = await deepseekChat([
    { role: 'system', content: system },
    { role: 'user', content: user },
  ])

  // The model sometimes wraps JSON in a markdown fence despite instructions.
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

  let parsed: TranslatableFields
  try {
    parsed = JSON.parse(cleaned) as TranslatableFields
  } catch {
    throw new DeepSeekError(`Η απάντηση δεν ήταν έγκυρο JSON: ${cleaned.slice(0, 200)}`)
  }
  if (!parsed.name) throw new DeepSeekError('Η μετάφραση δεν περιείχε όνομα προϊόντος.')
  return parsed
}

export type TranslatableTerm = { name: string; description?: string | null }

/**
 * Translates a taxonomy term — a category or a brand.
 *
 * Separate from the product prompt because the constraints differ: a brand name
 * is a proper noun that must survive untouched (Optimax stays Optimax in every
 * language), and a category name is a short label where an over-long
 * translation breaks the navigation layout.
 */
export async function translateTermFields(
  term: TranslatableTerm,
  fromLocale: string,
  toLocale: string,
  kind: 'category' | 'brand',
): Promise<TranslatableTerm> {
  const from = LANGUAGE_NAMES[fromLocale] ?? fromLocale
  const to = LANGUAGE_NAMES[toLocale] ?? toLocale

  const system = [
    `You translate ${kind} names for an optical retailer from ${from} to ${to}.`,
    'Rules:',
    kind === 'brand'
      ? '- A brand name is a proper noun: return it UNCHANGED unless it is a descriptive Greek phrase.'
      : '- Category names are short navigation labels: keep the translation as short as the source.',
    '- Keep measurements, model codes, and numbers exactly as they are.',
    '- Preserve any HTML tags in the description exactly.',
    '- Return ONLY a JSON object with keys: name, description.',
    '- If the source description is empty, return an empty string.',
  ].join('\n')

  const raw = await deepseekChat([
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify({ name: term.name, description: term.description ?? '' }) },
  ])

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: TranslatableTerm
  try {
    parsed = JSON.parse(cleaned) as TranslatableTerm
  } catch {
    throw new DeepSeekError(`Η απάντηση δεν ήταν έγκυρο JSON: ${cleaned.slice(0, 200)}`)
  }
  if (!parsed.name) throw new DeepSeekError('Η μετάφραση δεν περιείχε όνομα.')
  return parsed
}
