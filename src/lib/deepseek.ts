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

export type TranslatableDocument = { title: string; summary?: string | null; body: string }

/**
 * Translates a long structured document — a terms page, a privacy policy.
 *
 * Separate from translateTermFields because the constraints are opposite. A
 * term is a short label where brevity matters; a legal page is a document
 * where the structure is load-bearing and where "improving" a sentence can
 * change what a clause means. So this prompt forbids condensing, forbids
 * reordering, and pins the three block markers the renderer understands.
 *
 * Square-bracket placeholders are left alone: they are slots for the company's
 * own details and a translated placeholder would silently stop matching the
 * ones an editor is searching for.
 */
export async function translateDocument(
  doc: TranslatableDocument,
  fromLocale: string,
  toLocale: string,
): Promise<TranslatableDocument> {
  const from = LANGUAGE_NAMES[fromLocale] ?? fromLocale
  const to = LANGUAGE_NAMES[toLocale] ?? toLocale

  const system = [
    `You translate legal and informational web pages for an optical retailer from ${from} to ${to}.`,
    'This text is contractual. Accuracy outranks fluency.',
    'Rules:',
    '- Translate every sentence. Do not summarise, condense, merge or drop anything.',
    '- Do not add sentences, explanations or disclaimers that are not in the source.',
    '- Keep the structure line for line: a line starting with "## " stays a heading,',
    '  a line starting with "- " stays a list item, blank lines stay blank lines.',
    '- Leave text inside square brackets EXACTLY as it is, including the brackets.',
    '  Those are placeholders for company details, not words to translate.',
    '- Keep legal and technical terms precise: withdrawal, distance selling, VAT,',
    '  data controller, medical device, base curve, diameter.',
    '- Return ONLY a JSON object with keys: title, summary, body.',
  ].join('\n')

  const user = JSON.stringify({
    title: doc.title,
    summary: doc.summary ?? '',
    body: doc.body,
  })

  const raw = await deepseekChat(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    // Legal pages run long; the default 2048 truncates them mid-clause.
    { maxTokens: 8192, temperature: 0.1 },
  )

  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')

  let parsed: TranslatableDocument
  try {
    parsed = JSON.parse(cleaned) as TranslatableDocument
  } catch {
    throw new DeepSeekError(`Η απάντηση δεν ήταν έγκυρο JSON: ${cleaned.slice(0, 200)}`)
  }
  if (!parsed.title || !parsed.body) {
    throw new DeepSeekError('Η μετάφραση δεν περιείχε τίτλο ή κείμενο.')
  }
  return parsed
}
